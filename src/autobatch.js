import {assertProfile,validateMetadata} from './core.js';
import {publishReviewed} from './publication.js';

export function planAutoBatch(items,profile,options){
 if(options.approved!==true||options.reviewed!==true||options.acceptTerms!==true)throw Error('Approve this batch, review the artwork/listings and accept TeePublic/Dashery terms first');
 const candidates=items.filter(i=>options.selected.includes(i.hash)&&i.status==='pending');
 const batch=options.testOnly?candidates.slice(0,1):candidates;
 if(!batch.length)throw Error('Select at least one pending design');
 if(!profile?.publication?.verifiedAt||!profile.selectors?.publish?.selector||!profile.selectors?.terms?.selector)throw Error('Load the verified packaged publication profile before automatic publishing');
 for(const item of batch){
  validateMetadata(item);
  if(item.publishedUrl||item.recordedPublishedUrl)throw Error(`${item.filename}: already has a published URL; verify existing publication first`);
  if(item.excludeKids)throw Error(`${item.filename}: No Kids Youth requires a verified product-disable workflow`);
  const mode=options.useCsvModes&&['light','black'].includes(item.mode)?item.mode:options.mode;
  assertProfile(profile,mode);
  if(mode==='light'&&profile.apparelColors?.some(g=>!g.white))throw Error(`${item.filename}: some products have no verified White default; prepare and review manually`);
 }
 return batch;
}

export async function runAutoBatch(queue,items,profile,options){
 const batch=planAutoBatch(items,profile,options);
 const hashes=new Set(batch.map(i=>i.hash));
 await queue.start({...options,selected:[...hashes],failFast:true,onPrepared:async(item,currentProfile)=>{
  if(!hashes.has(item.hash))throw Error('Design is outside the approved batch');
  await publishReviewed([item],currentProfile,{acceptTerms:true,checkpoint:()=>queue.checkpoint(),update:()=>queue.update()});
 }});
 return batch;
}
