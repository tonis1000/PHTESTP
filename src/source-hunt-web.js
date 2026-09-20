const BUILD_ID = '20260920-1200';
const FRESH_DAYS = 30;
const $ = id => document.getElementById(id);

const CHANNEL_FINGERPRINTS = {
  'ERT1': ['ert1', 'ert 1', 'ert1.gr'], 'ERT2': ['ert2', 'ert 2', 'ert2.gr'], 'ERT3': ['ert3', 'ert 3', 'ert3.gr'],
  'ERT News': ['ertnews', 'ert news', 'ert_news'], 'ANT1': ['ant1', 'antenna1', 'ant1.gr'],
  'Alpha TV': ['alpha tv', 'alphatv', 'alpha.gr'], 'SKAI': ['skai', 'skaitv', 'skai tv'],
  'Open TV': ['open tv', 'opentv', 'open beyond'], 'MEGA': ['mega tv', 'megatv', 'mega channel'],
  'Star TV': ['star tv', 'startv', 'star channel'], 'Action 24': ['action 24', 'action24', 'action tv'],
  'Kontra': ['kontra', 'kontra channel']
};

const channelNameEl = $('channel-name');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagLog = $('diagnostic-log');

function log(message){ if(!diagLog) return; const stamp=new Date().toLocaleTimeString(); diagLog.textContent=`[${stamp}] ${message}\n${diagLog.textContent}`.slice(0,18000); }
function normalize(s=''){ return String(s).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi,' '); }
function aliases(name){ return CHANNEL_FINGERPRINTS[name] || [String(name||'').toLowerCase()]; }
function relevant(text,name){ const h=normalize(text); return aliases(name).some(a=>h.includes(normalize(a).trim())); }
function extractM3u8(text=''){ return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/gi)||[]).map(u=>u.replace(/[),.;]+$/g,'')))]; }
function isFresh(ts){ if(!ts) return false; return Date.now()-new Date(ts).getTime() <= FRESH_DAYS*86400000; }

function ensureUi(){
  const auto=$('hunt-auto'); if(!auto || $('hunt-external')) return;
  const wrap=document.createElement('div'); wrap.id='hunt-external'; wrap.className='hunt-auto';
  wrap.innerHTML=`<div class="hunt-auto-head"><div><strong>Web + Forums</strong><span id="hunt-external-status">Ready · Reddit + optional Web Worker</span></div></div><div id="hunt-external-results" class="hunt-results"></div><div class="candidate-tester"><label for="hunt-worker-url">Web Hunt Worker URL</label><div class="inline-form"><input id="hunt-worker-url" type="url" placeholder="https://your-source-hunt.workers.dev"><button id="save-hunt-worker" class="button" type="button">Save</button></div><p class="muted small">Χωρίς Worker τρέχει Reddit/forum search. Με Worker ενεργοποιείται και γενικό web search.</p></div>`;
  auto.insertAdjacentElement('afterend',wrap);
  const input=$('hunt-worker-url'); if(input) input.value=localStorage.getItem('webtv_hunt_web_endpoint')||'';
  $('save-hunt-worker')?.addEventListener('click',()=>{ const v=(input?.value||'').trim().replace(/\/$/,''); if(v) localStorage.setItem('webtv_hunt_web_endpoint',v); else localStorage.removeItem('webtv_hunt_web_endpoint'); $('hunt-external-status').textContent=v?'Worker saved':'Worker cleared'; });
}

function render(items,name,statusText){
  const box=$('hunt-external-results'); const status=$('hunt-external-status'); if(!box) return;
  box.innerHTML=''; if(status) status.textContent=statusText;
  const seen=new Set();
  const filtered=items.filter(x=>x?.url && !seen.has(x.url) && seen.add(x.url)).slice(0,12);
  if(!filtered.length){ const d=document.createElement('div'); d.className='hunt-empty'; d.textContent=`Δεν βρέθηκαν fresh Web/Forum candidates για ${name}.`; box.appendChild(d); return; }
  for(const item of filtered){
    const card=document.createElement('div'); card.className='hunt-result';
    const meta=document.createElement('div'); const strong=document.createElement('strong'); strong.textContent=item.origin||'Web';
    const detail=document.createElement('span'); detail.textContent=`${item.detail||''}${item.updatedAt?` · ${new Date(item.updatedAt).toLocaleDateString('de-DE')}`:''}`;
    const code=document.createElement('code'); code.textContent=item.url; meta.append(strong,detail,code);
    const test=document.createElement('button'); test.className='button'; test.type='button'; test.textContent='Test'; test.addEventListener('click',()=>{ if(candidateInput) candidateInput.value=item.url; candidateInput?.dispatchEvent(new Event('input',{bubbles:true})); testButton?.click(); log(`HUNT external candidate selected · ${name} · ${item.url}`); });
    card.append(meta,test); box.appendChild(card);
  }
}

async function huntReddit(name){
  const q=`${aliases(name)[0]} m3u8`; const url=`https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&t=month&limit=25&raw_json=1`;
  const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'}); if(!r.ok) throw new Error(`Reddit ${r.status}`);
  const j=await r.json(); const out=[];
  for(const child of j?.data?.children||[]){ const d=child.data||{}; const updatedAt=new Date((d.created_utc||0)*1000).toISOString(); if(!isFresh(updatedAt)) continue; const text=`${d.title||''}\n${d.selftext||''}\n${d.url||''}`; if(!relevant(text,name)) continue; for(const u of extractM3u8(text)) out.push({url:u,origin:'Reddit / forum',detail:`r/${d.subreddit||''} · ${d.title||''}`.slice(0,180),updatedAt}); }
  return out;
}

async function huntWorker(name){
  const endpoint=(localStorage.getItem('webtv_hunt_web_endpoint')||'').trim().replace(/\/$/,''); if(!endpoint) return {items:[],skipped:true};
  const url=`${endpoint}/hunt?channel=${encodeURIComponent(name)}&days=${FRESH_DAYS}`; const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`Web Worker ${r.status}`); const j=await r.json();
  return {items:(j.candidates||[]).filter(x=>x.url && relevant(`${x.url} ${x.title||''} ${x.snippet||''}`,name)).map(x=>({url:x.url,origin:x.origin||'Web search',detail:x.title||x.source||'',updatedAt:x.updatedAt||null})),skipped:false};
}

async function runExternal(){
  const name=channelNameEl?.textContent?.trim(); if(!name||name==='Επίλεξε κανάλι') return;
  const status=$('hunt-external-status'); if(status) status.textContent=`Searching Reddit + Web for ${name}…`; log(`RUN EXTERNAL HUNT ${name} · Reddit + Web Worker · ${FRESH_DAYS}d`);
  const [rr,ww]=await Promise.allSettled([huntReddit(name),huntWorker(name)]); const items=[]; let parts=[];
  if(rr.status==='fulfilled'){ items.push(...rr.value); parts.push(`Reddit ${rr.value.length}`); } else parts.push('Reddit failed');
  if(ww.status==='fulfilled'){ if(!ww.value.skipped){ items.push(...ww.value.items); parts.push(`Web ${ww.value.items.length}`); } else parts.push('Web not configured'); } else parts.push('Web failed');
  render(items,name,parts.join(' · ')); log(`EXTERNAL HUNT DONE ${name} · ${parts.join(' · ')}`);
}

ensureUi();
$('run-hunt')?.addEventListener('click',runExternal);
log(`Source Hunt Web/Forums loaded · build ${BUILD_ID}`);
