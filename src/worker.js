import Papa from 'papaparse';

const cleanHeader = value => String(value ?? '').replace(/^\uFEFF/, '').trim();
const accountId = value => value == null ? '' : String(value).trim();

function parseBuyer(file, key) {
  return new Promise((resolve, reject) => {
    const ids = new Set(); let rows = 0, blank = 0, duplicateRows = 0;
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
          if (ids.has(value)) duplicateRows++; else ids.add(value);
        }
        postMessage({type:'progress',phase:'buyer',value:Math.min(35,Math.round((results.meta.cursor/file.size)*35))});
      },
      complete(){resolve({ids,rows,blank,duplicateRows});}, error:reject
    });
  });
}

function parseMaster(file, key, buyerIds) {
  return new Promise((resolve, reject) => {
    let fields=[], rows=0, blank=0, duplicateRows=0;
    const seen=new Set(), matches=[], available=[];
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
          if (seen.has(value)) duplicateRows++; else seen.add(value);
          if (buyerIds.has(value)) matches.push(row); else available.push(row);
        }
        const pct=35+Math.round((results.meta.cursor/file.size)*65);
        postMessage({type:'progress',phase:'master',value:Math.min(100,pct)});
      },
      complete(){resolve({fields,rows,blank,duplicateRows,unique:seen.size,matches,available});},
      error:reject
    });
  });
}

self.onmessage=async({data})=>{
  if(data.type!=='compare') return;
  try {
    const buyer=await parseBuyer(data.buyerFile,data.buyerKey);
    const master=await parseMaster(data.masterFile,data.masterKey,buyer.ids);
    postMessage({type:'done',result:{
      fields:master.fields,masterCount:master.rows,buyerCount:buyer.rows,
      matches:master.matches,available:master.available,blankMaster:master.blank,
      masterStats:{unique:master.unique,duplicateRows:master.duplicateRows},
      buyerStats:{unique:buyer.ids.size,duplicateRows:buyer.duplicateRows}
    }});
  } catch(error) {
    postMessage({type:'error',message:error?.message || String(error)});
  }
};