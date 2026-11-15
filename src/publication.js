import {get,put,log} from './db.js';
import {sleep} from './core.js';
async function closeVerifiedTab(item,tabId){
 // Only close the exact verified result tab. Keep errors and unrelated pages open.
 try{
  const tab=await chrome.tabs.get(tabId);
  if(tab.url!==item.publishedUrl)return;
  await chrome.tabs.remove(tabId);
  await log('publishedTabClosed',`${item.filename}: ${item.publishedUrl}`,{success:true});
 }catch(e){await log('tabCloseError',`${item.filename}: ${e.message}`,{success:false,error:e.message});}
}
export async function verifyPublished(item,tabId,profile){
 if(!profile.publication?.verifiedAt)throw Error('Publication verification profile is not recorded');
 const tab=await chrome.tabs.get(tabId);
 const r=await chrome.tabs.sendMessage(tabId,{type:'verifyPublication',expected:{designId:item.designId,title:item.title},profile:profile.publication});
 if(r?.error)throw Error(r.error);if(!r?.verified)throw Error('Publication not verified');
 if(item.status==='success'&&item.publishedUrl===r.url){await closeVerifiedTab(item,tabId);return r;}item.status='success';item.publishedUrl=r.url;item.error='';item.publishedAt=new Date().toISOString();await put('items',item);await log('publishedVerified',`${item.filename}: ${r.url}`,{success:true});await closeVerifiedTab(item,tabId);return r;
}
export async function publishReviewed(items,profile,{acceptTerms=false,checkpoint=async()=>{},update=()=>{}}={}){
 if(!profile.publication?.verifiedAt)throw Error('First publication success page must be recorded before automated publication');
 for(const item of items){
  await checkpoint();if(item.status!=='review')throw Error('Only reviewed unpublished drafts may be submitted');
  const tab=await chrome.tabs.get(item.tabId);if(tab.url!==item.draftUrl)throw Error('Editor identity changed; review it first');
  const token=await chrome.runtime.sendMessage({type:'requestPublishToken',hash:item.hash,tabId:item.tabId,confirmed:true,acceptTerms});if(token.error)throw Error(token.error);
  // From this point, uncertainty is never retried automatically.
  Object.assign(item,token.item);update();
  try{await chrome.tabs.sendMessage(item.tabId,{type:'publishApproved',token:token.token,selectors:profile.selectors,apparelColors:profile.apparelColors,palette:profile.palette,colorChecks:profile.colorChecks,item:{designId:item.designId,title:item.title,description:item.description,mainTag:item.mainTag,tags:item.tags,mode:item.mode}});}catch{}
  const deadline=Date.now()+120000;let verified=false,lastError='No confirmed public page';
  while(Date.now()<deadline){
   try{await verifyPublished(item,item.tabId,profile);verified=true;break;}catch(e){lastError=e.message;}
   await sleep(1000);
  }
  if(!verified){item.status='publication_unverified';item.error=`Submission outcome requires manual review. Never resubmit blindly. ${lastError}`;await put('items',item);await log('publicationUnverified',item.filename,{success:false,error:item.error});}
  update();if(!verified)break;
 }
}
