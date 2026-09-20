import { CONFIG } from '../config.js';
import { cleanUrl } from './utils.js';

export class HealthStore {
  constructor(storageKey = CONFIG.healthStorageKey) {
    this.storageKey = storageKey;
    this.map = this.#load();
    this.#prune();
  }
  #load() { try { const raw = localStorage.getItem(this.storageKey); return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
  #save() { try { localStorage.setItem(this.storageKey, JSON.stringify(this.map)); } catch {} }
  #key(url) { return cleanUrl(url); }
  #entry(url) {
    const key = this.#key(url);
    if (!this.map[key]) this.map[key] = { success: 0, fail: 0, lastSuccess: 0, lastFailure: 0, avgStartupMs: 0, player: '', route: '' };
    return this.map[key];
  }
  recordSuccess(url, { startupMs = 0, player = '', route = '' } = {}) {
    const entry = this.#entry(url);
    entry.success += 1; entry.lastSuccess = Date.now(); entry.player = player || entry.player; entry.route = route || entry.route;
    if (startupMs > 0) entry.avgStartupMs = entry.avgStartupMs ? Math.round((entry.avgStartupMs * .7) + (startupMs * .3)) : Math.round(startupMs);
    this.#save();
  }
  recordFailure(url) { const entry = this.#entry(url); entry.fail += 1; entry.lastFailure = Date.now(); this.#save(); }
  get(url) { return this.map[this.#key(url)] || null; }
  score(url) {
    const entry = this.get(url); if (!entry) return 0;
    const attempts = entry.success + entry.fail;
    const ratio = attempts ? entry.success / attempts : 0;
    const recency = entry.lastSuccess ? Math.max(0, 1 - ((Date.now() - entry.lastSuccess) / CONFIG.healthMaxAgeMs)) : 0;
    const speed = entry.avgStartupMs > 0 ? Math.max(0, 1 - Math.min(entry.avgStartupMs, 15000) / 15000) : 0;
    return (ratio * 70) + (recency * 20) + (speed * 10);
  }
  sort(urls = []) { return [...new Set(urls.map(cleanUrl).filter(Boolean))].sort((a, b) => this.score(b) - this.score(a)); }
  clear() { this.map = {}; try { localStorage.removeItem(this.storageKey); } catch {} }
  #prune() {
    const cutoff = Date.now() - CONFIG.healthMaxAgeMs; let changed = false;
    for (const [url, entry] of Object.entries(this.map)) {
      const newest = Math.max(entry.lastSuccess || 0, entry.lastFailure || 0);
      if (newest && newest < cutoff) { delete this.map[url]; changed = true; }
    }
    if (changed) this.#save();
  }
}
