const BUILD_ID = '20260920-1145';
const API = 'https://api.github.com';
const $ = id => document.getElementById(id);

const panel = $('source-hunt');
const channelNameEl = $('channel-name');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagLog = $('diagnostic-log');

const CHANNEL_FINGERPRINTS = {
  'ERT1': ['ert1', 'ert 1', 'ert1.gr', 'ept1'],
  'ERT2': ['ert2', 'ert 2', 'ert2.gr', 'ept2'],
  'ERT3': ['ert3', 'ert 3', 'ert3.gr', 'ept3'],
  'ERT News': ['ertnews', 'ert news', 'ert_news', 'ert-news', 'ertnews.gr'],
  'ANT1': ['ant1', 'antenna1', 'antenna gr', 'ant1.gr'],
  'Alpha TV': ['alpha tv', 'alphatv', 'alpha.gr'],
  'SKAI': ['skai', 'skaitv', 'skai tv', 'skai.gr'],
  'Open TV': ['open tv', 'opentv', 'open beyond', 'open.gr'],
  'MEGA': ['mega tv', 'megatv', 'mega channel', 'mega.gr'],
  'Star TV': ['star tv', 'startv', 'star channel', 'star.gr'],
  'Action 24': ['action 24', 'action24', 'action tv', 'action24.gr'],
  'Kontra': ['kontra', 'kontra channel', 'kontrachannel.gr'],
};

const SEED_REPOS = [
  'kilirushi/iptv',
  'iptv-org/iptv',
  'LIVE-GRECO/TV-LIVE-GRECO',
  'don24crk/Don24crk-Repository',
  'sieutv/livetv',
  'jimgate07/grtv',
];

function log(message) {
  if (!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
}

function sinceDate(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function extractM3u8(text = '') {
  const found = text.match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/gi) || [];
  return [...new Set(found.map(url => url.replace(/[),.;]+$/g, '')))];
}

function fingerprints(name) {
  return CHANNEL_FINGERPRINTS[name] || [String(name || '').toLowerCase()];
}

function normalize(text = '') {
  return String(text).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi, ' ');
}

function relevance(text, name) {
  const hay = normalize(text);
  let best = 0;
  for (const fp of fingerprints(name)) {
    const needle = normalize(fp).trim();
    if (!needle) continue;
    if (hay.includes(needle)) best = Math.max(best, needle.length >= 6 ? 4 : 3);
  }
  return best;
}

function urlRelevance(url, name) {
  return relevance(url, name);
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

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function collectFromM3U(text, name, meta) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;
    const headerScore = relevance(line, name);
    if (!headerScore) continue;

    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (!next) { j++; continue; }
      if (next.startsWith('#EXTINF')) break;
      if (next.startsWith('#')) { j++; continue; }
      const urls = extractM3u8(next);
      for (const url of urls) {
        out.push({
          url,
          origin: `${meta.origin} · M3U exact`,
          detail: meta.detail,
          updatedAt: meta.updatedAt,
          score: 40 + headerScore * 5 + urlRelevance(url, name) * 3,
        });
      }
      break;
    }
  }
  return out;
}

function collectFromLooseText(text, name, meta) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\.m3u8/i.test(lines[i])) continue;
    const line = lines[i];
    const u = extractM3u8(line);
    if (!u.length) continue;
    const tightContext = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n');
    const contextScore = relevance(tightContext, name);
    for (const url of u) {
      const uScore = urlRelevance(url, name);
      if (!uScore && !contextScore) continue;
      out.push({
        url,
        origin: meta.origin,
        detail: meta.detail,
        updatedAt: meta.updatedAt,
        score: 12 + contextScore * 3 + uScore * 5,
      });
    }
  }
  return out;
}

function collectFromText(text, name, meta) {
  const isM3U = /#EXTM3U|#EXTINF/i.test(text) || /\.m3u8?$/i.test(meta.detail || '');
  const exact = isM3U ? collectFromM3U(text, name, meta) : [];
  if (exact.length) return exact;
  return collectFromLooseText(text, name, meta);
}

async function huntIssues(name, since) {
  const primary = fingerprints(name)[0] || name;
  const q = `"${primary}" m3u8 updated:>=${since}`;
  const data = await gh(`/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=12`);
  const out = [];
  for (const item of data.items || []) {
    const body = `${item.title || ''}\n${item.body || ''}`;
    if (!relevance(body, name)) continue;
    out.push(...collectFromLooseText(body, name, {
      origin: 'GitHub issue',
      detail: item.repository_url?.split('/repos/')[1] || item.html_url,
      updatedAt: item.updated_at,
    }));
  }
  return out;
}

async function discoverRepos(name) {
  const repos = new Map();
  for (const full of SEED_REPOS) repos.set(full, { full_name: full, default_branch: 'main', updated_at: null, seeded: true });
  const primary = fingerprints(name)[0] || name;
  const queries = [`${primary} IPTV Greece`, `${primary} m3u Greece`, 'Greek IPTV playlist'];
  for (const q of queries) {
    try {
      const data = await gh(`/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=6`);
      for (const repo of data.items || []) repos.set(repo.full_name, repo);
    } catch {}
  }
  return [...repos.values()].slice(0, 10);
}

function pathScore(path = '') {
  const p = path.toLowerCase();
  let score = 0;
  if (/\.m3u8?$/.test(p)) score += 8;
  if (/\.(txt|md|html?|js|json)$/.test(p)) score += 2;
  if (/(greek|greece|\bgr\b|iptv|playlist|channel|tv)/.test(p)) score += 5;
  return score;
}

async function repoMeta(repo) {
  if (repo.default_branch && !repo.seeded) return repo;
  try { return await gh(`/repos/${repo.full_name}`); }
  catch { return repo; }
}

async function deepScanRepo(repo, name) {
  const meta = await repoMeta(repo);
  const branch = meta.default_branch || 'main';
  let tree;
  try { tree = await gh(`/repos/${repo.full_name}/git/trees/${encodeURIComponent(branch)}?recursive=1`); }
  catch { return []; }

  const files = (tree.tree || [])
    .filter(item => item.type === 'blob' && /\.(m3u8?|txt|md|html?|js|json)$/i.test(item.path || ''))
    .map(item => ({ ...item, priority: pathScore(item.path) + relevance(item.path, name) * 8 }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20);

  const out = [];
  for (const file of files) {
    const raw = `https://raw.githubusercontent.com/${repo.full_name}/${encodeURIComponent(branch)}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const text = await fetchText(raw);
      if (!relevance(text, name) && !relevance(file.path, name)) continue;
      out.push(...collectFromText(text, name, {
        origin: 'GitHub deep scan',
        detail: `${repo.full_name}/${file.path}`,
        updatedAt: meta.updated_at || repo.updated_at,
      }));
    } catch {}
  }
  return out;
}

async function huntRepositories(name) {
  const repos = await discoverRepos(name);
  const out = [];
  for (const repo of repos) {
    try { out.push(...await deepScanRepo(repo, name)); }
    catch {}
  }
  return out;
}

function dedupeAndRank(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.url) || (item.score || 0) > (map.get(item.url).score || 0)) map.set(item.url, item);
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
  wrap.innerHTML = `<div class="hunt-auto-head"><div><strong>Automatic Hunt</strong><span id="hunt-auto-status">Ready · exact channel parser</span></div><button id="run-hunt" class="button" type="button">Run Hunt</button></div><div id="hunt-results" class="hunt-results"></div>`;
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
    empty.textContent = `Δεν βρέθηκε exact candidate για ${name}. Το Hunt πλέον απορρίπτει γειτονικά κανάλια από playlists.`;
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
  const since = sinceDate(30);
  if (button) button.disabled = true;
  if (status) status.textContent = `Exact searching ${name}…`;
  log(`RUN HUNT ${name} · M3U-aware deep GitHub scan · since ${since}`);
  try {
    const settled = await Promise.allSettled([huntIssues(name, since), huntRepositories(name)]);
    const combined = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const items = dedupeAndRank(combined);
    renderResults(items, name);
    const failures = settled.filter(result => result.status === 'rejected').length;
    if (status) status.textContent = `${items.length} exact candidate${items.length === 1 ? '' : 's'}${failures ? ' · partial' : ''}`;
    log(`HUNT DONE ${name} · ${items.length} exact candidate(s) · M3U-aware${failures ? ` · ${failures} source(s) failed` : ''}`);
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
  log(`Source Hunt engine loaded · build ${BUILD_ID} · M3U-aware exact matching`);
}
