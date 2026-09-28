import './style.css';
import { parseCsv, toCsv } from './engine.js';
import { parseXlsx, rowsToXlsx } from './xlsx.js';

const app=document.querySelector('#app');
let master=null,buyer=null,result=null;
let masterFile=null,buyerFile=null;
app.innerHTML=`
<header><div class="brand"><span>AP</span><div><h1>AccountPuller</h1><p>Private CSV / XLSX inventory matching</p></div></div><div class="privacy">● Files stay on this computer</div></header>
<main><section class="hero"><p class="eyebrow">ACCOUNT INVENTORY TOOL</p><h2>Find what your buyer <em>doesn't</em> already have.</h2><p>Upload your master inventory and your buyer's inventory. AccountPuller compares account numbers locally and creates clean CSV/XLSX files of accounts still available to sell.</p></section>
<section class="uploads">
 <article class="card"><div class="step">1</div><h3>Master Inventory</h3><p>Your complete CSV or XLSX inventory.</p><label class="drop">Choose MASTER CSV / XLSX<input id="masterFile" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><div id="masterInfo" class="info">No file selected</div><label>Account number column<select id="masterKey" disabled><option>Upload a CSV first</option></select></label></article>
 <article class="card"><div class="step">2</div><h3>Buyer Inventory</h3><p>Accounts your buyer already has.</p><label class="drop">Choose BUYER CSV / XLSX<input id="buyerFile" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><div id="buyerInfo" class="info">No file selected</div><label>Account number column<select id="buyerKey" disabled><option>Upload a CSV first</option></select></label></article>
</section>
<section class="compare"><button id="compareBtn" disabled>Compare Accounts</button><p id="status">Upload both CSV files to begin.</p></section>
<section id="results" class="results hidden" aria-live="polite">
 <div class="metric"><span>MASTER INVENTORY</span><strong id="masterCount">0</strong><small>accounts</small></div>
 <div class="metric"><span>BUYER ALREADY HAS</span><strong id="matchCount">0</strong><small>matches</small></div>
 <div class="metric primary"><span>AVAILABLE TO SELL</span><strong id="availableCount">0</strong><small>accounts</small></div>
 <div class="actions"><button id="downloadAvailable">Download Available Accounts</button><button id="downloadMatches" class="secondary">Download Matches</button><button id="downloadReview" class="secondary hidden">Download Needs Review</button></div>
 <div id="quality" class="quality"></div><p id="warning" class="warning"></p>
</section></main>
<footer>No database · No Supabase · CSV data is processed in your browser memory only.</footer>`;

const $=id=>document.getElementById(id);
function guessField(fields){return fields.find(f=>/^(account|acct)(\s*#|\s*(number|no|num|id))?$/i.test(f.trim()))||fields.find(f=>/(account|acct)/i.test(f))||fields[0];}
function fillSelect(el,fields){el.innerHTML=fields.map(f=>`<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');el.value=guessField(fields);el.disabled=false;}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function load(kind,file){try{const isXlsx=/\.xlsx$/i.test(file.name);const parsed=isXlsx?await parseXlsx(file):parseCsv(await file.slice(0,1048576).text());if(!parsed.fields.length)throw new Error('No column headers found.');const info={fields:parsed.fields,rows:isXlsx?parsed.rows:null,isXlsx};if(kind==='master'){masterFile=file;master=info;fillSelect($('masterKey'),parsed.fields);$('masterInfo').textContent=`${file.name} · ${(file.size/1048576).toFixed(1)} MB`;}else{buyerFile=file;buyer=info;fillSelect($('buyerKey'),parsed.fields);$('buyerInfo').textContent=`${file.name} · ${(file.size/1048576).toFixed(1)} MB`;}result=null;$('results').classList.add('hidden');updateReady();}catch(e){$(kind+'Info').textContent='Could not read file: '+e.message;}}
function updateReady(){const ready=master&&buyer;$('compareBtn').disabled=!ready;$('status').textContent=ready?'Ready to compare. Your original files will not be changed.':'Upload both CSV files to begin.';}
$('masterFile').addEventListener('change',e=>e.target.files[0]&&load('master',e.target.files[0]));
$('buyerFile').addEventListener('change',e=>e.target.files[0]&&load('buyer',e.target.files[0]));
$('compareBtn').addEventListener('click',()=>{
  $('compareBtn').disabled=true;$('status').textContent='Comparing large portfolios…';
  const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.type==='progress') $('status').textContent=`Comparing portfolios… ${data.value}%`;
    if(data.type==='error'){$('status').textContent='Comparison failed: '+data.message;$('compareBtn').disabled=false;worker.terminate();}
    if(data.type==='done'){result=data.result;$('masterCount').textContent=result.masterCount.toLocaleString();$('matchCount').textContent=result.matches.length.toLocaleString();$('availableCount').textContent=result.available.length.toLocaleString();$('quality').textContent=`Verified twice. Master — ${result.masterStats.unique.toLocaleString()} safe unique IDs, ${result.masterStats.duplicateRows.toLocaleString()} duplicate rows. Buyer — ${result.buyerStats.unique.toLocaleString()} safe unique IDs, ${result.buyerStats.duplicateRows.toLocaleString()} duplicate rows.`;const issues=[];if(result.masterStats.scientific)issues.push(`${result.masterStats.scientific.toLocaleString()} MASTER scientific-notation rows quarantined`);if(result.buyerStats.scientific)issues.push(`${result.buyerStats.scientific.toLocaleString()} BUYER scientific IDs excluded from matching`);if(result.blankMaster)issues.push(`${result.blankMaster.toLocaleString()} MASTER blank account rows excluded`);$('warning').textContent=issues.join(' · ');$('downloadReview').classList.toggle('hidden',!result.review.length);$('results').classList.remove('hidden');$('status').textContent='Comparison complete and independently verified.';$('compareBtn').disabled=false;worker.terminate();}
  };
  worker.postMessage({type:'compare',masterFile,buyerFile,masterRows:master?.rows,buyerRows:buyer?.rows,masterKey:$('masterKey').value,buyerKey:$('buyerKey').value});
});
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function download(rows,base){const accountField=$('masterKey').value;const blob=await rowsToXlsx(rows,result.fields,accountField);saveBlob(blob,base+'.xlsx');}
$('downloadAvailable').addEventListener('click',()=>result&&download(result.available,'available-accounts'));
$('downloadMatches').addEventListener('click',()=>result&&download(result.matches,'matched-accounts'));
$('downloadReview').addEventListener('click',()=>result&&download(result.review,'needs-review-scientific-ids'));
