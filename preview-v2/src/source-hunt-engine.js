const BUILD_ID = '20260920-1035';
const API = 'https://api.github.com';
const $ = id => document.getElementById(id);

const panel = $('source-hunt');
const channelNameEl = $('channel-name');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagLog = $('diagnostic-log');

function log(message) {
  if (!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
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

function scoreContext(text, channelName) {
  const hay = String(text || '').toLowerCase();
  const words = String(channelName || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return words.reduce((score, word) => score + (hay.includes(word) ? 1 : 0), 0);
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
  const q = `"${name}" m3u8 updated:>=${since}`;
  const data = await gh(`/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=10`);
  const out = [];
  for (const item of data.items || []) {
    const body = `${item.title || ''}\n${item.body || ''}`;
    for (const url of extractM3u8(body)) {
      out.push({ url, origin: 'GitHub issue', detail: item.repository_url?.split('/repos/')[1] || item.html_url, updatedAt: item.updated_at, score: 4 + scoreContext(body, name) });
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
  const queries = [
    `${name} IPTV Greece`,
    `${name} m3u Greece`,
    `Greek IPTV playlist`,
  ];
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
    .slice(0, 5);

  const out = [];
  for (const repo of selectedRepos) {
    const candidateFiles = [];
    try {
      const root = await gh(`/repos/${repo.full_name}/contents`);
      for (const item of root || []) {
        if (item.type === 'file' && /\.(m3u8?|txt|md)$/i.test(item.name || '')) candidateFiles.push(item);
      }
    } catch {}

    for (const item of candidateFiles.slice(0, 4)) {
      if (!item.download_url) continue;
      try {
        const text = await fetchText(item.download_url);
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n');
          const relevance = scoreContext(context, name);
          if (!relevance) continue;
          for (const url of extractM3u8(context)) {
            out.push({
              url,
              origin: 'GitHub playlist',
              detail: `${repo.full_name}/${item.name}`,
              updatedAt: repo.updated_at,
              score: 5 + relevance,
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
    .slice(0, 20);
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
      <div><strong>Automatic Hunt</strong><span id="hunt-auto-status">Ready</span></div>
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
    empty.textContent = `Δεν βρέθηκαν αυτόματα νέα .m3u8 candidates για ${name}. Τα manual search links παραμένουν διαθέσιμα από κάτω.`;
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
  if (status) status.textContent = `Searching ${name}…`;
  log(`RUN HUNT ${name} · GitHub public API · since ${since}`);

  try {
    const settled = await Promise.allSettled([
      huntIssues(name, since),
      huntRepositories(name, since),
    ]);
    const combined = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const items = dedupeAndRank(combined);
    renderResults(items, name);
    const failures = settled.filter(result => result.status === 'rejected').length;
    if (status) status.textContent = `${items.length} candidate${items.length === 1 ? '' : 's'}${failures ? ' · partial search' : ''}`;
    log(`HUNT DONE ${name} · ${items.length} candidate(s)${failures ? ` · ${failures} source(s) failed` : ''}`);
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
  log(`Source Hunt engine loaded · build ${BUILD_ID}`);
}
