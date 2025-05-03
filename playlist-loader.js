// 📁 playlist-loader.js
// Φορτώνει επιλεγμένα κανάλια από πολλαπλές playlists με βάση το tvg-id

// Ελέγχει αν ένα stream link είναι online
async function isStreamOnline(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    return res.ok || res.type === 'opaque';
  } catch (e) {
    return false;
  }
}

// Επιστρέφει ένα προσωρινό M3U string με τα "καλύτερα" ενεργά streams μόνο για τα selected tvg-id
export async function getCombinedM3UFromExternalSources() {
  const [urlsRes, selectedRes] = await Promise.all([
    fetch('playlist-urls.txt'),
    fetch('selected-channels.txt')
  ]);

  const selectedIDs = (await selectedRes.text())
    .split('\n')
    .map(id => id.trim().toLowerCase())
    .filter(Boolean);

  const urlsText = await urlsRes.text();
  const lines = urlsText.split('\n').filter(Boolean);

  const playlistUrls = [];
  for (let line of lines) {
    if (!line.includes(',')) continue;
    const [label, url] = line.split(',').map(x => x.trim());
    if (url) playlistUrls.push(url);
  }

  const channelsByID = {}; // tvg-id -> best stream

  for (let url of playlistUrls) {
    try {
      const data = await fetch(url).then(r => r.text());
      const lines = data.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('#EXTINF')) continue;

        const idMatch = lines[i].match(/tvg-id="([^"]+)"/i);
        const tvgId = idMatch ? idMatch[1].toLowerCase() : null;
        if (!tvgId || !selectedIDs.includes(tvgId)) continue;

        const streamLine = lines[i + 1]?.trim();
        if (!streamLine || !streamLine.startsWith('http')) continue;

        const isOnline = await isStreamOnline(streamLine);
        if (!isOnline) continue;

        const extension = streamLine.split('?')[0].split('.').pop().toLowerCase();
        const priority = ['m3u8', 'mpd', 'mp4', 'ts'].indexOf(extension);

        if (!channelsByID[tvgId] || priority < channelsByID[tvgId].priority) {
          channelsByID[tvgId] = {
            extinf: lines[i],
            url: streamLine,
            priority
          };
        }
      }
    } catch (e) {
      console.warn("Fehler beim Parsen von:", url, e);
    }
  }

  // Δημιουργία προσωρινού M3U για φόρτωση στο updateSidebarFromM3U()
  let m3u = '#EXTM3U\n';
  for (const entry of Object.values(channelsByID)) {
    m3u += `${entry.extinf}\n${entry.url}\n`;
  }
  return m3u;
}
