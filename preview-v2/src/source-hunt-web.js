const BUILD_ID = '20260920-1255';
const FRESH_DAYS = 30;
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

function ensureUi(){
  const auto = $('hunt-auto');
  if(!auto || $('hunt-external')) return;

  const wrap = document.createElement('div');
  wrap.id = 'hunt-external';
  wrap.className = 'hunt-auto';
  wrap.innerHTML = `
    <div class="hunt-auto-head">
      <div>
        <strong>Web + Forums</strong>
        <span id="hunt-external-status">Worker required · Web + Reddit + forums</span>
      </div>
    </div>
    <div id="hunt-external-results" class="hunt-results"></div>
    <div class="candidate-tester">
      <label for="hunt-worker-url">Web Hunt Worker URL</label>
      <div class="inline-form">
        <input id="hunt-worker-url" type="url" placeholder="https://your-source-hunt.workers.dev">
        <button id="save-hunt-worker" class="button" type="button">Save</button>
      </div>
      <p class="muted small">Web, Reddit και forums περνάνε όλα από τον Worker. Δεν γίνεται direct Reddit request από το browser.</p>
    </div>`;
  auto.insertAdjacentElement('afterend', wrap);

  const input = $('hunt-worker-url');
  if(input) input.value = localStorage.getItem('webtv_hunt_web_endpoint') || '';
  $('save-hunt-worker')?.addEventListener('click', () => {
    const v = (input?.value || '').trim().replace(/\/$/, '');
    if(v) localStorage.setItem('webtv_hunt_web_endpoint', v);
    else localStorage.removeItem('webtv_hunt_web_endpoint');
    $('hunt-external-status').textContent = v ? 'Worker saved · ready' : 'Worker required · Web + Reddit + forums';
  });
}

function render(items, name, statusText){
  const box = $('hunt-external-results');
  const status = $('hunt-external-status');
  if(!box) return;
  box.innerHTML = '';
  if(status) status.textContent = statusText;

  const seen = new Set();
  const filtered = (items || []).filter(x => x?.url && !seen.has(x.url) && seen.add(x.url)).slice(0,12);

  if(!filtered.length){
    const d = document.createElement('div');
    d.className = 'hunt-empty';
    d.textContent = `Δεν βρέθηκαν fresh Web/Forum candidates για ${name}.`;
    box.appendChild(d);
    return;
  }

  for(const item of filtered){
    const card = document.createElement('div');
    card.className = 'hunt-result';

    const meta = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = item.origin || 'Web';
    const detail = document.createElement('span');
    detail.textContent = `${item.detail || ''}${item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleDateString('de-DE')}` : ''}`;
    const code = document.createElement('code');
    code.textContent = item.url;
    meta.append(strong, detail, code);

    const test = document.createElement('button');
    test.className = 'button';
    test.type = 'button';
    test.textContent = 'Test';
    test.addEventListener('click', () => {
      if(candidateInput) candidateInput.value = item.url;
      candidateInput?.dispatchEvent(new Event('input', {bubbles:true}));
      testButton?.click();
      log(`HUNT external candidate selected · ${name} · ${item.url}`);
    });

    card.append(meta, test);
    box.appendChild(card);
  }
}

async function huntWorker(name){
  const endpoint = (localStorage.getItem('webtv_hunt_web_endpoint') || '').trim().replace(/\/$/, '');
  if(!endpoint) return {items:[], skipped:true};

  const url = `${endpoint}/hunt?channel=${encodeURIComponent(name)}&days=${FRESH_DAYS}`;
  const r = await fetch(url, {cache:'no-store'});
  if(!r.ok){
    let detail = '';
    try{ detail = (await r.json())?.error || ''; }catch{}
    throw new Error(`Web Worker ${r.status}${detail ? ` · ${detail}` : ''}`);
  }

  const j = await r.json();
  return {
    items: (j.candidates || []).map(x => ({
      url: x.url,
      origin: x.origin || 'Web search',
      detail: x.title || x.source || x.snippet || '',
      updatedAt: x.updatedAt || null
    })),
    skipped:false,
    searched: j.searched || null
  };
}

async function runExternal(){
  const name = channelNameEl?.textContent?.trim();
  if(!name || name === 'Επίλεξε κανάλι') return;

  const status = $('hunt-external-status');
  if(status) status.textContent = `Searching Web + Reddit + forums for ${name}…`;
  log(`RUN EXTERNAL HUNT ${name} · Worker unified search · ${FRESH_DAYS}d`);

  try{
    const result = await huntWorker(name);
    if(result.skipped){
      render([], name, 'Worker not configured');
      log(`EXTERNAL HUNT SKIPPED ${name} · Worker not configured`);
      return;
    }
    render(result.items, name, `Worker ${result.items.length} candidate(s)`);
    log(`EXTERNAL HUNT DONE ${name} · Worker ${result.items.length}`);
  }catch(error){
    render([], name, `Worker failed · ${error.message}`);
    log(`EXTERNAL HUNT FAILED ${name} · ${error.message}`);
  }
}

ensureUi();
$('run-hunt')?.addEventListener('click', runExternal);
log(`Source Hunt Web/Forums loaded · build ${BUILD_ID} · Worker unified search`);
