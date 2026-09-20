import { CONFIG, CHANNEL_ALIASES, SOURCE_BLOCKLIST } from '../config.js?v=20260920-1021';
import { normalizeId, cleanUrl, workerUrl, isHls, isDash, isVideoFile } from './utils.js?v=20260920-1021';

function isPlayableMedia(url = '') {
  return isHls(url) || isDash(url) || isVideoFile(url);
}

function isSecureUrl(url = '') {
  return /^https:\/\//i.test(url);
}

const BLOCKED = new Set((SOURCE_BLOCKLIST || []).map(cleanUrl).filter(Boolean));
const SAVED_KEY = 'webtv_v2_saved_sources';

export class SourceRegistry {
  constructor(healthStore) {
    this.health = healthStore;
    this.remoteMap = {};
    this.aliasIndex = this.#buildAliasIndex();
  }
  #buildAliasIndex() {
    const map = new Map();
    for (const [canonical, aliases] of Object.entries(CHANNEL_ALIASES)) {
      map.set(normalizeId(canonical), canonical);
      for (const alias of aliases) map.set(normalizeId(alias), canonical);
    }
    return map;
  }
  async refresh() {
    const response = await fetch(`${CONFIG.cacheBaseUrl}/channel-streams.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`channel-streams.json HTTP ${response.status}`);
    this.remoteMap = await response.json();
    return this.remoteMap;
  }
  #candidateKeys(channel) {
    const raw = [channel.id, channel.originalId, channel.name].filter(Boolean);
    const normalized = raw.map(normalizeId);
    const canonical = normalized.map(v => this.aliasIndex.get(v)).filter(Boolean);
    return [...new Set([...raw, ...normalized, ...canonical].filter(Boolean))];
  }
  #remoteUrls(channel) {
    const keys = Object.keys(this.remoteMap || {});
    for (const candidate of this.#candidateKeys(channel)) {
      if (Array.isArray(this.remoteMap[candidate])) return this.remoteMap[candidate];
      const norm = normalizeId(candidate);
      const exact = keys.find(key => normalizeId(key) === norm);
      if (exact && Array.isArray(this.remoteMap[exact])) return this.remoteMap[exact];
    }
    return [];
  }
  #savedUrls(channel) {
    try {
      const store = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
      for (const candidate of this.#candidateKeys(channel)) {
        const key = normalizeId(candidate);
        const entries = store[key];
        if (Array.isArray(entries)) return entries.map(item => cleanUrl(item?.url || item)).filter(Boolean);
      }
    } catch {}
    return [];
  }
  #allRoutes(channel) {
    const saved = this.#savedUrls(channel);
    const savedSet = new Set(saved);
    const sources = [...new Set([...saved, ...(channel.directUrls || []), ...this.#remoteUrls(channel)]
      .map(cleanUrl)
      .filter(Boolean)
      .filter(isPlayableMedia)
      .filter(source => savedSet.has(source) || !BLOCKED.has(source)))];

    const routes = [];
    for (const source of sources) {
      if (isSecureUrl(source)) {
        routes.push({ originalUrl: source, playbackUrl: source, route: 'direct', saved: savedSet.has(source) });
      }
      if (isHls(source) && CONFIG.workerForHls) {
        routes.push({ originalUrl: source, playbackUrl: workerUrl(source), route: 'worker', saved: savedSet.has(source) });
      }
    }
    return routes.filter((item, index, arr) => arr.findIndex(other => other.playbackUrl === item.playbackUrl) === index);
  }
  getSources(channel) {
    return this.#allRoutes(channel)
      .filter(route => !this.health.isCoolingDown(route.playbackUrl))
      .sort((a, b) => {
        if (a.saved !== b.saved) return a.saved ? -1 : 1;
        return this.health.score(b.playbackUrl) - this.health.score(a.playbackUrl);
      });
  }
  getStats(channel) {
    const all = this.#allRoutes(channel);
    const cooling = all.filter(route => this.health.isCoolingDown(route.playbackUrl)).length;
    return { total: all.length, active: all.length - cooling, cooling };
  }
}
