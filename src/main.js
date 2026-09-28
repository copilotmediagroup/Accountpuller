import './style.css';
import { parseCsv, compareAccounts, toCsv } from './engine.js';

const app=document.querySelector('#app');
let master=null,buyer=null,result=null;
app.innerHTML=`
<header><div class="brand"><span>AP</span><div><h1>AccountPuller</h1><p>Private CSV inventory matching</p></div></div><div class="privacy">● Files stay on this computer</div></header>
<main><section class="hero"><p class="eyebrow">ACCOUNT INVENTORY TOOL</p><h2>Find what your buyer <em>doesn't</em> already have.</h2><p>Upload your master inventory and your buyer's inventory. AccountPuller compares account numbers locally and creates a clean CSV of accounts still available to sell.</p></section>
<section class="uploads">
 <article class="card"><div class="step">1</div><h3>Master Inventory</h3><p>Your complete CSV inventory.</p><label class="drop">Choose MASTER CSV<input id="masterFile" type="file" accept=".csv,text/csv"></label><div id="masterInfo" class="info">No file selected</div><label>Account number column<select id="masterKey" disabled><option>Upload a CSV first</option></select></label></article>
 <article class="card"><div class="step">2</div><h3>Buyer Inventory</h3><p>Accounts your buyer already has.</p><label class="drop">Choose BUYER CSV<input id="buyerFile" type="file" accept=".csv,text/csv"></label><div id="buyerInfo" class="info">No file selected</div><label>Account number column<select id="buyerKey" disabled><option>Upload a CSV first</option></select></label></article>
</section>
<section class="compare"><button id="compareBtn" disabled>Compare Accounts</button><p id="status">Upload both CSV files to begin.</p></section>
<section id="results" class="results hidden" aria-live="polite">
 <div class="metric"><span>MASTER INVENTORY</span><strong id="masterCount">0</strong><small>accounts</small></div>
 <div class="metric"><span>BUYER ALREADY HAS</span><strong id="matchCount">0</strong><small>matches</small></div>
 <div class="metric primary"><span>AVAILABLE TO SELL</span><strong id="availableCount">0</strong><small>accounts</small></div>
 <div class="actions"><button id="downloadAvailable">Download Available Accounts</button><button id="downloadMatches" class="secondary">Download Matches</button></div>
 <div id="quality" class="quality"></div><p id="warning" class="warning"></p>
</section></main>
<footer>No database · No Supabase · CSV data is processed in your browser memory only.</footer>`;

const $=id=>document.getElementById(id);
function guessField(fields){return fields.find(f=>/^(account|acct)(\s*#|\s*(number|no|num|id))?$/i.test(f.trim()))||fields.find(f=>/(account|acct)/i.test(f))||fields[0];}
function fillSelect(el,fields){el.innerHTML=fields.map(f=>`<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');el.value=guessField(fields);el.disabled=false;}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function load(kind,file){try{const parsed=parseCsv(await file.text());if(!parsed.fields.length)throw new Error('No column headers found.');if(kind==='master'){master=parsed;fillSelect($('masterKey'),parsed.fields);$('masterInfo').textContent=`${file.name} · ${parsed.rows.length.toLocaleString()} rows`;}else{buyer=parsed;fillSelect($('buyerKey'),parsed.fields);$('buyerInfo').textContent=`${file.name} · ${parsed.rows.length.toLocaleString()} rows`;}result=null;$('results').classList.add('hidden');updateReady();}catch(e){$(kind+'Info').textContent='Could not read CSV: '+e.message;}}
function updateReady(){const ready=master&&buyer;$('compareBtn').disabled=!ready;$('status').textContent=ready?'Ready to compare. Your original files will not be changed.':'Upload both CSV files to begin.';}
$('masterFile').addEventListener('change',e=>e.target.files[0]&&load('master',e.target.files[0]));
$('buyerFile').addEventListener('change',e=>e.target.files[0]&&load('buyer',e.target.files[0]));
$('compareBtn').addEventListener('click',()=>{result=compareAccounts(master.rows,buyer.rows,$('masterKey').value,$('buyerKey').value);$('masterCount').textContent=master.rows.length.toLocaleString();$('matchCount').textContent=result.matches.length.toLocaleString();$('availableCount').textContent=result.available.length.toLocaleString();$('warning').textContent=result.blankMaster.length?`${result.blankMaster.length.toLocaleString()} master rows have a blank account number and were excluded from both result files.`:'';$('results').classList.remove('hidden');$('status').textContent='Comparison complete.';});
function download(rows,name){const blob=new Blob(['\uFEFF',toCsv(rows,master.fields)],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('downloadAvailable').addEventListener('click',()=>result&&download(result.available,'available-accounts.csv'));
$('downloadMatches').addEventListener('click',()=>result&&download(result.matches,'matched-accounts.csv'));
