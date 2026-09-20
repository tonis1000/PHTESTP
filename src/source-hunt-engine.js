const BUILD_ID = '20260920-1100';
const API = 'https://api.github.com';
const $ = id => document.getElementById(id);

const panel = $('source-hunt');
const channelNameEl = $('channel-name');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagLog = $('diagnostic-log');

const CHANNEL_FINGERPRINTS = {
  ert1: ['ert1', 'ert 1', 'ert_1', 'ert-1', 'ept1', 'ερτ1', 'ερτ 1'],
  ert2: ['ert2', 'ert 2', 'ert_2', 'ert-2', 'ept2', 'ερτ2', 'ερτ 2'],
  ert3: ['ert3', 'ert 3', 'ert_3', 'ert-3', 'ept3', 'ερτ3', 'ερτ 3'],
  ertnews: ['ertnews', 'ert news', 'ert_news', 'ert-news', 'ερτnews', 'ερτ news'],
  ant1: ['ant1', 'ant 1', 'antenna1', 'antenna 1'],
  alphatv: ['alpha tv', 'alphatv', 'alpha.gr', 'alpha hd'],
  skai: ['skai', 'skai tv', 'skaitv', 'skai.gr', 'σκαι'],
  opentv: ['open tv', 'opentv', 'open beyond', 'open.gr'],
  mega: ['mega tv', 'megatv', 'mega channel', 'mega.gr'],
  startv: ['star tv', 'startv', 'star channel', 'star.gr'],
  action24: ['action 24', 'action24', 'action tv', 'actiontv'],
  kontra: ['kontra', 'kontra channel', 'kontratv'],
};

function log(message) {
  if (!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9α-ω]+/g, ' ')
    .trim();
}

function channelKey(name = '') {
  const n = normalize(name).replace(/\s+/g, '');
  if (n.startsWith('ertnews')) return 'ertnews';
  if (n.startsWith('ert1')) return 'ert1';
  if (n.startsWith('ert2')) return 'ert2';
  if (n.startsWith('ert3')) return 'ert3';
  if (n.startsWith('ant1')) return 'ant1';
  if (n.includes('alpha')) return 'alphatv';
  if (n.includes('skai')) return 'skai';
  if (n === 'open' || n.includes('opentv')) return 'opentv';
  if (n.includes('mega')) return 'mega';
  if (n.includes('star')) return 'startv';
  if (n.includes('action24')) return 'action24';
  if (n.includes('kontra')) return 'kontra';
  return n;
}

function fingerprints(name) {
  const key = channelKey(name);
  const aliases = CHANNEL_FINGERPRINTS[key] || [name];
  return [...new Set(aliases.map(normalize).filter(Boolean))];
}

function sinceDate(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function extractM3u8(text = '') {
  const found = text.match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/gi) || [];
  return [...new Set(found.map(url => url.replace(/[),.;]+$/g, '')))];
}

function relevance(text, url, name) {
  const hay = normalize(`${text || ''} ${url || ''}`);
  const compact = hay.replace(/\s+/g, '');
  const aliases = fingerprints(name);
  let score = 0;
  for (const alias of aliases) {
    if (hay.includes(alias)) score += 4;
    const compactAlias = alias.replace(/\s+/g, '');
    if (compactAlias.length >= 4 && compact.includes(compactAlias)) score += 3;
  }
  return score;
}

function isStrongMatch(text, url, name) {
  return relevance(text, url, name) >= 4;
}

async function gh(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    throw new Error(`GitHub API ${response.status}${remaining === '0' ? ' · rate limit reached' : ''}`);
  }
  return response.json();
}

async function huntIssues(name, since) {
  const aliases = fingerprints(name).slice(0, 3);
  const out = [];
  for (const alias of aliases) {
    const q = `"${alias}" m3u8 updated:>=${since}`;
    let data;
    try {
      data = await gh(`/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=8`);
    } catch {
      continue;
    }
    for (const item of data.items || []) {
      const body = `${item.title || ''}\n${item.body || ''}`;
      for (const url of extractM3u8(body)) {
        if (!isStrongMatch(body, url, name)) continue;
        out.push({
          url,
          origin: 'GitHub issue',
          detail: item.repository_url?.split('/repos/')[1] || item.html_url,
          updatedAt: item.updated_at,
          score: 8 + relevance(body, url, name),
        });
      }
    }
  }
  return out;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function huntRepositories(name, since) {
  const aliases = fingerprints(name).slice(0, 4);
  const queries = aliases.flatMap(alias => [
    `${alias} IPTV Greece`,
    `${alias} m3u Greece`,
  ]);

  const repos = new Map();
  for (const q of queries) {
    try {
      const data = await gh(`/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=5`);
      for (const repo of data.items || []) repos.set(repo.full_name, repo);
    } catch {}
  }

  const recentCutoff = new Date(`${since}T00:00:00Z`).getTime();
  const selectedRepos = [...repos.values()]
    .filter(repo => !repo.updated_at || new Date(repo.updated_at).getTime() >= recentCutoff)
    .slice(0, 8);

  const out = [];
  for (const repo of selectedRepos) {
    const candidateFiles = [];
    try {
      const root = await gh(`/repos/${repo.full_name}/contents`);
      for (const item of root || []) {
        if (item.type === 'file' && /\.(m3u8?|txt|md)$/i.test(item.name || '')) candidateFiles.push(item);
      }
    } catch {}

    for (const item of candidateFiles.slice(0, 6)) {
      if (!item.download_url) continue;
      try {
        const text = await fetchText(item.download_url);
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (!/\.m3u8/i.test(lines[i])) continue;
          const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 2)).join('\n');
          const urls = extractM3u8(context);
          for (const url of urls) {
            if (!isStrongMatch(context, url, name)) continue;
            out.push({
              url,
              origin: 'GitHub playlist',
              detail: `${repo.full_name}/${item.name}`,
              updatedAt: repo.updated_at,
              score: 10 + relevance(context, url, name),
            });
          }
        }
      } catch {}
    }
  }
  return out;
}

function dedupeAndRank(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.url;
    if (!map.has(key) || (item.score || 0) > (map.get(key).score || 0)) map.set(key, item);
  }
  return [...map.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 12);
}

function ensureUi() {
  if (!panel) return null;
  let wrap = $('hunt-auto');
  if (wrap) return wrap;

  wrap = document.createElement('div');
  wrap.id = 'hunt-auto';
  wrap.className = 'hunt-auto';
  wrap.innerHTML = `
    <div class="hunt-auto-head">
      <div><strong>Automatic Hunt</strong><span id="hunt-auto-status">Ready · strict channel match</span></div>
      <button id="run-hunt" class="button" type="button">Run Hunt</button>
    </div>
    <div id="hunt-results" class="hunt-results"></div>
  `;
  const tester = panel.querySelector('.candidate-tester');
  panel.insertBefore(wrap, tester || null);
  return wrap;
}

function renderResults(items, name) {
  const results = $('hunt-results');
  if (!results) return;
  results.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'hunt-empty';
    empty.textContent = `Δεν βρέθηκαν αξιόπιστα .m3u8 candidates που να ταιριάζουν αυστηρά με ${name}. Καλύτερα 0 σωστά παρά 20 άσχετα.`;
    results.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'hunt-result';

    const meta = document.createElement('div');
    const source = document.createElement('strong');
    source.textContent = item.origin;
    const detail = document.createElement('span');
    const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('de-DE') : '';
    detail.textContent = `${item.detail || ''}${date ? ` · ${date}` : ''}`;
    const url = document.createElement('code');
    url.textContent = item.url;
    meta.append(source, detail, url);

    const test = document.createElement('button');
    test.type = 'button';
    test.className = 'button';
    test.textContent = 'Test';
    test.addEventListener('click', () => {
      if (candidateInput) candidateInput.value = item.url;
      candidateInput?.dispatchEvent(new Event('input', { bubbles: true }));
      testButton?.click();
      log(`HUNT candidate selected · ${name} · ${item.url}`);
    });

    card.append(meta, test);
    results.appendChild(card);
  }
}

async function runHunt() {
  const name = channelNameEl?.textContent?.trim();
  if (!name || name === 'Επίλεξε κανάλι') return;
  const button = $('run-hunt');
  const status = $('hunt-auto-status');
  const since = sinceDate(14);
  if (button) button.disabled = true;
  if (status) status.textContent = `Searching ${name} · strict match…`;
  log(`RUN HUNT ${name} · strict channel match · since ${since}`);

  try {
    const settled = await Promise.allSettled([
      huntIssues(name, since),
      huntRepositories(name, since),
    ]);
    const combined = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const items = dedupeAndRank(combined);
    renderResults(items, name);
    const failures = settled.filter(result => result.status === 'rejected').length;
    if (status) status.textContent = `${items.length} strict candidate${items.length === 1 ? '' : 's'}${failures ? ' · partial search' : ''}`;
    log(`HUNT DONE ${name} · ${items.length} strict candidate(s)${failures ? ` · ${failures} source(s) failed` : ''}`);
  } catch (error) {
    if (status) status.textContent = `Search failed: ${error.message}`;
    renderResults([], name);
    log(`HUNT ERROR ${name} · ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

if (ensureUi()) {
  $('run-hunt')?.addEventListener('click', runHunt);
  log(`Source Hunt engine loaded · build ${BUILD_ID} · strict relevance`);
}
