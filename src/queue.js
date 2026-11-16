import {all,get,put,log} from './db.js';
import {assertProfile,safeUrl,validateMetadata,sleep} from './core.js';
export class Queue {
 constructor(update=()=>{}){this.update=update;this.running=false;this.paused=false;this.stopped=false;}
 pause(){this.paused=true;return log('pause','Current action completes before pausing');}
 resume(){this.paused=false;return log('resume');}
 stop(){this.stopped=true;this.paused=false;return log('stop','No further actions will be dispatched');}
 async checkpoint(){while(this.paused&&!this.stopped)await sleep(200);if(this.stopped)throw Error('STOP_REQUESTED');}
 async send(tabId,step,file){const r=await chrome.tabs.sendMessage(tabId,{type:'execute',step,file});if(r?.error)throw Error(r.error);if(!r)throw Error('No content-script response');return r;}
 async start({mode,delay,testOnly=true,useCsvModes=true,selected=[],onPrepared=null,failFast=false,completeDraftHash=null}){
  if(this.running)throw Error('Queue already running');
  const p=await get('settings','profile');assertProfile(p,mode);
  delay=Number(delay);if(!Number.isFinite(delay)||delay<2000||delay>600000)throw Error('Delay must be 2000–600000 ms');
  this.running=true;this.stopped=false;this.paused=false;
  try{
   const items=(await all('items')).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')).filter(x=>completeDraftHash?x.hash===completeDraftHash:x.status==='pending'&&selected.includes(x.hash));
   if(completeDraftHash){
    if(items.length!==1)throw Error('Stored draft is missing');
    const item=items[0];
    if(['success','publishing','publication_unverified'].includes(item.status)||item.publishedUrl||item.recordedPublishedUrl)throw Error('Verify the publication outcome first; this design cannot be refilled automatically');
    const url=safeUrl(item.draftUrl);const match=new URL(url).pathname.match(/^\/designs\/(\d+)\/edit$/);
    if(!match||String(item.designId)!==match[1])throw Error('Stored draft URL and design ID do not match');
    if(!p.selectors.publish?.verifiedAt)throw Error('A recorded Publish control is required to identify the unpublished editor');
   }
   for(const item of testOnly?items.slice(0,1):items){
    await this.checkpoint();validateMetadata(item);const effectiveMode=useCsvModes&&['light','black'].includes(item.mode)?item.mode:mode;assertProfile(p,effectiveMode);item.mode=effectiveMode;item.lastAttempt=new Date().toISOString();item.status='running';await put('items',item);this.update();
    try{
     // Persist the editor identity immediately. Never automatically replay an ambiguous upload.
     let tab;
     if(completeDraftHash){
      const open=await chrome.tabs.query({url:'https://www.teepublic.com/*'});
      tab=open.find(t=>t.url===item.draftUrl)||await chrome.tabs.create({url:item.draftUrl,active:true});
     }else tab=item.draftUrl?await chrome.tabs.get(item.tabId):await chrome.tabs.create({url:safeUrl(p.entryUrl),active:true});
     if(item.draftUrl&&tab.url&&tab.url!==item.draftUrl)throw Error('Attached draft changed; review the target tab');await chrome.tabs.update(tab.id,{active:true});item.tabId=tab.id;await put('items',item);
     const deadline=Date.now()+60000;let ready=false;
     while(Date.now()<deadline){await this.checkpoint();const t=await chrome.tabs.get(tab.id);if(completeDraftHash&&t.status==='complete'&&t.url!==item.draftUrl)throw Error('Existing draft redirected or changed. Review the page before continuing');if(t.status==='complete'&&/^https:\/\/www\.teepublic\.com\/designs\/\d+\/edit$/.test(t.url||'')){ready=true;item.draftUrl=t.url;item.designId=new URL(t.url).pathname.split('/')[2];await put('items',item);break;}await sleep(500);}
     if(!ready)throw Error('Upload editor did not load; check login and platform restrictions');
     const field=(role,action,value)=>({role,action,selector:p.selectors[role]?.selector,value});
     const steps=[...(completeDraftHash?[field('publish','draft')]:item.reuseUploadedArtwork?[]:[field('file','file')]),field('uploadReady','wait'),field('title','fill',item.title),field('description','fill',item.description),field('mainTag','fill',item.mainTag)];
     if(item.tags){if(!p.selectors.tags)throw Error('Supporting tags selector is not recorded');steps.push(field('tags','tags',item.tags));}
     steps.push(field('matureNo','click'));
     if(p.palette?.[effectiveMode])steps.push({role:'palette',action:'palette',selector:p.palette[effectiveMode].selector,value:effectiveMode==='black'?'Dark':'Light'});
     if(p.apparelColors?.length){for(const group of ['tshirt','baseballtee'].flatMap(product=>p.apparelColors.filter(g=>g.product===product))){const option=effectiveMode==='black'?group.black:group.white;if(!option)continue;steps.push({role:'colorMenu',action:'click',selector:group.menu},{role:effectiveMode==='black'?'black':'white',action:'click',selector:option},{role:'colorState',action:'color',selector:group.menu,value:effectiveMode==='black'?group.blackLabel:'White'});}}
     else steps.push(field('colorMenu','click'),field(effectiveMode==='light'?'white':'black','click'),field('colorState','color',effectiveMode==='light'?'White':'Black'));
     steps.push(field('preview','preview'));
     for(let i=0;i<steps.length;i++){
      await this.checkpoint();item.phase=i;item.actionInFlight=true;await put('items',item);
      let file;
      if(steps[i].action==='file'){
       const b=await item.file.arrayBuffer();const bytes=new Uint8Array(b);let binary='';for(let n=0;n<bytes.length;n+=32768)binary+=String.fromCharCode(...bytes.subarray(n,n+32768));file={name:item.filename,data:btoa(binary)};
      }
      const evidence=await this.send(tab.id,steps[i],file);
      item.actionInFlight=false;item.phase=i+1;await put('items',item);
      await log('step',`${item.filename}: ${steps[i].role}`,{step:i+1,selector:steps[i].selector,actionType:steps[i].action,targetField:steps[i].role,selectedValue:steps[i].value,success:evidence.verified===true?true:null,verification:evidence.requiresHumanReview?'loaded preview only; visual review required':evidence.verified?'DOM postcondition verified':'action dispatched; outcome not verified'});
      this.update();if(steps[i].role!=='colorMenu')await sleep(delay);
     }
     await this.checkpoint();item.status='review';item.error='Review artwork contrast, tag tokens, products, positioning, mature content, and terms on the actual page. Publication requires explicit approval after review.'+(item.notes?' Source notes: '+item.notes:'');
     await log('prepared',item.filename);
     await put('items',item);this.update();
     if(onPrepared&&!completeDraftHash){await this.checkpoint();await onPrepared(item,p);}
    }catch(e){if(!['success','publishing','publication_unverified'].includes(item.status))item.status=e.message==='STOP_REQUESTED'?'stopped':'failed';item.error=e.message;await log('failure',`${item.filename}: ${e.message}`,{success:false,error:e.message});}
    await put('items',item);this.update();if(this.stopped||(failFast&&item.status!=='success'))break;
   }
  }finally{this.running=false;this.update();}
 }
}
export async function recoverInterrupted(){for(const i of await all('items'))if(['running','publishing'].includes(i.status)){const wasPublishing=i.status==='publishing';i.status=wasPublishing?'publication_unverified':'review';i.error='Interrupted run. Inspect the existing TeePublic draft before taking any further action; automatic replay is blocked.';await put('items',i);}}
