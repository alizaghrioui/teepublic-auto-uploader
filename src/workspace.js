// Reloading an unpacked extension fires onInstalled with reason "update".
// Chrome may close extension-owned tabs during reload; restore one workspace.
// Restoring the view never starts a queue or grants publishing approval.
export async function openWorkspace(){
 const url=chrome.runtime.getURL('dashboard.html');
 const tabs=await chrome.tabs.query({});
 const existing=tabs.find(tab=>tab.url===url);
 if(existing){await chrome.tabs.update(existing.id,{active:true});return existing;}
 return chrome.tabs.create({url,active:true});
}

chrome.runtime.onInstalled.addListener(details=>{
 if(details.reason!=='update')return;
 openWorkspace().catch(error=>console.error('Could not restore uploader workspace:',error.message));
});
