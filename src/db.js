let opening;
export function openDB(){return opening??=new Promise((resolve,reject)=>{const q=indexedDB.open('teepublic-auto-uploader',1);q.onupgradeneeded=()=>{const db=q.result;const items=db.createObjectStore('items',{keyPath:'hash'});items.createIndex('status','status');db.createObjectStore('settings');db.createObjectStore('logs',{keyPath:'id',autoIncrement:true});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
export async function transaction(store,mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let result,cause;const req=fn(tx.objectStore(store));if(req){req.onsuccess=()=>result=req.result;req.onerror=()=>{cause=req.error;};}tx.oncomplete=()=>resolve(result);tx.onerror=()=>{cause=tx.error||cause;};tx.onabort=()=>reject(tx.error||cause||Error('Transaction aborted'));});}
export const all=store=>transaction(store,'readonly',s=>s.getAll());
export const get=(store,key)=>transaction(store,'readonly',s=>s.get(key));
export const put=(store,value,key)=>transaction(store,'readwrite',s=>key===undefined?s.put(value):s.put(value,key));
export const addItem=item=>transaction('items','readwrite',s=>s.add(item));
export async function log(action,detail='',extra={}){await put('logs',{timestamp:new Date().toISOString(),action,detail,...extra});}
