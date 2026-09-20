import { normalizeId } from './utils.js';

function attr(line, name) {
  const quoted = line.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  if (quoted) return quoted[1].trim();
  const bare = line.match(new RegExp(`${name}=([^\s,]+)`, 'i'));
  return bare ? bare[1].replace(/^['"]|['"]$/g, '').trim() : '';
}

export function parseM3U(text = '') {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const channels = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;
    const fallbackName = (line.split(',').slice(1).join(',') || '').trim();
    const id = attr(line, 'tvg-id') || attr(line, 'tvg-name') || fallbackName;
    const name = attr(line, 'tvg-name') || fallbackName || id || 'Unknown';
    const logo = attr(line, 'tvg-logo');
    const group = attr(line, 'group-title') || 'Other';
    let directUrl = '';
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j].trim();
      if (!candidate) continue;
      if (candidate.startsWith('#EXTINF')) break;
      if (!candidate.startsWith('#') && /^https?:\/\//i.test(candidate)) { directUrl = candidate; break; }
    }
    channels.push({ id: normalizeId(id || name), originalId: id || name, name, logo, group, directUrls: directUrl ? [directUrl] : [] });
  }
  return dedupeChannels(channels);
}

export function dedupeChannels(channels = []) {
  const map = new Map();
  for (const channel of channels) {
    const key = normalizeId(channel.id || channel.originalId || channel.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { ...channel, id: key, directUrls: [...(channel.directUrls || [])] });
    else {
      const current = map.get(key);
      current.directUrls = [...new Set([...(current.directUrls || []), ...(channel.directUrls || [])])];
      if (!current.logo && channel.logo) current.logo = channel.logo;
      if ((!current.group || current.group === 'Other') && channel.group) current.group = channel.group;
    }
  }
  return [...map.values()];
}
