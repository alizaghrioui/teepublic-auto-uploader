import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {assertProfile,validateMetadata} from '../src/core.js';
const source=(await fs.readFile(new URL('../src/autobatch.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export async function','async function').replaceAll('export function','function')+'\nglobalThis.planAutoBatch=planAutoBatch;globalThis.runAutoBatch=runAutoBatch;';
function setup(){
 const items=['a','b'].map(hash=>({hash,filename:hash+'.png',title:hash,description:'Description',mainTag:'cat',status:'pending',mode:'black'}));
 const profile={status:'VERIFIED',entryUrl:'https://www.teepublic.com/design/quick_create',publication:{verifiedAt:'today'},selectors:Object.fromEntries(['file','uploadReady','title','description','mainTag','matureNo','colorMenu','white','black','colorState','preview','publish','terms'].map(r=>[r,{selector:'#'+r,verifiedAt:'today'}]))};
 const options={mode:'black',selected:['a','b'],testOnly:false,useCsvModes:true,approved:true,reviewed:true,acceptTerms:true};
 const published=[];
 const ctx={Error,Set,assertProfile,validateMetadata,publishReviewed:async batch=>{published.push(batch[0].hash);batch[0].status='success';}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,items,profile,options,published};
}
test('batch approval requires all three explicit approvals',()=>{
 const c=setup();for(const key of ['approved','reviewed','acceptTerms'])assert.throws(()=>c.ctx.planAutoBatch(c.items,c.profile,{...c.options,[key]:false}),/Approve this batch/);
});
test('only selected pending items belong to approved batch; test mode limits to one',()=>{
 const c=setup();assert.equal(c.ctx.planAutoBatch(c.items,c.profile,c.options).length,2);
 assert.equal(c.ctx.planAutoBatch(c.items,c.profile,{...c.options,testOnly:true}).length,1);
 c.items[0].status='success';assert.equal(c.ctx.planAutoBatch(c.items,c.profile,c.options)[0].hash,'b');
});
test('preflight blocks source restrictions, existing publication and missing light choices',()=>{
 const c=setup();c.items[0].excludeKids=true;assert.throws(()=>c.ctx.planAutoBatch(c.items,c.profile,c.options),/No Kids Youth/);
 c.items[0].excludeKids=false;c.items[0].publishedUrl='https://www.teepublic.com/t-shirt/123-a';assert.throws(()=>c.ctx.planAutoBatch(c.items,c.profile,c.options),/already has/);
 c.items[0].publishedUrl='';c.items[0].mode='light';c.profile.apparelColors=[{white:null}];assert.throws(()=>c.ctx.planAutoBatch(c.items,c.profile,c.options),/White default/);
});
test('automatic run publishes each prepared item sequentially with fail-fast enabled',async()=>{
 const c=setup();let settings;
 const queue={checkpoint:async()=>{},update(){},async start(o){settings=o;for(const item of c.items){item.status='review';await o.onPrepared(item,c.profile);assert.equal(item.status,'success');}}};
 await c.ctx.runAutoBatch(queue,c.items,c.profile,c.options);
 assert.deepEqual(c.published,['a','b']);assert.equal(settings.failFast,true);
 await assert.rejects(settings.onPrepared({hash:'unapproved'},c.profile),/outside the approved batch/);
});
