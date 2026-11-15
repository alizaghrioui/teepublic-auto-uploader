import {get,put,log} from './db.js';
import {ROLES} from './core.js';
import './workspace.js';
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 (async()=>{
  if(sender.id!==chrome.runtime.id)throw Error('Invalid sender');
  if(m.type==='requestPublishToken'){
   if(sender.url!==chrome.runtime.getURL('dashboard.html')||m.confirmed!==true)throw Error('Publication requires explicit approval from the workspace');
   const profile=await get('settings','profile');if(!profile?.publication?.verifiedAt)throw Error('Unverified publication workflow');
   const item=await get('items',m.hash);if(!item||item.status!=='review'||item.tabId!==m.tabId||item.publishedUrl)throw Error('Draft is not eligible for publication');
   if(item.excludeKids)throw Error('No Kids Youth restriction requires a separately verified product-disable workflow');
   const tab=await chrome.tabs.get(m.tabId);if(tab.url!==item.draftUrl)throw Error('Draft identity changed');
   const token=crypto.randomUUID();item.status='publishing';item.lastAttempt=new Date().toISOString();item.contentReviewedAt=item.lastAttempt;await put('items',item);
   await chrome.storage.session.set({['publish:'+token]:{hash:item.hash,tabId:item.tabId,designId:item.designId,acceptTerms:m.acceptTerms===true,expires:Date.now()+60000}});
   await log('publicationApproved',item.filename);return {token,item:{status:item.status,lastAttempt:item.lastAttempt,contentReviewedAt:item.contentReviewedAt}};
  }
  if(m.type==='consumePublishToken'){
   if(!sender.tab)throw Error('Only the target editor can consume approval');
   const key='publish:'+String(m.token);const result=await chrome.storage.session.get(key);const approval=result[key];
   if(!approval||approval.expires<Date.now()||approval.tabId!==sender.tab.id||new URL(sender.url).pathname!==`/designs/${approval.designId}/edit`)throw Error('Publication approval is absent, expired, or for another editor');
   const item=await get('items',approval.hash);if(item.status!=='publishing')throw Error('Publication state changed');
   await chrome.storage.session.remove(key);return {ok:true,acceptTerms:approval.acceptTerms};
  }
  if(m.type==='recordBinding'){
   if(!sender.tab || !/^https:\/\/www\.teepublic\.com\/designs\/\d+\/edit$/.test(sender.url||'')||!ROLES.includes(m.role))throw Error('Invalid recording context');
   const b=m.binding;if(!b||typeof b.selector!=='string'||b.selector.length>2000)throw Error('Invalid binding');
   const p=await get('settings','profile')||{version:1,status:'HOLD_RECORDING',entryUrl:'https://www.teepublic.com/design/quick_create',selectors:{}};
   if(['paletteDark','paletteLight'].includes(m.role)){p.palette??={};p.palette[m.role==='paletteDark'?'black':'light']={selector:b.selector,verifiedAt:new Date().toISOString()};}
   p.status='HOLD_RECORDING';p.selectors[m.role]={selector:b.selector,tag:b.tag,type:b.type,verifiedAt:new Date().toISOString(),path:new URL(sender.url).pathname};
   await put('settings',p,'profile');await log('bind',m.role,{selector:b.selector,success:true});return {ok:true};
  }
  if(m.type==='recordAction'){
   if(!sender.tab)throw Error('Invalid recorder');
   // Accept only the narrow recorder schema: never persist arbitrary page messages.
   if(!ROLES.includes(m.role))throw Error('Invalid field');
   await log('record',m.role,{selector:String(m.selector).slice(0,2000),actionType:['click','change','input'].includes(m.action)?m.action:'change',targetField:m.role,selectedValue:String(m.value||'').slice(0,4000),success:null,error:'Observed action; outcome not verified'});return {ok:true};
  }
  throw Error('Unknown message');
 })().then(reply,e=>reply({error:e.message}));return true;
});
