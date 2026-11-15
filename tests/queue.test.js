import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs/promises';
import {assertProfile,validateMetadata,safeUrl} from '../src/core.js';
const source=(await fs.readFile(new URL('../src/queue.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace('export class Queue','class Queue').replace('export async function','async function')+'\nglobalThis.Queue=Queue;globalThis.recoverInterrupted=recoverInterrupted;';
function setup(mode='light',fail=false){const actions=[],logs=[];const item={filename:'one.png',title:'Title',description:'Description',mainTag:'cat',tags:'',hash:'abc',mode,status:'pending',file:new Blob(['png'])};const profile={entryUrl:'https://www.teepublic.com/design/quick_create',status:'VERIFIED',selectors:Object.fromEntries(['file','uploadReady','title','description','mainTag','matureNo','colorMenu','white','black','colorState','preview'].map(r=>[r,{selector:'#'+r,verifiedAt:'2026-11-14'}]))};const ctx={URL,Blob,Uint8Array,btoa,Date,Error,Number,RegExp,assertProfile,validateMetadata,safeUrl,sleep:async()=>{},get:async()=>profile,all:async()=>[item],put:async()=>{},log:async(...x)=>logs.push(x),chrome:{tabs:{update:async()=>{},create:async()=>({id:1}),get:async()=>({status:'complete',url:'https://www.teepublic.com/designs/123/edit'}),sendMessage:async(id,m)=>{actions.push(m.step);return fail?{error:'Changed DOM'}:{verified:true};}}}};vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,item,profile,actions,logs,q:new ctx.Queue()};}
for(const mode of ['light','black'])test(`${mode} executes its recorded color and ends in review, never success`,async()=>{const {q,item,actions}=setup(mode);await q.start({mode,delay:2000,selected:['abc']});assert.equal(item.status,'review');assert.ok(actions.some(a=>a.role===(mode==='light'?'white':'black')));assert.equal(actions.some(a=>a.role==='publish'),false);assert.equal(item.designId,'123');});
test('Content failure stops item and retains draft for duplicate protection',async()=>{const {q,item,actions}=setup('light',true);await q.start({mode:'light',delay:2000,selected:['abc']});assert.equal(item.status,'failed');assert.equal(actions.length,1);assert.ok(item.draftUrl);assert.match(item.error,/Changed DOM/);});
test('Pause and resume checkpoint state',async()=>{const {q}=setup();await q.pause();assert.equal(q.paused,true);await q.resume();assert.equal(q.paused,false);await q.checkpoint();});
test('Stop blocks next action',async()=>{const {q}=setup();await q.stop();await assert.rejects(q.checkpoint(),/STOP_REQUESTED/);});
test('Restart recovery holds ambiguous uploads for review',async()=>{const {ctx,item}=setup();item.status='running';item.actionInFlight=true;await ctx.recoverInterrupted();assert.equal(item.status,'review');assert.match(item.error,/automatic replay is blocked/);});
test('Unsafe delay rejected before creating a tab',async()=>{const {q,actions}=setup();await assert.rejects(q.start({mode:'light',delay:0,selected:['abc']}),/Delay/);assert.equal(actions.length,0);});

test('Recorded profile applies Dark then only T-Shirt and Baseball Tee defaults',async()=>{const real=JSON.parse(await fs.readFile(new URL('../selectors.json',import.meta.url),'utf8'));const {q,item,profile,actions}=setup('black');Object.assign(profile,{apparelColors:real.apparelColors,palette:real.palette});await q.start({mode:'black',delay:2000,selected:['abc']});assert.equal(item.status,'review');assert.equal(actions.filter(a=>a.role==='black').length,2);assert.equal(actions.find(a=>a.action==='palette').value,'Dark');assert.ok(actions.some(a=>a.action==='color'&&a.value==='Black/White'));});

test('automatic callback runs only after successful preparation and preserves verified success',async()=>{
 const {q,item}=setup('black');let calls=0;
 await q.start({mode:'black',delay:2000,selected:['abc'],onPrepared:async i=>{assert.equal(i.status,'review');calls++;i.status='success';},failFast:true});
 assert.equal(calls,1);assert.equal(item.status,'success');
 const failed=setup('black',true);await failed.q.start({mode:'black',delay:2000,selected:['abc'],onPrepared:async()=>{throw Error('Must not be called');},failFast:true});assert.equal(failed.item.error,'Changed DOM');
});
test('automatic batch stops after uncertain publication without creating another draft',async()=>{
 const {q,item,ctx}=setup('black');const second={...item,hash:'second',filename:'two.png'};ctx.all=async()=>[item,second];
 await q.start({mode:'black',delay:2000,testOnly:false,selected:['abc','second'],onPrepared:async i=>{i.status='publication_unverified';i.error='Review result';},failFast:true});
 assert.equal(item.status,'publication_unverified');assert.equal(second.status,'pending');assert.equal(second.draftUrl,undefined);
});
