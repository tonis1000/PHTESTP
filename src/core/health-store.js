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
  #key(value) { return cleanUrl(value); }
  #entry(value) {
    const key = this.#key(value);
    if (!this.map[key]) this.map[key] = { success: 0, fail: 0, consecutiveFailures: 0, cooldownUntil: 0, lastSuccess: 0, lastFailure: 0, avgStartupMs: 0, player: '', route: '' };
    return this.map[key];
  }
  recordSuccess(value, { startupMs = 0, player = '', route = '' } = {}) {
    const entry = this.#entry(value);
    entry.success += 1;
    entry.consecutiveFailures = 0;
    entry.cooldownUntil = 0;
    entry.lastSuccess = Date.now();
    entry.player = player || entry.player;
    entry.route = route || entry.route;
    if (startupMs > 0) entry.avgStartupMs = entry.avgStartupMs ? Math.round((entry.avgStartupMs * .7) + (startupMs * .3)) : Math.round(startupMs);
    this.#save();
    return entry;
  }
  recordFailure(value) {
    const entry = this.#entry(value);
    entry.fail += 1;
    entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
    entry.lastFailure = Date.now();
    if (entry.consecutiveFailures >= CONFIG.failureCooldownThreshold) {
      const exponent = entry.consecutiveFailures - CONFIG.failureCooldownThreshold;
      const delay = Math.min(CONFIG.failureCooldownBaseMs * (2 ** exponent), CONFIG.failureCooldownMaxMs);
      entry.cooldownUntil = Date.now() + delay;
    }
    this.#save();
    return entry;
  }
  get(value) { return this.map[this.#key(value)] || null; }
  isCoolingDown(value) { return (this.get(value)?.cooldownUntil || 0) > Date.now(); }
  cooldownRemainingMs(value) { return Math.max(0, (this.get(value)?.cooldownUntil || 0) - Date.now()); }
  score(value) {
    const entry = this.get(value);
    if (!entry) return 0;
    if (this.isCoolingDown(value)) return -1000;
    const attempts = entry.success + entry.fail;
    const ratio = attempts ? entry.success / attempts : 0;
    const recency = entry.lastSuccess ? Math.max(0, 1 - ((Date.now() - entry.lastSuccess) / CONFIG.healthMaxAgeMs)) : 0;
    const speed = entry.avgStartupMs > 0 ? Math.max(0, 1 - Math.min(entry.avgStartupMs, 15000) / 15000) : 0;
    const failurePenalty = Math.min((entry.consecutiveFailures || 0) * 15, 45);
    return (ratio * 70) + (recency * 20) + (speed * 10) - failurePenalty;
  }
  clear() { this.map = {}; try { localStorage.removeItem(this.storageKey); } catch {} }
  #prune() {
    const cutoff = Date.now() - CONFIG.healthMaxAgeMs;
    let changed = false;
    for (const [key, entry] of Object.entries(this.map)) {
      const newest = Math.max(entry.lastSuccess || 0, entry.lastFailure || 0);
      if (newest && newest < cutoff) { delete this.map[key]; changed = true; }
    }
    if (changed) this.#save();
  }
}
