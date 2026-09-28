import Papa from 'papaparse';

const cleanHeader = value => String(value ?? '').replace(/^\uFEFF/, '').trim();
const accountId = value => value == null ? '' : String(value).trim();
const isScientificId = value => /^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/.test(accountId(value));

function parseBuyer(file, key) {
  return new Promise((resolve, reject) => {
    const ids = new Set(); let rows = 0, blank = 0, duplicateRows = 0, scientific = 0;
    Papa.parse(file, {
      header:true, skipEmptyLines:'greedy', dynamicTyping:false,
      transformHeader:cleanHeader, chunkSize:2 * 1024 * 1024,
      chunk(results, parser) {
        if (!(results.meta.fields || []).includes(key)) {
          parser.abort(); reject(new Error('Buyer account column was not found.')); return;
        }
        for (const row of results.data) {
          rows++; const value = accountId(row[key]);
          if (!value) { blank++; continue; }
          if (isScientificId(value)) { scientific++; continue; }
          if (ids.has(value)) duplicateRows++; else ids.add(value);
        }
        postMessage({type:'progress',phase:'buyer',value:Math.min(35,Math.round((results.meta.cursor/file.size)*35))});
      },
      complete(){resolve({ids,rows,blank,duplicateRows,scientific});}, error:reject
    });
  });
}

function parseMaster(file, key, buyerIds) {
  return new Promise((resolve, reject) => {
    let fields=[], rows=0, blank=0, duplicateRows=0, scientific=0;
    const seen=new Set(), matches=[], available=[], review=[];
    Papa.parse(file, {
      header:true, skipEmptyLines:'greedy', dynamicTyping:false,
      transformHeader:cleanHeader, chunkSize:2 * 1024 * 1024,
      chunk(results, parser) {        fields=results.meta.fields || fields;
        if (!fields.includes(key)) {
          parser.abort(); reject(new Error('Master account column was not found.')); return;
        }
        for (const row of results.data) {
          rows++; const value=accountId(row[key]);
          if (!value) { blank++; continue; }
          if (isScientificId(value)) { scientific++; review.push(row); continue; }
          if (seen.has(value)) duplicateRows++; else seen.add(value);
          if (buyerIds.has(value)) matches.push(row); else available.push(row);
        }
        const pct=35+Math.round((results.meta.cursor/file.size)*65);
        postMessage({type:'progress',phase:'master',value:Math.min(100,pct)});
      },
      complete(){resolve({fields,rows,blank,duplicateRows,scientific,unique:seen.size,matches,available,review});},
      error:reject
    });
  });
}

function verifyMaster(file, key, buyerIds) {
  return new Promise((resolve, reject) => {
    let rows=0, blank=0, scientific=0, matches=0, available=0;
    Papa.parse(file, {
      header:true, skipEmptyLines:'greedy', dynamicTyping:false,
      transformHeader:cleanHeader, chunkSize:4 * 1024 * 1024,
      chunk(results) {
        for (const row of results.data) {
          rows++; const value=accountId(row[key]);
          if (!value) blank++;
          else if (isScientificId(value)) scientific++;
          else if (buyerIds.has(value)) matches++;
          else available++;
        }
      },
      complete(){resolve({rows,blank,scientific,matches,available});}, error:reject
    });
  });
}

self.onmessage=async({data})=>{
  if(data.type!=='compare') return;
  try {
    const buyer=await parseBuyer(data.buyerFile,data.buyerKey);
    const master=await parseMaster(data.masterFile,data.masterKey,buyer.ids);
    postMessage({type:'progress',phase:'verify',value:100});
    const verify=await verifyMaster(data.masterFile,data.masterKey,buyer.ids);
    const valid=verify.rows===master.rows && verify.blank===master.blank &&
      verify.scientific===master.scientific &&
      verify.matches===master.matches.length && verify.available===master.available.length &&
      (master.matches.length+master.available.length+master.blank+master.scientific===master.rows);
    if(!valid) throw new Error('Verification failed: comparison totals did not reconcile. No download was produced.');
    postMessage({type:'done',result:{
      fields:master.fields,masterCount:master.rows,buyerCount:buyer.rows,verified:true,
      matches:master.matches,available:master.available,review:master.review,blankMaster:master.blank,
      masterStats:{unique:master.unique,duplicateRows:master.duplicateRows,scientific:master.scientific},
      buyerStats:{unique:buyer.ids.size,duplicateRows:buyer.duplicateRows,scientific:buyer.scientific}
    }});
  } catch(error) {
    postMessage({type:'error',message:error?.message || String(error)});
  }
};