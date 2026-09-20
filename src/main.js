import { CONFIG } from './config.js';
import { parseM3U, dedupeChannels } from './core/channel-catalog.js';
import { HealthStore } from './core/health-store.js';
import { SourceRegistry } from './core/source-registry.js';
import { EpgService } from './core/epg.js';
import { PlayerController } from './core/player.js';
import { fetchWithTimeout, formatTime } from './core/utils.js';

const $ = (id) => document.getElementById(id);
const els = {
  clock: $('clock'), list: $('channel-list'), summary: $('channel-summary'), search: $('search'), group: $('group-filter'),
  logo: $('channel-logo'), channelName: $('channel-name'), channelGroup: $('channel-group'), status: $('playback-status'),
  video: $('video'), iframe: $('iframe'), empty: $('empty-state'), programTitle: $('program-title'),
  programDescription: $('program-description'), programTime: $('program-time'), progress: $('epg-progress'),
  progressBar: $('epg-progress').querySelector('span'), next: $('next-programs'), diagnostics: $('diagnostics'),
  diagToggle: $('diagnostics-toggle'), diagSource: $('diag-source'), diagRoute: $('diag-route'), diagPlayer: $('diag-player'),
  diagStartup: $('diag-startup'), diagLog: $('diagnostic-log'), clearHealth: $('clear-health'), playlistUrl: $('playlist-url'),
  loadPlaylist: $('load-playlist'),
};

const health = new HealthStore();
const sources = new SourceRegistry(health);
const epg = new EpgService();
let channels = [];
let selected = null;

const player = new PlayerController({
  video: els.video,
  iframe: els.iframe,
  emptyState: els.empty,
  health,
  onState: setPlaybackState,
  onDiagnostics: updateDiagnostics,
});

function log(message) {
  const stamp = new Date().toLocaleTimeString();
  els.diagLog.textContent = `[${stamp}] ${message}\n${els.diagLog.textContent}`.slice(0, 12000);
}

function setPlaybackState(state, label) {
  els.status.className = `status-pill ${state}`;
  els.status.textContent = label;
}

function clearDiagnostics() {
  els.diagSource.textContent = '-';
  els.diagRoute.textContent = '-';
  els.diagPlayer.textContent = '-';
  els.diagStartup.textContent = '-';
}

function updateDiagnostics(info) {
  els.diagSource.textContent = info.source || '-';
  els.diagRoute.textContent = info.route || '-';
  els.diagPlayer.textContent = info.player || '-';
  els.diagStartup.textContent = info.startupMs ? `${info.startupMs} ms` : '-';
  if (info.error) log(`FAIL ${info.route}: ${info.error}`);
  else log(`OK ${info.player} via ${info.route} in ${info.startupMs} ms`);
}

function renderGroups() {
  const groups = [...new Set(channels.map(c => c.group || 'Other'))].sort((a, b) => a.localeCompare(b));
  els.group.innerHTML = '';
  const all = document.createElement('option');
  all.value = 'all'; all.textContent = 'Όλες οι κατηγορίες'; els.group.appendChild(all);
  for (const group of groups) {
    const option = document.createElement('option');
    option.value = group; option.textContent = group; els.group.appendChild(option);
  }
}

function filteredChannels() {
  const q = els.search.value.trim().toLowerCase();
  const group = els.group.value;
  return channels.filter(channel => {
    const searchOk = !q || `${channel.name} ${channel.originalId}`.toLowerCase().includes(q);
    const groupOk = group === 'all' || channel.group === group;
    return searchOk && groupOk;
  });
}

function renderChannels() {
  const visible = filteredChannels();
  els.summary.textContent = `${visible.length} / ${channels.length} κανάλια`;
  els.list.innerHTML = '';

  for (const channel of visible) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `channel-item${selected?.id === channel.id ? ' active' : ''}`;
    button.setAttribute('role', 'listitem');

    const logo = document.createElement('img');
    logo.alt = '';
    logo.loading = 'lazy';
    logo.src = channel.logo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="42" height="42"%3E%3Crect width="100%25" height="100%25" rx="8" fill="%2310161c"/%3E%3C/svg%3E';

    const meta = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = channel.name;
    const group = document.createElement('span');
    group.textContent = channel.group || 'Other';
    meta.append(name, group);

    const count = document.createElement('span');
    count.className = 'source-count';
    count.textContent = `${sources.getSources(channel).length}`;
    count.title = 'Playback routes';

    button.append(logo, meta, count);
    button.addEventListener('click', () => selectChannel(channel));
    els.list.appendChild(button);
  }
}

async function selectChannel(channel) {
  selected = channel;
  renderChannels();
  els.channelName.textContent = channel.name;
  els.channelGroup.textContent = channel.group || 'WEBTV';
  if (channel.logo) { els.logo.src = channel.logo; els.logo.hidden = false; } else { els.logo.hidden = true; }
  clearDiagnostics();

  renderEpg();
  const routes = sources.getSources(channel);
  log(`${channel.name}: ${routes.length} playback routes`);
  try { await player.play(channel, routes); }
  catch (error) { log(`${channel.name}: ${error.message}`); }
}

function renderEpg() {
  if (!selected) return;
  const { current, next } = epg.get(selected);
  if (!current) {
    els.programTitle.textContent = 'Δεν υπάρχουν τρέχοντα δεδομένα EPG';
    els.programDescription.textContent = '';
    els.programTime.textContent = '';
    els.progress.hidden = true;
  } else {
    els.programTitle.textContent = current.title;
    els.programDescription.textContent = current.description || '';
    els.programTime.textContent = current.timeLabel;
    els.progress.hidden = false;
    els.progressBar.style.width = `${current.progress}%`;
  }

  els.next.innerHTML = '';
  for (const item of next) {
    const card = document.createElement('div');
    card.className = 'next-card';
    const time = document.createElement('time');
    time.textContent = `${formatTime(item.start)} – ${formatTime(item.stop)}`;
    const title = document.createElement('strong');
    title.textContent = item.title;
    card.append(time, title);
    els.next.appendChild(card);
  }
}

async function loadExternalPlaylist() {
  const url = els.playlistUrl.value.trim();
  if (!url) return;
  els.loadPlaylist.disabled = true;
  try {
    const response = await fetchWithTimeout(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const imported = parseM3U(await response.text());
    channels = dedupeChannels([...channels, ...imported]);
    renderGroups(); renderChannels();
    log(`Imported ${imported.length} channels from external M3U`);
  } catch (error) {
    log(`External playlist failed: ${error.message}`);
  } finally {
    els.loadPlaylist.disabled = false;
  }
}

function startClock() {
  const tick = () => { els.clock.textContent = new Date().toLocaleString('de-DE'); };
  tick(); setInterval(tick, 1000);
}

async function boot() {
  startClock();
  setPlaybackState('idle', 'Idle');
  clearDiagnostics();

  const catalogResponse = await fetch(CONFIG.channelCatalogUrl, { cache: 'no-store' });
  if (!catalogResponse.ok) throw new Error(`Catalog HTTP ${catalogResponse.status}`);
  channels = parseM3U(await catalogResponse.text());

  const sourceTask = sources.refresh().then(() => log('Source registry loaded')).catch(error => log(`Source registry unavailable: ${error.message}`));
  const epgTask = epg.refresh().then(() => { log('EPG loaded'); renderEpg(); }).catch(error => log(`EPG unavailable: ${error.message}`));

  await sourceTask;
  renderGroups(); renderChannels();
  await epgTask;

  setInterval(renderEpg, 30000);
  setInterval(() => epg.refresh().then(renderEpg).catch(error => log(`EPG refresh failed: ${error.message}`)), CONFIG.epgRefreshMs);
}

els.search.addEventListener('input', renderChannels);
els.group.addEventListener('change', renderChannels);
els.diagToggle.addEventListener('click', () => { els.diagnostics.hidden = !els.diagnostics.hidden; });
els.clearHealth.addEventListener('click', () => { health.clear(); log('Health data cleared'); renderChannels(); });
els.loadPlaylist.addEventListener('click', loadExternalPlaylist);
els.playlistUrl.addEventListener('keydown', event => { if (event.key === 'Enter') loadExternalPlaylist(); });

boot().catch(error => {
  setPlaybackState('error', 'Boot failed');
  log(`BOOT ERROR: ${error.message}`);
  console.error(error);
});
