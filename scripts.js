// WebTV scripts.js - Combined functionality as requested

// Proxy list for CORS fallback (point 3)
const proxyList = [
    '',  // try direct (no proxy) first
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url='
    // Add more proxy URLs if needed
];

let channels = [];               // array of channel objects {name, url, type, logo, group, online, epgNow, epgNext, subtitles}
let currentChannelIndex = null;  // currently selected channel index, if any

// DOM elements (assume these IDs exist in HTML)
let videoPlayer, iframePlayer;
let urlInput;
let playBtn, loadBtn, copyBtn, clearBtn;
let searchInput;
let filterOnlineBtn, filterAllBtn;
let channelListContainer;
// (If sidebar current info is separate, could select those too, but info is shown in list items as per EPG requirement)


// HLS.js and Dash.js player instances (if needed)
let hls = null;
let dashPlayer = null;

// Utility: Detect stream type from URL (point 1)
function detectType(url) {
    let u = url.trim().toLowerCase();
    if (u.endsWith('.m3u8') || u.includes('.m3u8?')) {
        return 'hls';
    }
    if (u.endsWith('.mpd') || u.includes('.mpd?')) {
        return 'dash';
    }
    if (u.endsWith('.mp4') || u.includes('.mp4?') || u.endsWith('.webm') || u.endsWith('.ogg')) {
        return 'video';
    }
    if (u.startsWith('<iframe') || u.startsWith('&lt;iframe')) {
        return 'iframe';
    }
    // Default fallback type is 'iframe' (for embed URLs or unknown types)
    return 'iframe';
}

// Parse playlist text (M3U or custom format) and fill channels list (points 1,8,9)
function parsePlaylistText(content, clearExisting = false) {
    if (clearExisting) {
        channels = [];
    }
    let lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('#EXTINF')) {
            // Parse EXTINF line for channel metadata
            // Format: #EXTINF:<duration> <attributes>,<channel name>
            let meta = line.substring(line.indexOf(':') + 1);
            let commaIndex = meta.indexOf(',');
            let name = '';
            let attrStr = '';
            if (commaIndex !== -1) {
                name = meta.substring(commaIndex + 1).trim();
                attrStr = meta.substring(0, commaIndex).trim();
            } else {
                name = meta.trim();
                attrStr = '';
            }
            // Parse attributes (after duration)
            let attrs = {};
            if (attrStr) {
                // Split duration and attributes
                let spaceIdx = attrStr.indexOf(' ');
                if (spaceIdx !== -1) {
                    // duration part (not used, but could parse if needed)
                    // let duration = attrStr.substring(0, spaceIdx);
                    let attrPart = attrStr.substring(spaceIdx + 1);
                    // Regex to capture key="value" pairs
                    let attrRegex = /([A-Za-z0-9_-]+)=\"([^\"]*)\"/g;
                    let match;
                    while ((match = attrRegex.exec(attrPart)) !== null) {
                        attrs[match[1]] = match[2];
                    }
                } else {
                    // Only duration present, no attributes
                    // let duration = attrStr;
                }
            }
            // Look ahead for any EXTVLCOPT lines (e.g. subtitles) before the URL line
            let subtitleUrl = null;
            let j = i + 1;
            while (j < lines.length && lines[j].trim().startsWith('#EXTVLCOPT')) {
                let optLine = lines[j].trim();
                // Check for subtitle file option (common in VLC playlists)
                if (optLine.toLowerCase().includes('sub-file') || optLine.toLowerCase().includes('subtitle')) {
                    let eqIdx = optLine.indexOf('=');
                    if (eqIdx !== -1) {
                        let subVal = optLine.substring(eqIdx + 1).trim();
                        if (subVal) {
                            subtitleUrl = subVal;
                        }
                    }
                }
                j++;
            }
            // The next non-# line after the EXTINF and any EXTVLCOPT lines is the stream URL
            if (j < lines.length) {
                let url = lines[j].trim();
                if (url && !url.startsWith('#')) {
                    // Create channel entry
                    let type = detectType(url);
                    let logo = attrs['tvg-logo'] || null;
                    let group = attrs['group-title'] || null;
                    let tvgId = attrs['tvg-id'] || null;
                    let tvgName = attrs['tvg-name'] || null;
                    // Determine online status (point 6)
                    let online = true;
                    if (name.toLowerCase().includes('offline') || name.toLowerCase().includes('off-line')) {
                        online = false;
                    }
                    // EPG info (if embedded in name or available via attributes, not standard but just in case)
                    let epgNow = null;
                    let epgNext = null;
                    // (If name contains " | " or similar pattern with now/next, parse here if needed)

                    channels.push({
                        name: name,
                        url: url,
                        type: type,
                        logo: logo,
                        group: group,
                        online: online,
                        epgNow: epgNow,
                        epgNext: epgNext,
                        subtitles: subtitleUrl
                    });
                    i = j; // skip ahead to the URL line index
                }
            }
        } else if (line.startsWith('#EXTVLCOPT')) {
            // EXTVLCOPT line that appeared without EXTINF (should be rare) - ignore or handle if needed
            continue;
        } else if (line.startsWith('#')) {
            // Other metadata lines (#EXTM3U, #EXTGRP, etc.) can be ignored for now
            continue;
        } else {
            // This is a line not starting with '#' - likely a direct URL or "Name - URL" entry (support playlist-urls.txt format)
            let name = '';
            let url = '';
            if (line.toLowerCase().startsWith('http')) {
                // URL with no name (just a URL on the line)
                url = line;
                name = 'Stream ' + (channels.length + 1);
            } else {
                // Possibly "Name, URL" or "Name - URL"
                let httpIndex = line.toLowerCase().indexOf('http');
                if (httpIndex !== -1) {
                    name = line.substring(0, httpIndex).trim();
                    url = line.substring(httpIndex).trim();
                    // Remove trailing separators from name
                    if (name.endsWith('-') || name.endsWith(':') || name.endsWith('|') || name.endsWith(',')) {
                        name = name.slice(0, -1).trim();
                    }
                    if (!name) {
                        name = 'Stream ' + (channels.length + 1);
                    }
                } else {
                    // Line without "http" - skip (or treat as name for next URL? Unlikely scenario)
                    continue;
                }
            }
            if (!url) continue;
            let type = detectType(url);
            let online = true;
            if (name.toLowerCase().includes('offline')) {
                online = false;
            }
            channels.push({
                name: name,
                url: url,
                type: type,
                logo: null,
                group: null,
                online: online,
                epgNow: null,
                epgNext: null,
                subtitles: null
            });
        }
    }
}

// Fetch and parse external playlist references from playlist-urls.txt (point 9)
async function parsePlaylistUrls(content) {
    let lines = content.split(/[\r?\n]+/);
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        // If line points to an external playlist (m3u or similar), fetch and parse it
        if (line.endsWith('.m3u') || line.endsWith('.m3u8') || line.endsWith('.txt')) {
            try {
                let playlistContent = await fetchWithCorsFallback(line);
                if (playlistContent) {
                    parsePlaylistText(playlistContent, false); // append to existing channels
                }
            } catch (err) {
                console.error('Failed to load external playlist:', line, err);
            }
        } else {
            // If line is a direct stream or name+URL entry
            parsePlaylistText(line + "\n", false);
        }
    }
}

// Fetch with CORS fallback (point 3, for playlist files or other text fetches)
async function fetchWithCorsFallback(url) {
    for (let i = 0; i < proxyList.length; i++) {
        let proxy = proxyList[i];
        let targetUrl = proxy ? proxy + url : url;
        try {
            let res = await fetch(targetUrl);
            if (res.ok) {
                return await res.text();
            }
        } catch (e) {
            // Network or CORS error, try next proxy
            continue;
        }
    }
    return null; // all attempts failed
}

// Build channel list UI (point 5: sidebar with logo, title, EPG info; point 6: offline filter support)
function buildChannelList() {
    if (!channelListContainer) return;
    // Clear existing list
    channelListContainer.innerHTML = '';
    // Populate channel entries
    channels.forEach((chan, index) => {
        let item = document.createElement('div');
        item.className = 'channel-item';
        item.setAttribute('data-index', String(index));
        if (!chan.online) {
            item.classList.add('offline');
        }
        // Logo
        if (chan.logo) {
            let img = document.createElement('img');
            img.src = chan.logo;
            img.alt = '';
            img.className = 'channel-logo';
            item.appendChild(img);
        }
        // Info container for name and EPG
        let infoDiv = document.createElement('div');
        infoDiv.className = 'channel-info';
        // Channel Name
        let nameDiv = document.createElement('div');
        nameDiv.className = 'channel-name';
        nameDiv.textContent = chan.name;
        infoDiv.appendChild(nameDiv);
        // EPG Now/Next info if available
        if (chan.epgNow || chan.epgNext) {
            let epgDiv = document.createElement('div');
            epgDiv.className = 'channel-epg';
            let nowText = chan.epgNow ? chan.epgNow : '';
            let nextText = chan.epgNext ? chan.epgNext : '';
            if (nowText) {
                epgDiv.innerHTML = 'Now: ' + nowText;
            }
            if (nextText) {
                epgDiv.innerHTML += (nowText ? '<br>Next: ' : 'Next: ') + nextText;
            }
            infoDiv.appendChild(epgDiv);
        }
        item.appendChild(infoDiv);
        // Click event to play this channel (point 2)
        item.addEventListener('click', () => {
            handleChannelSelection(index);
        });
        channelListContainer.appendChild(item);
    });
    // After rebuilding list, reset filters (show all by default)
    if (filterAllBtn && filterOnlineBtn) {
        filterAllBtn.classList.add('active');
        filterOnlineBtn.classList.remove('active');
    }
    // Show all channels initially
    let items = channelListContainer.querySelectorAll('.channel-item');
    items.forEach(it => { it.style.display = ''; });
    // Clear search field
    if (searchInput) {
        searchInput.value = '';
    }
}

// Stop any current playback and reset players
function stopPlayback() {
    if (hls) {
        hls.destroy();
        hls = null;
    }
    if (dashPlayer) {
        if (typeof dashPlayer.destroy === 'function') {
            dashPlayer.destroy();
        } else if (typeof dashPlayer.reset === 'function') {
            dashPlayer.reset();
        }
        dashPlayer = null;
    }
    if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
    }
    if (iframePlayer) {
        iframePlayer.src = 'about:blank';
    }
}

// Handle channel selection and player switching (points 1,2,3,4)
async function handleChannelSelection(index) {
    let chan = channels[index];
    if (chan === undefined) return;
    // If the selected channel is already playing, do nothing (or optionally restart)
    if (currentChannelIndex === index) {
        if (chan.type !== 'iframe' && videoPlayer && videoPlayer.paused) {
            videoPlayer.play().catch(() => {});
        }
        return;
    }
    currentChannelIndex = index;
    // Highlight selection in UI
    let prevSelected = document.querySelector('.channel-item.selected');
    if (prevSelected) prevSelected.classList.remove('selected');
    let currentItem = document.querySelector('.channel-item[data-index="' + index + '"]');
    if (currentItem) currentItem.classList.add('selected');
    // Update any displayed current channel info (if separate from list, not implemented here because info is in list entries)
    // Stop current playback if any
    stopPlayback();
    // Player switching logic
    if (chan.type === 'iframe') {
        // Use iframe player
        if (videoPlayer) videoPlayer.style.display = 'none';
        if (iframePlayer) {
            iframePlayer.style.display = '';
            iframePlayer.src = chan.url;
        }
    } else {
        // Use video element for HLS, MP4, DASH
        if (iframePlayer) {
            iframePlayer.style.display = 'none';
            iframePlayer.src = 'about:blank';
        }
        if (videoPlayer) {
            videoPlayer.style.display = '';
        }
        // Add subtitle track if available (point 4)
        if (chan.subtitles && videoPlayer) {
            // If subtitle is SRT and browser needs VTT, could convert on the fly if needed (not implemented here)
            let track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = 'Subtitles';
            track.srclang = 'en';
            track.src = chan.subtitles;
            track.default = true;
            videoPlayer.appendChild(track);
        }
        // Play based on type
        if (chan.type === 'hls') {
            if (window.Hls && window.Hls.isSupported()) {
                hls = new Hls();
                hls.attachMedia(videoPlayer);
                let triedIndex = 0;
                hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                    // Try initial load (no proxy)
                    hls.loadSource(chan.url);
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        // Network error: try next proxy if available
                        triedIndex++;
                        if (triedIndex < proxyList.length) {
                            let proxy = proxyList[triedIndex];
                            let newUrl = proxy ? proxy + chan.url : chan.url;
                            console.warn('HLS network error, retrying with proxy:', proxy);
                            hls.loadSource(newUrl);
                        } else {
                            console.error('HLS streaming failed for all proxy options.');
                        }
                    } else if (data.fatal) {
                        console.error('Fatal HLS error:', data);
                        hls.destroy();
                    }
                });
                // Start playback when manifest is parsed
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoPlayer.play().catch(() => {});
                });
            } else {
                // If Hls.js is not available or not supported (e.g., Safari with native HLS)
                if (videoPlayer.canPlayType('application/vnd.apple.mpegURL')) {
                    videoPlayer.src = chan.url;
                    videoPlayer.play().catch(() => {});
                } else {
                    console.error('HLS.js not supported and no native HLS support.');
                }
            }
        } else if (chan.type === 'dash') {
            if (window.dashjs) {
                let triedIndex = 0;
                const tryDashSource = (url) => {
                    dashPlayer = dashjs.MediaPlayer().create();
                    dashPlayer.initialize(videoPlayer, url, true);
                    dashPlayer.on('error', () => {
                        dashPlayer.off('error');
                        triedIndex++;
                        if (triedIndex < proxyList.length) {
                            let proxy = proxyList[triedIndex];
                            let newUrl = proxy ? proxy + chan.url : chan.url;
                            console.warn('DASH error, retrying with proxy:', proxy);
                            dashPlayer.reset();
                            tryDashSource(newUrl);
                        } else {
                            console.error('DASH streaming failed for all proxy options.');
                        }
                    });
                };
                tryDashSource(chan.url);
            } else {
                // If no dash.js library, attempt direct playback (most browsers won't support .mpd natively)
                videoPlayer.src = chan.url;
                videoPlayer.play().catch(() => {});
            }
        } else {
            // Direct video file (MP4, WebM, etc.)
            if (videoPlayer) {
                videoPlayer.src = chan.url;
                videoPlayer.play().catch(() => {});
            }
        }
    }
    // Update the URL input field to the current channel's URL (for convenience)
    if (urlInput) {
        urlInput.value = chan.url;
    }
}

// Initialize application (attach events and load default playlists)
document.addEventListener('DOMContentLoaded', async () => {
    // Get references to DOM elements
    videoPlayer = document.getElementById('videoPlayer') || document.getElementById('player');
    iframePlayer = document.getElementById('iframePlayer') || document.getElementById('frame');
    urlInput = document.getElementById('urlInput');
    playBtn = document.getElementById('playBtn') || document.getElementById('playButton');
    loadBtn = document.getElementById('loadBtn') || document.getElementById('loadButton');
    copyBtn = document.getElementById('copyBtn') || document.getElementById('copyButton');
    clearBtn = document.getElementById('clearBtn') || document.getElementById('clearButton');
    searchInput = document.getElementById('searchInput') || document.getElementById('search');
    filterOnlineBtn = document.getElementById('filterOnline');
    filterAllBtn = document.getElementById('filterAll');
    channelListContainer = document.getElementById('channelList') || document.getElementById('channel-list') || document.getElementById('sidebar');
    // Attach event listeners for control buttons (point 10)
    if (playBtn && urlInput) {
        playBtn.addEventListener('click', async () => {
            let inputVal = urlInput.value.trim();
            if (!inputVal) return;
            // If input is an iframe embed code, extract the src URL
            if (inputVal.toLowerCase().startsWith('<iframe')) {
                let srcMatch = inputVal.match(/src=["']([^"']+)["']/);
                if (srcMatch) {
                    inputVal = srcMatch[1];
                }
            }
            // If the input looks like a playlist URL (ends with .m3u/.txt), load it as playlist
            if (inputVal.match(/\.(m3u8?|txt)(\?.*)?$/i)) {
                // Load external playlist via URL
                stopPlayback();
                currentChannelIndex = null;
                try {
                    let fetched = await fetchWithCorsFallback(inputVal);
                    if (fetched) {
                        parsePlaylistText(fetched, true);
                        buildChannelList();
                    } else {
                        console.error('Failed to load playlist from URL.');
                    }
                } catch (err) {
                    console.error('Error loading playlist URL:', err);
                }
            } else {
                // Treat input as direct stream URL to play
                // Add as a temporary channel and play it
                let type = detectType(inputVal);
                let tempChannel = {
                    name: inputVal,
                    url: inputVal,
                    type: type,
                    logo: null,
                    group: null,
                    online: true,
                    epgNow: null,
                    epgNext: null,
                    subtitles: null
                };
                // Option: add to channel list UI for reference
                channels.push(tempChannel);
                buildChannelList();
                handleChannelSelection(channels.length - 1);
            }
        });
    }
    if (loadBtn) {
        // Create file input if not present in HTML
        let fileInput = document.getElementById('fileInput');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.m3u,.m3u8,.txt';
            fileInput.style.display = 'none';
            fileInput.id = 'fileInput';
            document.body.appendChild(fileInput);
        }
        loadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            let file = e.target.files[0];
            if (!file) return;
            let reader = new FileReader();
            reader.onload = () => {
                stopPlayback();
                currentChannelIndex = null;
                parsePlaylistText(reader.result, true);
                buildChannelList();
            };
            reader.readAsText(file);
        });
    }
    if (copyBtn && urlInput) {
        copyBtn.addEventListener('click', () => {
            let text = urlInput.value;
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                // Optional feedback
                let original = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = original; }, 2000);
            }).catch(err => {
                console.error('Clipboard copy failed:', err);
            });
        });
    }
    if (clearBtn && urlInput) {
        clearBtn.addEventListener('click', () => {
            urlInput.value = '';
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            let query = searchInput.value.toLowerCase();
            let items = document.querySelectorAll('.channel-item');
            items.forEach(item => {
                // Check name and EPG text for match
                let idx = item.getAttribute('data-index');
                if (idx === null) return;
                let chan = channels[parseInt(idx)];
                let text = chan.name.toLowerCase();
                if (chan.epgNow) text += ' ' + chan.epgNow.toLowerCase();
                if (chan.epgNext) text += ' ' + chan.epgNext.toLowerCase();
                let match = text.includes(query);
                // Consider filter state: if currently showing only online, don't show offline even if matches
                if (match) {
                    if (filterOnlineBtn && filterOnlineBtn.classList.contains('active') && item.classList.contains('offline')) {
                        item.style.display = 'none';
                    } else {
                        item.style.display = '';
                    }
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    if (filterOnlineBtn && filterAllBtn) {
        filterOnlineBtn.addEventListener('click', () => {
            filterOnlineBtn.classList.add('active');
            filterAllBtn.classList.remove('active');
            let items = document.querySelectorAll('.channel-item');
            items.forEach(item => {
                if (item.classList.contains('offline')) {
                    item.style.display = 'none';
                } else {
                    item.style.display = '';
                }
            });
        });
        filterAllBtn.addEventListener('click', () => {
            filterAllBtn.classList.add('active');
            filterOnlineBtn.classList.remove('active');
            let items = document.querySelectorAll('.channel-item');
            items.forEach(item => {
                // Show all that match search (if any search query is active)
                if (searchInput && searchInput.value) {
                    // trigger the search input handler to re-filter according to query
                    let event = new Event('input');
                    searchInput.dispatchEvent(event);
                } else {
                    item.style.display = '';
                }
            });
        });
    }
    // Load default playlist.m3u and playlist-urls.txt on startup (points 8,9)
    try {
        let basePlaylistResponse = await fetch('playlist.m3u');
        if (basePlaylistResponse.ok) {
            let text = await basePlaylistResponse.text();
            parsePlaylistText(text, true);
        }
    } catch (err) {
        console.warn('No default playlist.m3u loaded or error fetching it.');
    }
    try {
        let urlsResponse = await fetch('playlist-urls.txt');
        if (urlsResponse.ok) {
            let urlText = await urlsResponse.text();
            await parsePlaylistUrls(urlText);
        }
    } catch (err) {
        console.warn('No playlist-urls.txt loaded or error fetching it.');
    }
    // Build channel list UI with loaded channels
    buildChannelList();
});
