const BUILD_ID = '20260920-1540';
const FRESH_DAYS = 30;
const DEFAULT_WORKER = 'https://source-huntatonisworkersdev.atonis.workers.dev';
const $ = id => document.getElementById(id);

const channelNameEl = $('channel-name');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagLog = $('diagnostic-log');

function log(message){
  if(!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0,18000);
}
function endpoint(){return (localStorage.getItem('webtv_hunt_web_endpoint') || DEFAULT_WORKER).trim().replace(/\/$/, '');}
function ensureUi(){
  const auto = $('hunt-auto');
  if(!auto || $('hunt-external')) return;
  const wrap = document.createElement('div');
  wrap.id = 'hunt-external';
  wrap.className = 'hunt-auto';
  wrap.innerHTML = `
    <div class="hunt-auto-head"><div><strong>External Discovery</strong><span id="hunt-external-status">Ready · Seeds + Fresh Web + Reddit / Forums + leads</span></div></div>
    <div class="hunt-auto-head"><div><strong>Known M3U Seeds</strong><span id="hunt-seed-count">0 candidates</span></div></div><div id="hunt-seed-results" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Fresh Web · 30d</strong><span id="hunt-web-count">0 candidates</span></div></div><div id="hunt-web-results" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Web Leads</strong><span id="hunt-web-lead-count">0 leads</span></div></div><div id="hunt-web-leads" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Forums / Reddit · 30d</strong><span id="hunt-forum-count">0 candidates</span></div></div><div id="hunt-forum-results" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Forum / Reddit Leads</strong><span id="hunt-forum-lead-count">0 leads</span></div></div><div id="hunt-forum-leads" class="hunt-results"></div>
    <div class="candidate-tester"><label for="hunt-worker-url">Source Hunt Worker</label><div class="inline-form"><input id="hunt-worker-url" type="url" value="${DEFAULT_WORKER}"><button id="save-hunt-worker" class="button" type="button">Save override</button></div><p class="muted small">Default Worker is built in. Inspect accepts a playable result only when channel provenance is strong enough.</p></div>`;
  auto.insertAdjacentElement('afterend', wrap);
  const input = $('hunt-worker-url'); if(input) input.value = endpoint();
  $('save-hunt-worker')?.addEventListener('click',()=>{const v=(input?.value||'').trim().replace(/\/$/,'');if(v&&v!==DEFAULT_WORKER)localStorage.setItem('webtv_hunt_web_endpoint',v);else localStorage.removeItem('webtv_hunt_web_endpoint');if(input)input.value=endpoint();$('hunt-external-status').textContent='Worker ready';});
}
function empty(box,text){const d=document.createElement('div');d.className='hunt-empty';d.textContent=text;box.appendChild(d);}
function metaText(item){
  const bits=[];
  if(item.title||item.source||item.snippet) bits.push(item.title||item.source||item.snippet);
  if(item.provenance) bits.push(`proof: ${item.provenance}`);
  if(item.updatedAt){try{bits.push(new Date(item.updatedAt).toLocaleDateString('de-DE'));}catch{}}
  return bits.join(' · ');
}
function candidateCard(item,name,label){
  const card=document.createElement('div');card.className='hunt-result';
  const meta=document.createElement('div'),strong=document.createElement('strong'),detail=document.createElement('span'),code=document.createElement('code');
  strong.textContent=item.origin||label;detail.textContent=metaText(item);code.textContent=item.url;meta.append(strong,detail,code);
  const test=document.createElement('button');test.className='button';test.type='button';test.textContent='Test';test.addEventListener('click',()=>{if(candidateInput)candidateInput.value=item.url;candidateInput?.dispatchEvent(new Event('input',{bubbles:true}));testButton?.click();log(`HUNT external candidate selected · ${name} · ${label} · ${item.provenance||'unverified'} · ${item.url}`);});
  card.append(meta,test);return card;
}
function renderGroup(boxId,countId,items,name,label){
  const box=$(boxId),count=$(countId);if(!box)return;box.innerHTML='';const seen=new Set();const rows=(items||[]).filter(x=>x?.url&&!seen.has(x.url)&&seen.add(x.url)).slice(0,8);if(count)count.textContent=`${rows.length} candidate${rows.length===1?'':'s'}`;if(!rows.length){empty(box,`Δεν βρέθηκαν ${label} candidates για ${name}.`);return;}for(const item of rows)box.appendChild(candidateCard(item,name,label));
}
async function inspectLead(item,name,label,button){
  const original=button.textContent;button.disabled=true;button.textContent='Inspecting…';
  try{
    const url=`${endpoint()}/inspect?channel=${encodeURIComponent(name)}&url=${encodeURIComponent(item.url)}`;const r=await fetch(url,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j?.error||`Worker ${r.status}`);const found=j.candidates||[];
    if(found.length){if(candidateInput)candidateInput.value=found[0].url;candidateInput?.dispatchEvent(new Event('input',{bubbles:true}));log(`LEAD INSPECT ${name} · ${label} · found ${found.length} · proof ${found[0].provenance||'unknown'} · ${found[0].url}`);button.textContent=`Found ${found.length}`;button.disabled=false;button.onclick=()=>testButton?.click();return;}
    log(`LEAD INSPECT ${name} · ${label} · no provenance-safe candidate · ${item.url}`);button.textContent='No stream';
  }catch(error){log(`LEAD INSPECT FAILED ${name} · ${error.message}`);button.textContent='Failed';}
  finally{if(button.textContent==='Inspecting…')button.textContent=original;button.disabled=false;}
}
function renderLeads(boxId,countId,items,name,label){
  const box=$(boxId),count=$(countId);if(!box)return;box.innerHTML='';const seen=new Set();const rows=(items||[]).filter(x=>x?.url&&!seen.has(x.url)&&seen.add(x.url)).slice(0,8);if(count)count.textContent=`${rows.length} lead${rows.length===1?'':'s'}`;if(!rows.length){empty(box,`Δεν βρέθηκαν ${label} leads για ${name}.`);return;}
  for(const item of rows){const card=document.createElement('div');card.className='hunt-result';const meta=document.createElement('div'),strong=document.createElement('strong'),detail=document.createElement('span'),code=document.createElement('code');strong.textContent=item.origin||label;detail.textContent=metaText(item)||'Source page';code.textContent=item.url;meta.append(strong,detail,code);const inspect=document.createElement('button');inspect.className='button';inspect.type='button';inspect.textContent='Inspect';inspect.addEventListener('click',()=>inspectLead(item,name,label,inspect));card.append(meta,inspect);box.appendChild(card);}
}
async function huntWorker(name){
  const url=`${endpoint()}/hunt?channel=${encodeURIComponent(name)}&days=${FRESH_DAYS}`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok){let detail='';try{detail=(await r.json())?.error||'';}catch{}throw new Error(`Web Worker ${r.status}${detail?` · ${detail}`:''}`);}return await r.json();}finally{clearTimeout(timer);}
}
async function runExternal(){
  const name=channelNameEl?.textContent?.trim();if(!name||name==='Επίλεξε κανάλι')return;const status=$('hunt-external-status');if(status)status.textContent=`Searching Seeds + Web + Reddit / Forums for ${name}…`;log(`RUN EXTERNAL HUNT ${name} · provenance-safe leads · ${FRESH_DAYS}d`);
  try{
    const result=await huntWorker(name),groups=result.groups||{seed:[],web:[],forums:[],webLeads:[],forumLeads:[]};
    renderGroup('hunt-seed-results','hunt-seed-count',groups.seed,name,'Seed');renderGroup('hunt-web-results','hunt-web-count',groups.web,name,'Fresh Web');renderLeads('hunt-web-leads','hunt-web-lead-count',groups.webLeads,name,'Web');renderGroup('hunt-forum-results','hunt-forum-count',groups.forums,name,'Forum / Reddit');renderLeads('hunt-forum-leads','hunt-forum-lead-count',groups.forumLeads,name,'Forum / Reddit');
    const c=result.counts||{},cacheText=result.cached?'cache hit':'fresh scan',subreq=Number.isFinite(result.subrequestsUsed)?` · ${result.subrequestsUsed}/${result.subrequestBudget} subreq`:'',elapsed=Number.isFinite(result.elapsedMs)?` · ${result.elapsedMs} ms`:'';if(status)status.textContent=`Seeds ${c.seed||0} · Web ${c.web||0}+${c.webLeads||0} leads · Forums ${c.forums||0}+${c.forumLeads||0} leads · ${cacheText}${subreq}${elapsed}`;log(`EXTERNAL HUNT DONE ${name} · Seeds ${c.seed||0} · Web ${c.web||0}/${c.webLeads||0} leads · Forums ${c.forums||0}/${c.forumLeads||0} leads · ${cacheText}${subreq}${elapsed}`);
  }catch(error){const msg=error?.name==='AbortError'?'Worker timeout after 30s':error.message;if(status)status.textContent=`Worker failed · ${msg}`;log(`EXTERNAL HUNT FAILED ${name} · ${msg}`);}
}
ensureUi();$('run-hunt')?.addEventListener('click',runExternal);log(`Source Hunt external UI loaded · build ${BUILD_ID} · provenance guard + fresh leads`);
