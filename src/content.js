(() => {
 const roles=['file','uploadReady','title','description','mainTag','tags','matureNo','colorMenu','white','black','colorState','preview','publish','publishedLink','terms','paletteDark','paletteLight'];
 let binding=null, recording=false, bindings={}, busy=false;
 const editable=()=>/^\/designs\/\d+\/edit$/.test(location.pathname);
 const sensitive=el=>!el||/password|email|hidden/.test(el.type||'')||/pass|token|secret|cookie|session|email|address|payment|credit/i.test([el.name,el.id,el.autocomplete].join(' '));
 function unique(s){try{return document.querySelectorAll(s).length===1;}catch{return false;}}
 function selector(el){
  if(sensitive(el))throw Error('Sensitive element excluded');
  const tag=el.localName;
  if(el.id&&unique('#'+CSS.escape(el.id)))return '#'+CSS.escape(el.id);
  for(const a of ['name','data-testid','aria-label','placeholder']){
   const v=el.getAttribute(a);if(v&&v.length<150&&!/[@\r\n]/.test(v)){const s=tag+'['+a+'='+JSON.stringify(v)+']';if(unique(s))return s;}
  }
  let s=tag,node=el;
  for(let i=0;i<10&&node.parentElement;i++){
   const parent=node.parentElement;const index=[...parent.children].filter(x=>x.localName===node.localName).indexOf(node)+1;
   s=node.localName+`:nth-of-type(${index})`+(i?' > '+s:'');
   if(unique(s))return s;
   node=parent;
  }
  throw Error('No unique selector; choose a more specific element');
 }
 function target(s,{hidden=false}={}){
  const els=document.querySelectorAll(s);if(els.length!==1)throw Error(`Selector matched ${els.length} elements; re-record it`);
  const el=els[0];if(sensitive(el))throw Error('Sensitive element excluded');
  if(!hidden&&(!el.getClientRects().length||getComputedStyle(el).visibility==='hidden'))throw Error('Target not visible');
  return el;
 }
 function guard(){
  if(!editable())throw Error('Not a TeePublic design editor');
  const t=document.body.innerText;
  if(/verify you are human|unusual traffic|too many requests|access denied|complete the captcha|security check/i.test(t))throw Error('Protection detected: stop and review manually');
  if(document.querySelector('iframe[src*="captcha"],iframe[src*="challenge"]')?.getClientRects().length)throw Error('Challenge detected: manual review required');
 }
 async function wait(s,timeout=120000){const start=Date.now();while(Date.now()-start<timeout){guard();try{const el=target(s);if(!/UPLOADING|PROCESSING/.test(document.body.innerText))return el;}catch{}await new Promise(r=>setTimeout(r,400));}throw Error('Timeout waiting for recorded completion state');}
 function fill(el,value,verify=true){
  if(!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||['checkbox','radio','file'].includes(el.type))throw Error('Field is not a supported plain input');
  const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.blur();
  if(verify&&el.value!==value)throw Error('Field value verification failed');if(verify&&el.checkValidity&&!el.checkValidity())throw Error('Field validation failed: '+el.validationMessage);
 }
 const notice=document.createElement('div');
 function show(text){notice.textContent=text;Object.assign(notice.style,{position:'fixed',bottom:'18px',left:'18px',zIndex:'2147483647',background:'#111b2f',color:'white',padding:'14px 20px',borderRadius:'12px',maxWidth:'430px',font:'14px system-ui',boxShadow:'0 5px 25px #0008'});notice.dataset.tpRecorder='true';document.documentElement.append(notice);}
 async function revealWork(el,role){
  const labels={file:'Uploading artwork',uploadReady:'Waiting for upload processing',title:'Filling title',description:'Filling description',mainTag:'Filling main tag',tags:'Adding supporting tags',matureNo:'Setting content category',palette:'Selecting product colors',colorMenu:'Opening default color',white:'Selecting light default',black:'Selecting black default',colorState:'Checking selected color',preview:'Checking preview',terms:'Accepting approved terms',publish:'Publishing approved design'};
  show('Auto Uploader · '+(labels[role]||'Working on design'));
  notice.style.pointerEvents='none';
  const visible=el.getClientRects().length?el:el.parentElement;
  if(!visible)return;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  visible.scrollIntoView({behavior:reduce?'instant':'smooth',block:['white','black'].includes(role)?'nearest':'center',inline:'nearest'});
  await new Promise(r=>setTimeout(r,reduce?80:350));
 }
 async function saveBinding(role,el){const b={selector:selector(el),tag:el.tagName,type:el.type||''};const r=await chrome.runtime.sendMessage({type:'recordBinding',role,binding:b});if(r.error)throw Error(r.error);bindings[role]=b;show(`Bound ${role}. Return to the extension. Selector is unique on this page.`);}
 document.addEventListener('click',event=>{
  if(!binding)return;
  event.preventDefault();event.stopImmediatePropagation();
  const role=binding;binding=null;
  let el=event.target.closest('input,textarea,select,button,a,[role="button"],img')||event.target;
  if(el===notice)return;
  saveBinding(role,el).catch(e=>show(e.message));
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){binding=null;recording=false;notice.remove();}},true);
 for(const action of ['click','change'])document.addEventListener(action,e=>{
  if(!recording||binding||sensitive(e.target))return;
  for(const [role,b]of Object.entries(bindings)){
   // Record only specifically bound metadata and colors, never arbitrary account fields.
   if(role==='publishedLink')continue;
   if(!e.target.matches(b.selector))continue;
   const value=role==='file'?e.target.files?.[0]?.name:['title','description','mainTag','tags'].includes(role)?e.target.value:role==='terms'?String(e.target.checked):undefined;
   chrome.runtime.sendMessage({type:'recordAction',role,selector:b.selector,action,value}).catch(()=>{});
  }
 },true);
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  (async()=>{
   if(sender.id!==chrome.runtime.id)throw Error('Invalid sender');
   if(m.type==='publicInventory'){
    if(location.origin!=='https://www.teepublic.com'||editable())throw Error('Open the real public design page');
    return {url:location.href,capturedAt:new Date().toISOString(),elements:[...document.querySelectorAll('h1,link[rel="canonical"]')].map(el=>({selector:selector(el),tag:el.tagName,text:el.textContent.trim(),href:el.href||''}))};
   }
   if(m.type==='verifyPublication'){
    const {expected,profile}=m;const u=new URL(location.href);
    if(u.origin!=='https://www.teepublic.com'||!u.pathname.startsWith(profile.pathPrefix)||!u.pathname.split(/\D+/).includes(String(expected.designId))||editable())throw Error('Not the expected published design URL');
    const heading=target(profile.headingSelector);const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(!normalize(heading.textContent).startsWith(normalize(expected.title)))throw Error('Published title does not match the queued design');
    const canonical=document.querySelector('link[rel="canonical"]')?.href||u.href;const c=new URL(canonical);if(c.origin!==u.origin||!c.pathname.split(/\D+/).includes(String(expected.designId)))throw Error('Canonical identity mismatch');
    return {verified:true,url:c.origin+c.pathname,title:heading.textContent.trim(),designId:expected.designId};
   }
   if(m.type==='publishApproved'){
    guard();if(busy)throw Error('Editor is busy');busy=true;
    try{
     const approval=await chrome.runtime.sendMessage({type:'consumePublishToken',token:m.token});if(approval.error)throw Error(approval.error);
     if(new URL(location.href).pathname!==`/designs/${m.item.designId}/edit`)throw Error('Wrong editor');
     for(const [role,value]of [['title',m.item.title],['description',m.item.description],['mainTag',m.item.mainTag]]){const el=target(m.selectors[role].selector);if(el.value.trim()!==value.trim())throw Error(`Publication blocked: ${role} changed`);}
     const tags=m.item.tags.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);const committed=document.querySelector('#secondary_tags ul.taggle_list')?.innerText.toLowerCase()||'';
     if(!tags.every(t=>committed.includes(t)))throw Error('Publication blocked: supporting tags are not committed');
     for(const group of m.apparelColors||[]){const expected=m.item.mode==='black'?group.blackLabel:(group.whiteLabel||'White');if(m.item.mode==='light'&&!group.white)throw Error(`Review light-color availability for ${group.product}`);if(!target(group.menu).textContent.includes(expected))throw Error(`Publication blocked: default color for ${group.product}`);}
     if(m.colorChecks?.White&&m.colorChecks?.Black){const white=target(m.colorChecks.White,{hidden:true}),black=target(m.colorChecks.Black,{hidden:true});if(m.item.mode==='black'&&(!black.checked||white.checked))throw Error('Publication blocked: Dark palette does not match Black Shirt');if(m.item.mode==='light'&&!white.checked)throw Error('Publication blocked: Light palette is not enabled');}
     const terms=target(m.selectors.terms.selector);await revealWork(terms,'terms');if(!terms.checked){if(!approval.acceptTerms)throw Error('Explicit legal-terms acceptance required');terms.click();}if(!terms.checked)throw Error('Terms acceptance did not apply');
     const publish=target(m.selectors.publish.selector);await revealWork(publish,'publish');if(publish.disabled||!publish.form?.reportValidity())throw Error('Publication form is invalid');publish.click();return {dispatched:true};
    }finally{busy=false;}
   }
   if(m.type==='validateProfile'){guard();return {path:location.pathname,results:Object.fromEntries(Object.entries(m.selectors).map(([role,b])=>{try{const e=target(b.selector,{hidden:true});return [role,{unique:true,tag:e.tagName,type:e.type||'',visible:!!e.getClientRects().length,text:(e.innerText||'').trim().slice(0,150)}];}catch(e){return [role,{unique:false,error:e.message}];}}))};}
   if(m.type==='inventory'){
    guard();
    const elements=[];const palette=[];for(const el of document.querySelectorAll('button,a,span,label,div')){const text=(el.innerText||'').trim();if(['All','Light','Dark','None'].includes(text)&&el.children.length<2&&el.closest('form.edit_design')){try{palette.push({label:text,selector:selector(el),tag:el.tagName,attributes:Object.fromEntries([...el.attributes].map(a=>[a.name,a.value])),parentId:el.parentElement.id,parentClass:el.parentElement.className});}catch{}}}
    for(const el of document.querySelectorAll('input,textarea,select,button,a,img')){
     if(sensitive(el)||!el.closest('form.edit_design'))continue;
     const label=(el.innerText||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim();
     if(el.tagName==='A'&&!/^(White|Black|Select Default Color|Change Artwork)$/.test(label))continue;
     if(el.tagName==='BUTTON'&&!/^(PUBLISH|SAVE FOR LATER)$/.test(label))continue;
     if(el.tagName==='IMG'&&!el.closest('form'))continue;
     try{elements.push({selector:selector(el),tag:el.tagName,type:el.type||'',name:el.name||'',id:el.id,placeholder:el.getAttribute('placeholder'),label:label.slice(0,100),visible:!!el.getClientRects().length,siblings:[...el.parentElement.children].slice(0,20).filter(x=>!sensitive(x)).map(x=>({tag:x.tagName,className:x.className,text:(x.innerText||'').trim().slice(0,80)})),parents:[el.parentElement,el.parentElement?.parentElement,el.parentElement?.parentElement?.parentElement].filter(Boolean).map(p=>({tag:p.tagName,id:p.id,className:p.className,text:(p.innerText||'').trim().slice(0,120)}))});}catch{}
    }
    return {path:location.pathname,capturedAt:new Date().toISOString(),palette,colorChecks:[...document.querySelectorAll('input[name="additional_colors[]"]')].map(e=>({selector:selector(e),id:e.id,checked:e.checked,title:document.querySelector('label[for='+JSON.stringify(e.id)+']')?.getAttribute('title')||'',className:e.className})),elements};
   }
   if(m.type==='bind'){
    guard();if(!roles.includes(m.role))throw Error('Unknown role');
    if(m.role==='file'){
     const files=[...document.querySelectorAll('input[type="file"]')];if(files.length!==1)throw Error(`Found ${files.length} file inputs. Cannot infer upload target.`);
     await saveBinding('file',files[0]);
    }else{binding=m.role;show(`Select the actual ${m.role} element. This click only records; Escape cancels.`);}
    return {ok:true};
   }
   if(m.type==='record'){bindings=m.selectors||{};recording=!!m.enabled;show(recording?'Recording bound metadata and color controls. Escape stops.':'Recording stopped');return {ok:true};}
   if(m.type==='execute'){
    if(busy)throw Error('An action is already running');busy=true;
    try{
     guard();const {action,selector:s,value}=m.step;let el;
     if(action==='wait'){show('Auto Uploader · Waiting for upload processing');const ready=await wait(s);await revealWork(ready,'uploadReady');return {verified:true};}
     el=target(s,{hidden:action==='file'});await revealWork(el,m.step.role);
     if(action==='file'){
      if(el.type!=='file')throw Error('Recorded target is not a file input');
      if(!m.file?.data||!m.file.name.endsWith('.png'))throw Error('PNG missing');
      const bytes=Uint8Array.from(atob(m.file.data),c=>c.charCodeAt(0));
      const dt=new DataTransfer();dt.items.add(new File([bytes],m.file.name,{type:'image/png'}));el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));
      return {dispatched:true};
     }
     if(action==='palette'){
      if(!['Dark','Light'].includes(value)||(el.textContent||'').trim()!==value)throw Error('Palette control does not match selected mode');
      const inputs=[...document.querySelectorAll('input[name="additional_colors[]"]')];if(!inputs.length)throw Error('Product color inputs missing');
      const before=inputs.map(e=>e.checked);el.click();const after=inputs.map(e=>e.checked);
      return {dispatched:true,palette:value,selectedCount:after.filter(Boolean).length,changedCount:after.filter((v,i)=>v!==before[i]).length,requiresHumanReview:true};
     }
     if(action==='tags'){
      const tokens=value.split(',').map(x=>x.trim()).filter(Boolean);
      fill(el,value,false);el.focus();
      for(const type of ['keydown','keypress','keyup'])el.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
      await new Promise(r=>setTimeout(r,200));
      const list=document.querySelector('#secondary_tags ul.taggle_list');
      if(!list||el.value.trim()||!tokens.every(t=>list.innerText.toLowerCase().includes(t.toLowerCase())))throw Error('Supporting tag commitment could not be verified; inspect actual tokens');
      return {verified:true,tokens};
     }
     if(action==='fill'){fill(el,value);return {verified:true};}
     if(action==='click'){
      // Publication and legal acceptance deliberately have no automation handler in this recording build.
      if(!['matureNo','colorMenu','white','black'].includes(m.step.role))throw Error('Click role is not allowed');
      if(el.disabled)throw Error('Control disabled');el.click();if(m.step.role==='matureNo'&&el.type==='radio'){if(!el.checked)throw Error('Mature-content choice did not apply');return {verified:true};}return {dispatched:true};
     }
     if(action==='color'){
      const actual=(el.textContent||el.value||el.getAttribute('aria-label')||'').trim();
      if(!new RegExp(`\\b${value}\\b`,'i').test(actual))throw Error(`Expected default ${value}, found ${actual}`);
      return {verified:true};
     }
     if(action==='preview'){
      if(el.tagName==='IMG'&&(!el.complete||!el.naturalWidth))throw Error('Preview image has not loaded');
      return {verified:true,requiresHumanReview:true};
     }
     throw Error('Unsupported action');
    }finally{busy=false;}
   }
   throw Error('Unknown command');
  })().then(reply,e=>reply({error:e.message}));return true;
 });
})();
