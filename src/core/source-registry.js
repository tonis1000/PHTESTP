import { CONFIG, CHANNEL_ALIASES, SOURCE_BLOCKLIST } from '../config.js?v=20260920-1015';
import { normalizeId, cleanUrl, workerUrl, isHls, isDash, isVideoFile } from './utils.js?v=20260920-1015';

function isPlayableMedia(url = '') {
  return isHls(url) || isDash(url) || isVideoFile(url);
}

function isSecureUrl(url = '') {
  return /^https:\/\//i.test(url);
}

const BLOCKED = new Set((SOURCE_BLOCKLIST || []).map(cleanUrl).filter(Boolean));

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
  #allRoutes(channel) {
    const sources = [...new Set([...(channel.directUrls || []), ...this.#remoteUrls(channel)]
      .map(cleanUrl)
      .filter(Boolean)
      .filter(isPlayableMedia)
      .filter(source => !BLOCKED.has(source)))];

    const routes = [];
    for (const source of sources) {
      if (isSecureUrl(source)) {
        routes.push({ originalUrl: source, playbackUrl: source, route: 'direct' });
      }
      if (isHls(source) && CONFIG.workerForHls) {
        routes.push({ originalUrl: source, playbackUrl: workerUrl(source), route: 'worker' });
      }
    }
    return routes.filter((item, index, arr) => arr.findIndex(other => other.playbackUrl === item.playbackUrl) === index);
  }
  getSources(channel) {
    return this.#allRoutes(channel)
      .filter(route => !this.health.isCoolingDown(route.playbackUrl))
      .sort((a, b) => this.health.score(b.playbackUrl) - this.health.score(a.playbackUrl));
  }
  getStats(channel) {
    const all = this.#allRoutes(channel);
    const cooling = all.filter(route => this.health.isCoolingDown(route.playbackUrl)).length;
    return { total: all.length, active: all.length - cooling, cooling };
  }
}
