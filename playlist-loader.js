// playlist-loader.js

// Φόρτωση και Parsing όλων των playlist URLs
export async function loadSelectedChannels() {
    let [urlsRes, selectedRes] = await Promise.all([
        fetch('playlist-urls.txt'),
        fetch('selected-channels.txt')
    ]);

    let playlistUrls = (await urlsRes.text()).split('\n').filter(Boolean);
    let selectedChannels = (await selectedRes.text())
        .split('\n')
        .map(id => id.trim().toLowerCase());

    let channelsMap = {};

    for (let url of playlistUrls) {
        try {
            let playlistText = await fetch(url).then(r => r.text());
            let lines = playlistText.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXTINF')) {
                    let tvgIdMatch = lines[i].match(/tvg-id="([^"]+)"/i);
                    if (!tvgIdMatch) continue;

                    let tvgId = tvgIdMatch[1].toLowerCase();
                    let streamUrl = lines[i + 1]?.trim();
                    let senderName = lines[i].split(',')[1]?.trim();

                    if (selectedChannels.includes(tvgId)) {
                        if (!channelsMap[tvgId]) channelsMap[tvgId] = [];
                        channelsMap[tvgId].push({ senderName, url: streamUrl });
                    }
                }
            }
        } catch (e) {
            console.error(`Error loading ${url}`, e);
        }
    }

    return channelsMap;
}

// Εύρεση καλύτερου διαθέσιμου stream
export async function getBestStream(links) {
    for (let linkObj of links) {
        try {
            let res = await fetch(linkObj.url, { method: 'HEAD', mode: 'no-cors' });
            if (res.ok || res.type === 'opaque') {
                return linkObj;
            }
        } catch {
            continue;
        }
    }
    return null;
}
