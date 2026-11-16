import {planAutoBatch,runAutoBatch} from './autobatch.js';
import {matchDesigns,validateSelection} from './matching.js';
import {parseCSV,metadata,validateMetadata,csvExport,ROLES,assertProfile} from './core.js';
import {all,get,put,addItem,log} from './db.js';
import {publishReviewed,verifyPublished} from './publication.js';
import {Queue,recoverInterrupted} from './queue.js';
const $=id=>document.getElementById(id);let files=[],rows=[];const selected=new Set();const overrides=new Map(),unchecked=new Set();let previewUrls=[];
const message=s=>{$('message').textContent=s;};
let publishing=false;
$('version').textContent='v'+chrome.runtime.getManifest().version;
$('toggleAdvanced').onclick=()=>{const hidden=document.body.classList.toggle('advanced-hidden');$('toggleAdvanced').textContent=hidden?'Advanced tools':'Hide advanced tools';$('toggleAdvanced').setAttribute('aria-expanded',String(!hidden));};
const wrap=fn=>async()=>{try{await fn();}catch(e){message(e.message);await log('error',e.message);}};
$('updateMetadata').onclick=wrap(async()=>{if(queue.running||publishing)throw Error('Stop the queue first');let count=0;for(const item of await all('items')){if(item.status!=='pending')continue;const m=rows.find(r=>r.filename===item.filename);if(m){validateMetadata(m);await put('items',{...item,...m});count++;}}message(`${count} pending metadata rows updated`);await render();});
const queue=new Queue(()=>render().catch(e=>message(e.message)));
function download(name,data,type='application/json'){const u=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
async function tabs(){const ts=await chrome.tabs.query({url:'https://www.teepublic.com/*'});$('tabs').replaceChildren(...ts.map(t=>{const e=text('option',`${t.id}: ${new URL(t.url).pathname}`);e.value=t.id;return e;}));}
async function send(m){const id=Number($('tabs').value);if(!id)throw Error('Select a TeePublic tab first');const r=await chrome.tabs.sendMessage(id,m);if(r?.error)throw Error(r.error);return r;}
function refreshMatches(){
 for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];
 const matches=matchDesigns(files,rows,overrides);
 $('filesList').replaceChildren(...matches.map(match=>{
  const {file,index,rowIndex,metadata:m,error}=match;
  const card=document.createElement('article');card.className='design-match';
  const heading=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.file=index;check.checked=!unchecked.has(index);check.onchange=()=>check.checked?unchecked.delete(index):unchecked.add(index);heading.append(check,document.createTextNode(file.webkitRelativePath||file.name));
  const img=document.createElement('img');img.alt=file.name;img.src=URL.createObjectURL(file);previewUrls.push(img.src);
  const select=document.createElement('select');select.setAttribute('aria-label',`Listing for ${file.name}`);
  const empty=text('option','Choose listing row…');empty.value=-1;select.append(empty);
  rows.forEach((r,i)=>{const option=text('option',`${i+2} · ${r.filename || '(no filename)'} · ${r.title || '(no title)'}`);option.value=i;select.append(option);});
  select.value=rowIndex;select.onchange=()=>{overrides.set(index,Number(select.value));refreshMatches();};
  const status=text('p',error||'Matched · listing ready');status.className=error?'match-error':'match-ready';
  card.append(heading,img,select,status);
  if(m){const details=document.createElement('dl');for(const [label,value] of [['Title',m.title],['Description',m.description],['Main tag',m.mainTag],['Additional tags',m.tags],['Shirt mode',m.mode||'Selected default'],['Review',m.reviewStatus||'Not reviewed'],['Notes',m.notes],['Published URL',m.recordedPublishedUrl]]){details.append(text('dt',label),text('dd',value||'—'));}card.append(details);}
  return card;
 }));
 $('selection').textContent=`${files.length} PNG designs · ${matches.filter(m=>!m.error).length} matched listings · ${matches.filter(m=>m.error).length} need attention`;
}
function choose(e){files=[...e.target.files].filter(f=>/\.png$/i.test(f.name));overrides.clear();unchecked.clear();refreshMatches();}
$('folder').onchange=choose;$('files').onchange=choose;
for(const id of ['folder','files','csv'])$('choose'+id[0].toUpperCase()+id.slice(1)).onclick=()=>$(id).click();
$('csv').onchange=wrap(async()=>{
 rows=[];overrides.clear();refreshMatches();const file=$('csv').files[0];if(!file){$('sheetSelection').textContent='No listing sheet selected';return;}
 try{const imported=parseCSV(await file.text()).map(metadata);const seen=new Set();for(const r of imported){if(r.filename&&seen.has(r.filename))throw Error(`Ambiguous duplicate CSV filename: ${r.filename}`);seen.add(r.filename);}rows=imported;$('sheetSelection').textContent=`${file.name} · ${rows.length} listing rows`;refreshMatches();message('Review each design and its complete listing below, then Add selected designs.');}
 catch(e){$('sheetSelection').textContent=`${file.name}: ${e.message}`;throw e;}
});
$('downloadTemplate').onclick=()=>{
 const headers=['filename','title','description','main_tag','additional_tags','shirt_mode','mature_content','review_status','notes','published_url'];
 const records=files.map(f=>[f.name,'','','','','black','no','HOLD_REVIEW','','']);
 const quote=v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 download('TeePublic-listing-template.csv','\uFEFF'+[headers,...records].map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
};
$('enqueue').onclick=wrap(async()=>{
 if(!rows.length)throw Error('Select metadata CSV first');
 let added=0,duplicates=0;
 const indices=[...$('filesList').querySelectorAll('input:checked')].map(c=>Number(c.dataset.file));
 const candidates=validateSelection(matchDesigns(files,rows,overrides),indices);
 for(const {file,m} of candidates){if(file.size>20*1024*1024)throw Error(`${file.name}: exceeds 20 MB limit`);if(m.recordedPublishedUrl&&!/^https:\/\/www\.teepublic\.com\/t-shirt\/\d+-/.test(m.recordedPublishedUrl))throw Error('Invalid recorded published URL');}
 for(const {file,m}of candidates){const bytes=new Uint8Array(await file.arrayBuffer());if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error(`${file.name}: not a PNG`);const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(await get('items',hash)){duplicates++;continue;}await addItem({...m,file,hash,status:m.recordedPublishedUrl?'publication_unverified':'pending',mode:document.querySelector('[name=mode]:checked').value,createdAt:new Date().toISOString(),publishedUrl:'',designId:m.recordedPublishedUrl?new URL(m.recordedPublishedUrl).pathname.split('/')[2].split('-')[0]:'',lastAttempt:'',error:m.recordedPublishedUrl?'CSV records this as already published. Verify its public page; automatic upload is blocked.':''});selected.add(hash);added++;}
 await log('import',`${added} added; ${duplicates} duplicate hashes skipped`);message(`${added} added; ${duplicates} duplicates skipped`);await render();
});
$('attachDraft').onclick=wrap(async()=>{
 if(queue.running||publishing||!$('testOnly').checked)throw Error('Stop the queue and enable one-design testing first');
 const chosen=(await all('items')).filter(x=>selected.has(x.hash));if(chosen.length!==1)throw Error('Select exactly one design');
 const item=chosen[0];if(item.status==='success'||item.publishedUrl)throw Error('Published designs cannot be attached');
 const tab=await chrome.tabs.get(Number($('tabs').value));if(!/^https:\/\/www\.teepublic\.com\/designs\/\d+\/edit$/.test(tab.url||''))throw Error('Select the real existing editor tab');
 if(!confirm(`Attach ${item.filename} to existing draft ${new URL(tab.url).pathname}? Confirm this draft is unpublished and belongs to this artwork. Testing replaces its artwork and metadata without publishing.`))return;
 Object.assign(item,{reuseUploadedArtwork:item.phase>=2,draftUrl:tab.url,designId:new URL(tab.url).pathname.split('/')[2],tabId:tab.id,status:'pending',actionInFlight:false,error:''});await put('items',item);await log('attachDraft',`${item.filename}: ${item.designId}`);await render();
});
async function completeDraftListing(hash){
 if(queue.running||publishing)throw Error('Stop the active batch before completing an existing draft');
 await navigator.locks.request('tp-queue',{ifAvailable:true},async lock=>{
  if(!lock)throw Error('Another workspace owns the active queue');
  let item=await get('items',hash);if(!item)throw Error('Stored design not found');
  if(['success','publishing','publication_unverified'].includes(item.status)||item.publishedUrl||item.recordedPublishedUrl)throw Error('Check the existing publication outcome first');
  if(rows.length){
   const row=rows.find(r=>r.filename===item.filename);if(!row)throw Error(`No exact listing row for ${item.filename} in the selected sheet`);
   validateMetadata(row);if(row.recordedPublishedUrl)throw Error('Sheet records this design as already published; verify its public page first');
   item={...item,...row,mode:['light','black'].includes(row.mode)?row.mode:item.mode};await put('items',item);
  }
  validateMetadata(item);selected.add(hash);
  message(`Completing ${item.filename} in its existing draft. Artwork will not be re-uploaded; publication stays off.`);
  await log('completeDraftListing',`${item.filename}: user requested listing completion in existing draft`);
  await queue.start({mode:['light','black'].includes(item.mode)?item.mode:document.querySelector('[name=mode]:checked').value,delay:$('delay').value,testOnly:true,useCsvModes:true,selected:[hash],completeDraftHash:hash});
  const result=await get('items',hash);
  message(result.status==='review'?`${item.filename}: listing completed in the existing draft. Review the preview before publishing.`:`${item.filename}: ${result.error||result.status}. Existing draft kept for review.`);
 });
 await render();
}
$('start').onclick=wrap(async()=>{
 if(!selected.size)throw Error('Select at least one pending design');
 if(!await navigator.locks.request('tp-queue',{ifAvailable:true},async lock=>{if(!lock)return false;await queue.start({mode:document.querySelector('[name=mode]:checked').value,delay:$('delay').value,testOnly:$('testOnly').checked,useCsvModes:$('csvModes').checked,selected:[...selected]});return true;}))throw Error('Another workspace tab owns the queue');
});
$('pause').onclick=wrap(()=>queue.pause());$('resume').onclick=wrap(()=>queue.resume());$('stop').onclick=wrap(stopBulk);
async function stopBulk(){
 await queue.stop();$('enablePublishing').checked=false;$('reviewed').checked=false;$('acceptTerms').checked=false;
 message('Bulk auto upload stopped. No further upload steps or publications will start. An action already sent may finish; submitted publications are still verified.');await render();
}
$('stopPublishing').onclick=wrap(stopBulk);
$('checkDuplicate').onclick=wrap(async()=>{
 if(queue.running||publishing)throw Error('Wait for the queue to stop');const items=(await all('items')).filter(i=>selected.has(i.hash));if(items.length!==1)throw Error('Select exactly one stored design');
 const i=items[0];const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await i.file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==i.hash)throw Error('Stored PNG hash mismatch');
 try{await addItem(i);}catch(e){if(e.name!=='ConstraintError')throw e;await log('duplicateTest',`${i.filename}: SHA-256 and IndexedDB duplicate rejection verified`,{success:true});message('Duplicate protection verified. Existing history preserved.');return;}
 throw Error('Duplicate rejection failed');
});
$('retry').onclick=wrap(async()=>{
 if(queue.running||publishing)throw Error('Stop the queue first');
 const failed=(await all('items')).filter(x=>['failed','stopped'].includes(x.status)&&selected.has(x.hash));
 if(!failed.length)throw Error('Select failed items to review');
 for(const i of failed){
  // A site draft means retrying the creation step could duplicate server-side artwork.
  if(i.draftUrl||i.actionInFlight){message(`Open and review ${i.filename}'s existing draft. Automatic retry is blocked to prevent duplicates.`);continue;}
  if(!confirm(`Retry ${i.filename}? Confirm no upload was created on TeePublic.`))continue;
  i.status='pending';i.error='';await put('items',i);
 }
 await render();
});
async function changeSuccessVisibility(scope,hidden){
 if(queue.running||publishing)throw Error('Stop the active batch first');
 let count=0;
 await navigator.locks.request('tp-queue',{ifAvailable:true},async lock=>{
  if(!lock)throw Error('Another workspace owns the active queue');
  for(const item of await all('items')){
   if(item.status!=='success'||(scope==='selected'&&!selected.has(item.hash))||Boolean(item.hiddenFromQueue)===hidden)continue;
   item.hiddenFromQueue=hidden;
   if(hidden){item.deletedFromListAt=new Date().toISOString();selected.delete(item.hash);}else delete item.deletedFromListAt;
   await put('items',item);count++;
  }
 });
 await log(hidden?'successRemovedFromList':'successRestoredToList',`${count} successful designs; published URLs and duplicate history preserved`);
 await render();message(`${count} successful designs ${hidden?'removed from the list':'restored'}. Published designs and duplicate protection are preserved.`);
}
$('deleteAllSuccess').onclick=wrap(()=>changeSuccessVisibility('all',true));
$('restoreSuccess').onclick=wrap(()=>changeSuccessVisibility('all',false));
$('allItems').onchange=async()=>{for(const i of await all('items')){if($('allItems').checked&&i.status==='pending')selected.add(i.hash);else selected.delete(i.hash);}await render();};
$('refreshTabs').onclick=wrap(tabs);$('editor').onclick=()=>chrome.tabs.create({url:'https://www.teepublic.com/design/quick_create'});
$('role').replaceChildren(...ROLES.map(r=>{const e=text('option',r);e.value=r;return e;}));
$('inventory').onclick=wrap(async()=>{const r=await send({type:'inventory'});download('teepublic-dom-inventory.json',JSON.stringify(r,null,2));message(`${r.elements.length} real elements captured`);});
$('publicInventory').onclick=wrap(async()=>{const r=await send({type:'publicInventory'});download('teepublic-public-inventory.json',JSON.stringify(r,null,2));message('Actual public-page markers captured');});
$('verifyPublished').onclick=wrap(async()=>{if(queue.running||publishing)throw Error('Wait for the active operation');const chosen=(await all('items')).filter(i=>selected.has(i.hash));if(chosen.length!==1)throw Error('Select exactly one stored design');const p=await get('settings','profile');await verifyPublished(chosen[0],Number($('tabs').value),p);await render();message('Publication verified from actual public URL and matching title');});
$('publishSelected').onclick=wrap(async()=>{
 if(queue.running||publishing)throw Error('Another operation is running');
 if(!$('enablePublishing').checked||!$('reviewed').checked||!$('acceptTerms').checked)throw Error('Enable publishing, confirm the content/product review, and explicitly accept TeePublic and Dashery terms for this selection');
 const chosen=(await all('items')).filter(i=>selected.has(i.hash));if(!chosen.length||chosen.some(i=>i.status!=='review'))throw Error('Select only reviewed, unpublished drafts');
 if(!confirm(`Publish ${chosen.length} reviewed design(s) to TeePublic and accept TeePublic/Dashery terms for these designs?\n${chosen.map(i=>i.filename+' — '+i.title).join('\n')}`))return;
 if($('testOnly').checked&&chosen.length>1)throw Error('One-design testing blocks bulk publication');const p=await get('settings','profile');queue.stopped=false;queue.paused=false;publishing=true;
 try{await navigator.locks.request('tp-queue',{ifAvailable:true},async lock=>{if(!lock)throw Error('Another workspace owns the queue');await publishReviewed(chosen,p,{acceptTerms:true,checkpoint:()=>queue.checkpoint(),update:()=>render()});});}finally{publishing=false;$('enablePublishing').checked=false;$('reviewed').checked=false;$('acceptTerms').checked=false;await render();}
});
$('autoPublish').onclick=wrap(async()=>{
 if(queue.running||publishing)throw Error('Another operation is running');
 const options={mode:document.querySelector('[name=mode]:checked').value,delay:$('delay').value,testOnly:$('testOnly').checked,useCsvModes:$('csvModes').checked,selected:[...selected],approved:$('enablePublishing').checked,reviewed:$('reviewed').checked,acceptTerms:$('acceptTerms').checked};
 const items=await all('items'),profile=await get('settings','profile');
 const batch=planAutoBatch(items,profile,options);
 if(!confirm(`Automatically upload and publish these ${batch.length} design(s) to TeePublic, accepting TeePublic/Dashery terms for this batch? Each design uses its assigned complete listing. No further confirmation will be requested. The run stops on errors or uncertain publication.\n\n${batch.map(i=>i.filename+' — '+i.title).join('\n')}`))return;
 publishing=true;
 try{await navigator.locks.request('tp-queue',{ifAvailable:true},async lock=>{if(!lock)throw Error('Another workspace owns the queue');message(`Auto upload & publish: ${batch.length} approved designs. Keep this workspace open.`);await runAutoBatch(queue,items,profile,options);});message(queue.stopped?'Bulk auto upload stopped. Remaining designs were not started. Check the current design status.':'Automatic run finished. Check each queue status and published URL.');}
 finally{publishing=false;$('enablePublishing').checked=false;$('reviewed').checked=false;$('acceptTerms').checked=false;await render();}
});
$('testColor').onclick=wrap(async()=>{
 if(queue.running||publishing)throw Error('Stop queue first');const p=await get('settings','profile');const mode=document.querySelector('[name=mode]:checked').value;const evidence=[];
 if(p.palette?.[mode])evidence.push(await send({type:'execute',step:{role:'palette',action:'palette',selector:p.palette[mode].selector,value:mode==='black'?'Dark':'Light'}}));
 for(const group of ['tshirt','baseballtee'].flatMap(product=>(p.apparelColors||[]).filter(g=>g.product===product))){
  const option=mode==='black'?group.black:group.white;if(!option){evidence.push({product:group.product,needsManualReview:'White unavailable in recorded choices'});continue;}
  const checked=await send({type:'validateProfile',selectors:{menu:{selector:group.menu},option:{selector:option}}});
  const expected=mode==='black'?group.blackLabel:'White';if(!checked.results.menu.unique||!checked.results.option.unique||checked.results.option.text!==expected)throw Error(`Unverified color choice for ${group.product}`);
  await send({type:'execute',step:{role:'colorMenu',action:'click',selector:group.menu}});
  await send({type:'execute',step:{role:mode==='black'?'black':'white',action:'click',selector:option}});
  const result=await send({type:'execute',step:{role:'colorState',action:'color',selector:group.menu,value:expected}});evidence.push({product:group.product,expected,result});
 }
 download('teepublic-all-apparel-color-test.json',JSON.stringify(evidence,null,2));message(`${mode}: T-Shirt then Baseball Tee configured; other apparel inherit T-Shirt color. Review any unavailable colors`);await log('allApparelColorTest',mode,{success:true});
});
$('validateProfile').onclick=wrap(async()=>{const p=await get('settings','profile');const r=await send({type:'validateProfile',selectors:p.selectors});download('teepublic-selector-validation.json',JSON.stringify(r,null,2));message(Object.values(r.results).every(x=>x.unique)?'All selectors match unique real elements.':'Selector validation failed; inspect diagnostics.');});
$('loadProfile').onclick=wrap(async()=>{if(queue.running||publishing)throw Error('Stop queue first');const p=await fetch(chrome.runtime.getURL('selectors.json')).then(r=>r.json());await put('settings',{...p,entryUrl:'https://www.teepublic.com/design/quick_create'},'profile');await render();message('Packaged selector profile loaded');});
$('bind').onclick=wrap(async()=>{if(queue.running||publishing)throw Error('Stop the queue before recording');await send({type:'bind',role:$('role').value});await chrome.tabs.update(Number($('tabs').value),{active:true});message('Select the actual control on TeePublic. Binding does not activate it.');});
$('record').onclick=wrap(async()=>{const p=await get('settings','profile');await send({type:'record',enabled:true,selectors:p?.selectors});message('Recording bound fields. Switch to TeePublic.');});
$('endRecord').onclick=wrap(async()=>{await send({type:'record',enabled:false});message('Recording stopped');});
$('verify').onclick=wrap(async()=>{const p=await get('settings','profile');if(!p)throw Error('Bind elements first');p.status='VERIFIED';assertProfile(p,'light');assertProfile(p,'black');if(!confirm('Have you tested these bindings on one fresh draft, checked both colors and the actual preview, and reviewed tag behavior? This enables preparation only.'))return;await put('settings',p,'profile');await log('profileReview','Preparation enabled by user; publication remains locked');await render();});
$('exportResults').onclick=wrap(async()=>download('teepublic-results.csv',csvExport(await all('items')),'text/csv;charset=utf-8'));
$('exportLogs').onclick=wrap(async()=>download('diagnostics.json',JSON.stringify(await all('logs'),null,2)));
$('exportWorkflow').onclick=wrap(async()=>{const p=await get('settings','profile')||{status:'HOLD_RECORDING',selectors:{}};download('selectors.json',JSON.stringify({version:1,status:p.status,selectors:p.selectors},null,2));setTimeout(()=>exportRecordedWorkflow(p),300);});
async function exportRecordedWorkflow(p){const recordedActions=(await all('logs')).filter(x=>['record','step','bind'].includes(x.action)).map((x,i)=>({step:i+1,actionType:x.actionType||x.action,selector:x.selector,targetField:x.targetField||x.detail,selectedValue:x.selectedValue,timestamp:x.timestamp,success:x.success??null,error:x.error||''}));download('workflow.json',JSON.stringify({...p,steps:recordedActions},null,2));}
async function render(){
 const items=(await all('items')).filter(i=>!i.hiddenFromQueue);$('queue').replaceChildren();
 for(const i of items){const tr=document.createElement('tr'),c=document.createElement('input');c.type='checkbox';c.checked=selected.has(i.hash);c.onchange=()=>c.checked?selected.add(i.hash):selected.delete(i.hash);const td=document.createElement('td');td.append(c);tr.append(td);const title=text('td',i.filename);title.append(text('small',i.title));tr.append(title,text('td',i.mode),text('td',i.status));const link=document.createElement('td');if(i.publishedUrl||i.draftUrl){
  if(i.draftUrl&&!i.publishedUrl&&!i.recordedPublishedUrl&&!['success','publishing','publication_unverified'].includes(i.status)){
   const complete=text('button','Open draft & Complete listing');complete.type='button';complete.disabled=queue.running||publishing;complete.onclick=wrap(()=>completeDraftListing(i.hash));link.append(complete);
   const view=text('a','View only');view.href=i.draftUrl;view.target='_blank';view.rel='noopener';link.append(text('small',''),view);
  }else{const a=text('a',i.publishedUrl?'Published':'Open draft — Review outcome');a.href=i.publishedUrl||i.draftUrl;a.target='_blank';a.rel='noopener';link.append(a);}
 }tr.append(link,text('td',i.error||''));$('queue').append(tr);}
 const counts={};for(const i of items)counts[i.status]=(counts[i.status]||0)+1;
 for(const k of ['success','failed','pending','review'])$(k).textContent=k==='review'?(counts.review||0)+(counts.publication_unverified||0):counts[k]||0;
 $('progress').max=Math.max(1,items.length);$('progress').value=items.filter(x=>['review','success','failed','stopped'].includes(x.status)).length;
 $('start').disabled=queue.running||publishing;$('enqueue').disabled=queue.running||publishing;$('publishSelected').disabled=queue.running||publishing;$('autoPublish').disabled=queue.running||publishing;$('stopPublishing').disabled=!publishing||queue.stopped;
 for(const id of ['deleteAllSuccess','restoreSuccess'])$(id).disabled=queue.running||publishing;
 const p=await get('settings','profile');$('bindings').textContent=p?JSON.stringify(p,null,2):'HOLD_RECORDING: no DOM selectors bound';
 const logs=await all('logs');$('logs').textContent=logs.slice(-100).reverse().map(l=>`${l.timestamp}  ${l.action}  ${l.detail}`).join('\n');
}
if(!await get('settings','profile')){const [w,b]=await Promise.all([fetch(chrome.runtime.getURL('workflow.json')).then(r=>r.json()),fetch(chrome.runtime.getURL('selectors.json')).then(r=>r.json())]);await put('settings',{version:1,status:b.status,entryUrl:w.entryUrl,selectors:b.selectors,apparelColors:b.apparelColors,palette:b.palette,colorChecks:b.colorChecks,publication:b.publication},'profile');}
await navigator.locks.request('tp-queue',{ifAvailable:true},async lock=>{if(lock)await recoverInterrupted();});
await tabs();await render();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!queue.running)render().catch(e=>message(e.message));});
window.addEventListener('beforeunload',e=>{if(queue.running||publishing){e.preventDefault();e.returnValue='Queue is active';}});
