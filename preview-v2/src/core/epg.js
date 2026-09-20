import { CONFIG, CHANNEL_ALIASES } from '../config.js';
import { normalizeId, formatTime } from './utils.js';

function parseXmltvTime(value = '') {
  const match = String(value).trim().match(/^(\d{14})(?:\s*([+-]\d{2}:?\d{2}|Z))?$/i);
  if (!match) return null;
  const d = match[1];
  const [y, mo, day, h, mi, s] = [d.slice(0,4), d.slice(4,6), d.slice(6,8), d.slice(8,10), d.slice(10,12), d.slice(12,14)].map(Number);
  let ms = Date.UTC(y, mo - 1, day, h, mi, s);
  const tz = (match[2] || 'Z').toUpperCase();
  if (tz !== 'Z') {
    const t = tz.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (!t) return null;
    const sign = t[1] === '-' ? -1 : 1;
    ms -= sign * ((Number(t[2]) * 60) + Number(t[3])) * 60000;
  }
  return new Date(ms);
}

export class EpgService {
  constructor() {
    this.programs = new Map();
    this.resolveIndex = new Map();
  }
  async refresh() {
    const response = await fetch(CONFIG.epgUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`EPG HTTP ${response.status}`);
    this.#parse(await response.text());
  }
  #parse(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XMLTV document');
    this.programs.clear(); this.resolveIndex.clear();
    for (const channel of doc.querySelectorAll('channel')) {
      const id = channel.getAttribute('id') || '';
      this.resolveIndex.set(normalizeId(id), id);
      for (const name of channel.querySelectorAll('display-name')) this.resolveIndex.set(normalizeId(name.textContent || ''), id);
    }
    for (const programme of doc.querySelectorAll('programme')) {
      const channel = programme.getAttribute('channel') || '';
      const start = parseXmltvTime(programme.getAttribute('start'));
      const stop = parseXmltvTime(programme.getAttribute('stop'));
      const title = (programme.querySelector('title')?.textContent || '').trim();
      const description = (programme.querySelector('desc')?.textContent || '').trim();
      if (!channel || !start || !stop || !title) continue;
      if (!this.programs.has(channel)) this.programs.set(channel, []);
      this.programs.get(channel).push({ start, stop, title, description });
    }
    for (const list of this.programs.values()) list.sort((a, b) => a.start - b.start);
  }
  #resolve(channel) {
    const candidates = [channel.id, channel.originalId, channel.name].filter(Boolean);
    for (const value of [...candidates]) candidates.push(...(CHANNEL_ALIASES[normalizeId(value)] || []));
    for (const candidate of candidates) {
      const norm = normalizeId(candidate);
      if (this.resolveIndex.has(norm)) return this.resolveIndex.get(norm);
      for (const key of this.programs.keys()) if (normalizeId(key) === norm) return key;
    }
    return null;
  }
  get(channel, now = new Date()) {
    const resolved = this.#resolve(channel);
    const list = resolved ? (this.programs.get(resolved) || []) : [];
    const current = list.find(p => now >= p.start && now < p.stop) || null;
    const next = list.filter(p => p.start > now).slice(0, CONFIG.maxNextPrograms);
    if (!current) return { current: null, next };
    const duration = current.stop - current.start;
    const progress = duration > 0 ? Math.max(0, Math.min(100, ((now - current.start) / duration) * 100)) : 0;
    return { current: { ...current, timeLabel: `${formatTime(current.start)} – ${formatTime(current.stop)}`, progress }, next };
  }
}
