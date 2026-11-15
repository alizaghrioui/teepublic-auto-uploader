export const ROLES = ['file','uploadReady','title','description','mainTag','tags','matureNo','colorMenu','white','black','colorState','preview','publish','publishedLink','terms','paletteDark','paletteLight'];
export function parseCSV(text) {
  const rows=[]; let row=[], cell='', quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;}else if(quoted || !cell) quoted=!quoted; else throw Error('Invalid CSV quote'); }
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  row.push(cell);if(row.some(Boolean))rows.push(row);
  const headers=rows.shift()?.map(s=>s.trim().toLowerCase())||[];
  if(new Set(headers).size!==headers.length)throw Error('Duplicate CSV columns');
  return rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`CSV row ${i+2}: wrong column count`);return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));});
}
export function metadata(row) {
  return {filename:row.filename||row['file-name']||'',title:row.title||'',description:row.description||'',mainTag:row.main_tag||row['main tag']||'',tags:row.additional_tags||row['supporting tags']||row.tags||'',mode:row.shirt_mode||'',matureContent:row.mature_content||'',reviewStatus:row.review_status||'',recordedPublishedUrl:row.published_url||'',notes:row.notes||'',excludeKids:/no kids youth/i.test(row.notes||'')};
}
export function validateMetadata(m){if(m.matureContent && m.matureContent!=='no')throw Error('Mature or ambiguous content requires manual preparation');for(const k of ['filename','title','description','mainTag'])if(!m[k]?.trim())throw Error(`Missing ${k}; supply TeePublic metadata. Amazon CSVs may lack tags.`);}
export function csvExport(rows) {
 const headers=['filename','hash','title','mode','status','designId','publishedUrl','lastAttempt','error'];
 const quote=x=>'"'+String(x??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return [headers,...rows.map(r=>headers.map(k=>r[k]))].map(r=>r.map(quote).join(',')).join('\r\n');
}
export function safeUrl(value){const u=new URL(value);if(u.origin!=='https://www.teepublic.com'||u.username||u.password||u.search||u.hash)throw Error('Use a plain HTTPS www.teepublic.com URL');return u.href;}
export function assertProfile(p,mode){
 if(!p)throw Error('HOLD_RECORDING: no selector profile');if(!['light','black'].includes(mode))throw Error('Unknown shirt mode');safeUrl(p.entryUrl);if(p.status!=='VERIFIED')throw Error('HOLD_RECORDING: bind and review real DOM selectors first');
 for(const role of ['file','uploadReady','title','description','mainTag','matureNo','colorMenu',mode==='light'?'white':'black','colorState','preview'])
  if(!p.selectors?.[role]?.selector||!p.selectors[role].verifiedAt)throw Error(`Unverified selector: ${role}`);
}
export function nextItem(items){return items.find(x=>x.status==='pending');}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
