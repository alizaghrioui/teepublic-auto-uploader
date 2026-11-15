import test from 'node:test';
import assert from 'node:assert/strict';
import {matchDesigns,validateSelection} from '../src/matching.js';

const listing=(filename,title)=>({filename,title,description:`Description for ${title}`,mainTag:'animals',tags:'cute, nature'});
test('matches reversed sheet rows by filename and keeps each full listing',()=>{
 const rows=[listing('b.png','B'),listing('a.png','A')];
 const result=validateSelection(matchDesigns([{name:'a.png'},{name:'b.png'}],rows),[0,1]);
 assert.deepEqual(result.map(x=>[x.file.name,x.m.title,x.m.description]),[['a.png','A','Description for A'],['b.png','B','Description for B']]);
});
test('manual mapping stores actual design filename without changing sheet metadata',()=>{
 const row=listing('old.png','Renamed artwork');
 const result=validateSelection(matchDesigns([{name:'new.png'}],[row],new Map([[0,0]])),[0]);
 assert.equal(result[0].m.filename,'new.png');assert.equal(row.filename,'old.png');
});
test('missing or incomplete listing blocks selected designs',()=>{
 assert.throws(()=>validateSelection(matchDesigns([{name:'a.png'}],[]),[0]),/No listing selected/);
 assert.throws(()=>validateSelection(matchDesigns([{name:'a.png'}],[{...listing('a.png','A'),mainTag:''}]),[0]),/Missing mainTag/);
});
test('same sheet row cannot be assigned to two selected designs',()=>{
 const matches=matchDesigns([{name:'a.png'},{name:'b.png'}],[listing('a.png','A')],new Map([[1,0]]));
 assert.throws(()=>validateSelection(matches,[0,1]),/multiple selected designs/);
 assert.equal(validateSelection(matches,[1]).length,1);
});
test('duplicate design basenames or duplicate matching rows block import',()=>{
 assert.match(matchDesigns([{name:'a.png'},{name:'a.png'}],[listing('a.png','A')])[0].error,/Duplicate design/);
 assert.match(matchDesigns([{name:'a.png'}],[listing('a.png','A'),listing('a.png','B')])[0].error,/Multiple sheet rows/);
});
test('empty selection is rejected',()=>assert.throws(()=>validateSelection([],[]),/Select at least one/));
