// 🧩 1. Utility Functions

// ⏱ Προσαρμογή ώρας για Ελλάδα ➜ Γερμανία (UTC+3 ➜ UTC+2 το καλοκαίρι)
function adjustHourForGermany(timeStr) {
  let [h, m] = timeStr.split(":").map(Number);
  h = (h - 1 + 24) % 24;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// 🔴 Έλεγχος αν ο αγώνας είναι live (ώρα + ημερομηνία)
function isLiveGame(timeStr, dateStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const [day, month, year] = dateStr.split("/").map(Number);
  const gameDate = new Date(year, month - 1, day, h, m);
  const now = new Date();

  const isSameDay = gameDate.getDate() === now.getDate() &&
                    gameDate.getMonth() === now.getMonth() &&
                    gameDate.getFullYear() === now.getFullYear();

  const diffMin = (now - gameDate) / 60000;
  return isSameDay && diffMin >= -10 && diffMin <= 130;
}

// 🔤 Μετατροπή SRT ➜ VTT
function convertSrtToVtt(srtContent) {
  return 'WEBVTT\n\n' + srtContent
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
}

// 🎥 Υπότιτλοι SRT ➜ video track
function handleSubtitleFile(file) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const srtContent = event.target.result;
    const vttContent = convertSrtToVtt(srtContent);
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const track = document.getElementById('subtitle-track');
    track.src = url;
    track.label = 'Griechisch';
    track.srclang = 'el';
    track.default = true;
  };
  reader.readAsText(file);
}

// ℹ️ Εναλλαγή ορατότητας ενοτήτων
function toggleContent(contentId) {
  const allContents = document.querySelectorAll('.content-body');
  allContents.forEach(content => {
    if (content.id === contentId) {
      content.classList.toggle('expanded');
    } else {
      content.classList.remove('expanded');
    }
  });
}

// 📺 Ενημέρωση ονόματος και stream URL του καναλιού
function setCurrentChannel(channelName, streamUrl) {
  const currentChannelName = document.getElementById('current-channel-name');
  const streamUrlInput = document.getElementById('stream-url');
  currentChannelName.textContent = channelName;
  streamUrlInput.value = streamUrl;
}


// 📌 Global Variables & Configuration

// Proxy list (με σειρά προτεραιότητας)
const proxyList = [
  '',
  'https://water-instinctive-peach.glitch.me/',
  'https://tonis-proxy.onrender.com/',
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

// Clappr instance
let clapprPlayer = null;

// Global EPG data
let epgData = {};

// Proxy usage cache για export
const proxyUsageCache = new Set();


// 📺 3. EPG Functions

// Φόρτωση και ανάλυση των EPG XML δεδομένων
function loadEPGData() {
  fetch('https://ext.greektv.app/epg/epg.xml')
    .then(response => response.text())
    .then(data => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, "application/xml");
      const programmes = xmlDoc.getElementsByTagName('programme');

      Array.from(programmes).forEach(prog => {
        const channelId = prog.getAttribute('channel');
        const start = prog.getAttribute('start');
        const stop = prog.getAttribute('stop');
        const title = prog.getElementsByTagName('title')[0]?.textContent || '';
        const desc = prog.getElementsByTagName('desc')[0]?.textContent || 'Keine Beschreibung verfügbar';

        if (!epgData[channelId]) epgData[channelId] = [];
        epgData[channelId].push({
          start: parseDateTime(start),
          stop: parseDateTime(stop),
          title: title,
          desc: desc
        });
      });
    })
    .catch(error => console.error('Fehler beim Laden der EPG-Daten:', error));
}

// Μετατροπή EPG datetime format σε JavaScript Date αντικείμενο
function parseDateTime(epgTime) {
  if (!epgTime || epgTime.length < 19) return null;

  const year = +epgTime.slice(0, 4);
  const month = +epgTime.slice(4, 6) - 1;
  const day = +epgTime.slice(6, 8);
  const hour = +epgTime.slice(8, 10);
  const minute = +epgTime.slice(10, 12);
  const second = +epgTime.slice(12, 14);
  const tzHour = +epgTime.slice(15, 18);
  const tzMin = +epgTime.slice(18, 20) * (epgTime[14] === '+' ? 1 : -1);

  return new Date(Date.UTC(year, month, day, hour - tzHour, minute - tzMin, second));
}

// Λήψη τρέχοντος προγράμματος για το sidebar
function getCurrentProgram(channelId) {
  const now = new Date();
  if (!epgData[channelId]) return {
    title: 'Keine EPG-Daten verfügbar',
    description: 'Keine Beschreibung verfügbar',
    pastPercentage: 0,
    futurePercentage: 0
  };

  const program = epgData[channelId].find(prog => now >= prog.start && now < prog.stop);
  if (!program) return {
    title: 'Keine aktuelle Sendung verfügbar',
    description: 'Keine Beschreibung verfügbar',
    pastPercentage: 0,
    futurePercentage: 0
  };

  const pastTime = now - program.start;
  const totalTime = program.stop - program.start;
  return {
    title: `${program.title.replace(/\s*\[.*?\]\s*/g, '').replace(/[\[\]]/g, '')} (${program.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${program.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
    description: program.desc,
    pastPercentage: (pastTime / totalTime) * 100,
    futurePercentage: ((program.stop - now) / totalTime) * 100
  };
}

// Λήψη 4 επόμενων προγραμμάτων για προβολή κάτω από το player
function updateNextPrograms(channelId) {
  const container = document.getElementById('next-programs');
  container.innerHTML = '';

  const now = new Date();
  const upcoming = (epgData[channelId] || []).filter(p => p.start > now).slice(0, 4);

  upcoming.forEach(p => {
    const div = document.createElement('div');
    div.classList.add('next-program');

    const title = document.createElement('h4');
    const cleanTitle = p.title.replace(/\s*\[.*?\]\s*/g, '').replace(/[\[\]]/g, '');
    title.textContent = `${cleanTitle} (${p.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${p.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    title.classList.add('next-program-title');

    const desc = document.createElement('p');
    desc.textContent = p.desc || 'Keine Beschreibung verfügbar';
    desc.classList.add('next-program-desc');
    desc.style.display = 'none';

    title.addEventListener('click', () => {
      desc.style.display = desc.style.display === 'none' ? 'block' : 'none';
    });

    div.appendChild(title);
    div.appendChild(desc);
    container.appendChild(div);
  });
}

// Ενημέρωση προγράμματος στον player
function updatePlayerDescription(title, description) {
  document.getElementById('program-title').textContent = title;
  document.getElementById('program-desc').textContent = description;
}


// 📂 4. Playlist Management

// Φόρτωση της τοπικής playlist.m3u
function loadMyPlaylist() {
  fetch('playlist.m3u')
    .then(response => response.text())
    .then(data => updateSidebarFromM3U(data))
    .catch(error => console.error('Fehler beim Laden der Playlist:', error));
}

// Φόρτωση εξωτερικής playlist από GitHub repo
function loadExternalPlaylist() {
  fetch('https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR')
    .then(response => response.text())
    .then(data => updateSidebarFromM3U(data))
    .catch(error => console.error('Fehler beim Laden der externen Playlist:', error));
}

// Φόρτωση playlist από input field (με ή χωρίς proxy)
async function fetchResource(url) {
  let finalUrl = url;
  try {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/' + finalUrl;
    let response = await fetch(proxyUrl);
    if (!response.ok) {
      finalUrl = finalUrl.replace('http:', 'https:');
      response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
    }
    if (!response.ok) throw new Error('Proxy-Fehler');
    const data = await response.text();
addToGlobalStreamCache(url); // ✅ Καταγραφή στο cache

    updateSidebarFromM3U(data);
  } catch (error) {
    console.warn('CORS proxy failed, trying direct...');
    try {
      let response = await fetch(finalUrl);
      if (!response.ok) {
        finalUrl = finalUrl.replace('http:', 'https:');
        response = await fetch(finalUrl);
      }
      if (!response.ok) throw new Error('Direktabruf fehlgeschlagen');
      const data = await response.text();
addToGlobalStreamCache(url); // ✅ Καταγραφή στο cache

      updateSidebarFromM3U(data);
    } catch (e) {
      console.error('Fehler beim Laden der Playlist ohne Proxy:', e);
    }
  }
}

// Playlist Load Button handler
document.addEventListener('DOMContentLoaded', () => {
  const playlistButton = document.getElementById('playlist-button');
  playlistButton.addEventListener('click', () => {
    const playlistURL = document.getElementById('stream-url').value;
    if (playlistURL) fetchResource(playlistURL);
  });
});

// Playlist-URLs από αρχείο playlist-urls.txt (dropdown ενότητα)
function loadPlaylistUrls() {
  fetch('playlist-urls.txt')
    .then(response => {
      if (!response.ok) throw new Error('Datei nicht gefunden');
      return response.text();
    })
    .then(data => {
      const playlistList = document.getElementById('playlist-url-list');
      playlistList.innerHTML = '';
      const lines = data.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const [label, url] = trimmed.split(',').map(p => p.trim());
        if (label && url) {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.textContent = label;
          a.href = '#';
          a.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('stream-url').value = url;
            fetchResource(url);
          });
          li.appendChild(a);
          playlistList.appendChild(li);
        }
      });
    })
    .catch(error => {
      console.error('Fehler beim Laden der Playlist URLs:', error);
    });
}

// Event-Listener για το toggle του Playlist URLs στο sidebar
document.addEventListener('DOMContentLoaded', () => {
  const title = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
  if (title) {
    title.addEventListener('click', loadPlaylistUrls);
  }
});


// 📂 5. Sport Playlist Handler (foothubhd)

// ➤ Μετατροπή ώρας Ελλάδας σε Γερμανίας (GMT+2 → GMT+1)
function adjustHourForGermany(timeStr) {
  let [h, m] = timeStr.split(':').map(Number);
  h = (h - 1 + 24) % 24;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ➤ Έλεγχος αν ένας αγώνας είναι ζωντανός (ώρα ±10–130 λεπτά και ίδια ημερομηνία)
function isLiveGame(timeStr, dateStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const [day, month, year] = dateStr.split('/').map(Number);
  const gameDate = new Date(year, month - 1, day, h, m);
  const now = new Date();

  const isSameDay = gameDate.getDate() === now.getDate() &&
                    gameDate.getMonth() === now.getMonth() &&
                    gameDate.getFullYear() === now.getFullYear();

  const diffMin = (now - gameDate) / 60000;
  return isSameDay && diffMin >= -10 && diffMin <= 130;
}

// ➤ Ανάγνωση του αρχείου sport από το foothubhd (μέσω proxy) και εμφάνιση στη Sidebar
async function loadSportPlaylist() {
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.innerHTML = '';

  const proxy = 'https://cors-anywhere-production-d9b6.up.railway.app/';
  const sourceUrl = 'https://foothubhd.online/program.txt';
  const finalUrl = proxy + sourceUrl;

  try {
    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error('Λήψη απέτυχε');

    const text = await response.text();
    const lines = text.split('\n');

    let currentDate = '';
    let currentDateWithDay = '';
    let matchesForDay = [];

    const flushDay = () => {
      if (currentDate && matchesForDay.length) {
        matchesForDay.sort((a, b) => a.time.localeCompare(b.time));

        const dateHeader = document.createElement('li');
        dateHeader.textContent = `--- ${currentDateWithDay.toUpperCase()} ---`;
        dateHeader.style.fontWeight = 'bold';
        dateHeader.style.color = '#ff4d4d';
        dateHeader.style.margin = '10px 0';
        sidebarList.appendChild(dateHeader);

        matchesForDay.forEach(match => {
          const li = document.createElement('li');
          li.style.marginBottom = '8px';

          const title = document.createElement('div');
          const isLive = isLiveGame(match.time, match.date);
          const liveIcon = isLive ? '🔴 ' : '';
          title.textContent = `${liveIcon}${match.time} ${match.title}`;
          title.style.color = 'white';
          title.style.marginBottom = '3px';

          const linksDiv = document.createElement('div');
          match.links.forEach((link, idx) => {
            const a = document.createElement('a');
            a.textContent = `[Link${idx + 1}]`;
            a.href = '#';
            a.style.marginRight = '6px';

            if (isLive) {
              a.style.color = 'limegreen';
              a.style.fontWeight = 'bold';
            }

            a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('stream-url').value = link;
    addToGlobalStreamCache(link); // ✅ Καταγραφή στο cache

              document.getElementById('current-channel-name').textContent = match.title;
              document.getElementById('current-channel-logo').src = '';
              logProxyUrl(link);
              playStream(link);
            });

            linksDiv.appendChild(a);
          });

          li.appendChild(title);
          li.appendChild(linksDiv);
          sidebarList.appendChild(li);
        });

        matchesForDay = [];
      }
    };

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const dateMatch = line.match(/ΠΡΟΓΡΑΜΜΑ\s+([Α-Ωα-ωA-Za-z]+)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        flushDay();
        currentDate = `${dateMatch[2]}/${dateMatch[3]}/${dateMatch[4]}`;
        const dateObj = new Date(`${dateMatch[4]}-${dateMatch[3].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`);
        const weekday = dateObj.toLocaleDateString('el-GR', { weekday: 'long' });
        currentDateWithDay = `${weekday} ${currentDate}`;
        continue;
      }

      const gameMatches = [...line.matchAll(/(\d{1,2}:\d{2})\s+([^\/\n]+?)(?=\s*(\/|https?:\/\/|$))/g)];
      const linkMatches = [...line.matchAll(/https?:\/\/[^\s]+/g)].map(m => m[0]);

      if (gameMatches.length && linkMatches.length) {
        gameMatches.forEach(game => {
          matchesForDay.push({
            time: adjustHourForGermany(game[1]),
            title: game[2].trim(),
            links: linkMatches,
            date: currentDate
          });
        });
      }
    }

    flushDay();
  } catch (error) {
    console.error('Σφάλμα κατά τη φόρτωση sport playlist:', error);
    sidebarList.innerHTML = '<li style="color:red;">Αποτυχία φόρτωσης αθλητικών γεγονότων.</li>';
  }
}


// 📂 6. Smart Sidebar Rendering from M3U
async function updateSidebarFromM3U(data) {
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.innerHTML = '';

  const lines = data.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF')) {
      const idMatch = lines[i].match(/tvg-id="([^"]+)"/);
      const channelId = idMatch ? idMatch[1] : null;

      const nameMatch = lines[i].match(/,(.*)$/);
      const name = nameMatch ? nameMatch[1].trim() : 'Unbekannt';

      const imgMatch = lines[i].match(/tvg-logo="([^"]+)"/);
      const imgURL = imgMatch ? imgMatch[1] : 'default_logo.png';

      const streamURL = lines[i + 1] && lines[i + 1].startsWith('http') ? lines[i + 1].trim() : null;

      if (streamURL) {
    addToGlobalStreamCache(streamURL); // ✅ Καταγραφή στο cache

    try {
        const programInfo = await getCurrentProgram(channelId);


          const listItem = document.createElement('li');
          listItem.innerHTML = `
            <div class="channel-info" data-stream="${streamURL}" data-channel-id="${channelId}">
              <div class="logo-container">
                <img src="${imgURL}" alt="${name} Logo">
              </div>
              <span class="sender-name">${name}</span>
              <span class="epg-channel">
                <span>${programInfo.title}</span>
                <div class="epg-timeline">
                  <div class="epg-past" style="width: ${programInfo.pastPercentage}%"></div>
                  <div class="epg-future" style="width: ${programInfo.futurePercentage}%"></div>
                </div>
              </span>
            </div>
          `;
          sidebarList.appendChild(listItem);
        } catch (error) {
          console.error(`Fehler beim Abrufen der EPG-Daten für Kanal-ID ${channelId}:`, error);
        }
      }
    }
  }

  checkStreamStatus(); // Επιβεβαιώνει ποιοι είναι online
}


// 📂 7. Κλικ σε Κανάλι από Sidebar
document.getElementById('sidebar-list').addEventListener('click', function (event) {
  const channelInfo = event.target.closest('.channel-info');
  if (channelInfo) {
    const streamURL = channelInfo.dataset.stream;
    const channelId = channelInfo.dataset.channelId;

    const channelName = channelInfo.querySelector('.sender-name').textContent;
    setCurrentChannel(channelName, streamURL);

    const programInfo = getCurrentProgram(channelId);
    updatePlayerDescription(programInfo.title, programInfo.description);
    updateNextPrograms(channelId);

    const logoContainer = document.getElementById('current-channel-logo');
    const logoImg = channelInfo.querySelector('.logo-container img').src;
    logoContainer.src = logoImg;

    logProxyUrl(streamURL);
    playStream(streamURL);
  }
});


// =========================================
// 8. Events: DOMContentLoaded - Init buttons, clock, playlists, player
// =========================================

document.addEventListener('DOMContentLoaded', function () {
  // Start EPG loading and clock
  loadEPGData();
  updateClock();
  setInterval(updateClock, 1000);

  // Playlist buttons
  document.getElementById('myPlaylist').addEventListener('click', loadMyPlaylist);
  document.getElementById('externalPlaylist').addEventListener('click', loadExternalPlaylist);
  document.getElementById('sportPlaylist').addEventListener('click', loadSportPlaylist);

  // Export cache button (proxy tracking)
  document.getElementById('export-cache-button').addEventListener('click', () => {
    const cacheArray = Array.from(proxyUsageCache);
    const blob = new Blob([JSON.stringify(cacheArray, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'proxy-cache.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Filter buttons
  const filterOnlineButton = document.getElementById('filter-online-button');
  filterOnlineButton.addEventListener('click', function () {
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => {
      const channelInfo = item.querySelector('.channel-info');
      if (channelInfo && channelInfo.classList.contains('online')) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  });

  const showAllButton = document.getElementById('show-all-button');
  showAllButton.addEventListener('click', function () {
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => {
      item.style.display = '';
    });
  });

  // Search input + auto play on enter
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', function () {
    const filter = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('#sidebar-list li');
    let firstVisibleItem = null;
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      if (text.includes(filter)) {
        item.style.display = '';
        if (!firstVisibleItem) firstVisibleItem = item;
      } else {
        item.style.display = 'none';
      }
    });
  });

  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      const firstVisibleItem = document.querySelector('#sidebar-list li:not([style*="display: none"]) .channel-info');
      if (firstVisibleItem) {
        const url = firstVisibleItem.dataset.stream;
        if (url) {
          logProxyUrl(url);
          playStream(url);
        }
      }
    }
  });

  // Buttons: play, clear, copy
  const playButton = document.getElementById('play-button');
  const clearButton = document.getElementById('clear-button');
  const copyButton = document.getElementById('copy-button');
  const streamUrlInput = document.getElementById('stream-url');
  const subtitleFileInput = document.getElementById('subtitle-file');

  const playStreamFromInput = () => {
    const url = streamUrlInput.value;
    const subFile = subtitleFileInput.files[0];
    if (url) {
      if (subFile) handleSubtitleFile(subFile);
      logProxyUrl(url);
      playStream(url, subFile ? document.getElementById('subtitle-track').src : null);
    }
  };

  playButton.addEventListener('click', playStreamFromInput);
  streamUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') playStreamFromInput();
  });

  clearButton.addEventListener('click', () => {
    streamUrlInput.value = '';
  });

  copyButton.addEventListener('click', () => {
    streamUrlInput.select();
    document.execCommand('copy');
  });

  // Subtitle upload
  subtitleFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleSubtitleFile(file);
  });

  // Start auto-refresh for stream status
  setInterval(checkStreamStatus, 60000);
});


// ========== 9. Helper Functions & Clock ==========

function updateClock() {
    const now = new Date();
    const tag = now.toLocaleDateString('de-DE', { weekday: 'long' });
    const datum = now.toLocaleDateString('de-DE');
    const uhrzeit = now.toLocaleTimeString('de-DE', { hour12: false });
    document.getElementById('tag').textContent = tag;
    document.getElementById('datum').textContent = datum;
    document.getElementById('uhrzeit').textContent = uhrzeit;
}

function adjustHourForGermany(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    h = (h - 1 + 24) % 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function parseDateTime(epgTime) {
    if (!epgTime || epgTime.length < 19) return null;
    const year = parseInt(epgTime.substr(0, 4), 10);
    const month = parseInt(epgTime.substr(4, 2), 10) - 1;
    const day = parseInt(epgTime.substr(6, 2), 10);
    const hour = parseInt(epgTime.substr(8, 2), 10);
    const minute = parseInt(epgTime.substr(10, 2), 10);
    const second = parseInt(epgTime.substr(12, 2), 10);
    const tzHour = parseInt(epgTime.substr(15, 3), 10);
    const tzMin = parseInt(epgTime.substr(18, 2), 10) * (epgTime[14] === '+' ? 1 : -1);

    if ([year, month, day, hour, minute, second, tzHour, tzMin].some(isNaN)) return null;
    return new Date(Date.UTC(year, month, day, hour - tzHour, minute - tzMin, second));
}

function toggleContent(contentId) {
    const allContents = document.querySelectorAll('.content-body');
    allContents.forEach(content => {
        if (content.id === contentId) {
            content.classList.toggle('expanded');
        } else {
            content.classList.remove('expanded');
        }
    });
}

function convertSrtToVtt(srtContent) {
    return 'WEBVTT\n\n' + srtContent
        .replace(/\r\n|\r|\n/g, '\n')
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
}


// 📁 Κατηγορία 10: Εργαλεία υποτίτλων (Subtitles Tools)

// Ανάγνωση και εμφάνιση αρχείου SRT ως VTT
function handleSubtitleFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const srtContent = event.target.result;
        const vttContent = convertSrtToVtt(srtContent);
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        const track = document.getElementById('subtitle-track');
        track.src = url;
        track.label = 'Griechisch';
        track.srclang = 'el';
        track.default = true;
    };
    reader.readAsText(file);
}

// Μετατροπή SRT σε VTT για υποστήριξη στον browser
function convertSrtToVtt(srtContent) {
    return 'WEBVTT\n\n' + srtContent
        .replace(/\r\n|\r|\n/g, '\n')
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
}


// 📁 Κατηγορία 11: Αναζήτηση, Φίλτρα και Κουμπιά Sidebar

// 🔍 Αναζήτηση Sender στη Sidebar
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', function() {
        const filter = searchInput.value.toLowerCase();
        const items = document.querySelectorAll('#sidebar-list li');

        let firstVisibleItem = null;

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(filter)) {
                item.style.display = '';
                if (!firstVisibleItem) firstVisibleItem = item;
            } else {
                item.style.display = 'none';
            }
        });
    });

    // ▶️ Παίζει τον πρώτο ορατό Sender όταν πατηθεί Enter
    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const firstVisibleItem = [...document.querySelectorAll('#sidebar-list li')]
                .find(item => item.style.display !== 'none');

            if (firstVisibleItem) {
                const streamURL = firstVisibleItem.querySelector('.channel-info')?.dataset.stream;
                if (streamURL) {
                    logProxyUrl(streamURL);
                    playStream(streamURL);
                }
            }
        }
    });
});


// 📡 Κουμπί: Φίλτρο Online Senders
document.addEventListener('DOMContentLoaded', function () {
    const filterOnlineButton = document.getElementById('filter-online-button');

    filterOnlineButton.addEventListener('click', function () {
        const items = document.querySelectorAll('#sidebar-list li');
        items.forEach(item => {
            const channelInfo = item.querySelector('.channel-info');
            if (channelInfo?.classList.contains('online')) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
});


// 🌐 Κουμπί: Εμφάνιση Όλων
document.addEventListener('DOMContentLoaded', function () {
    const showAllButton = document.getElementById('show-all-button');

    showAllButton.addEventListener('click', function () {
        const items = document.querySelectorAll('#sidebar-list li');
        items.forEach(item => item.style.display = '');
    });
});


// 📁 Κατηγορία 12: Playlist URLs από αρχείο playlist-urls.txt

// 🔃 Φόρτωση όλων των Playlist URLs και εμφάνιση τους ως clickable list
function loadPlaylistUrls() {
    fetch('playlist-urls.txt')
        .then(response => {
            if (!response.ok) throw new Error('Netzwerkantwort war nicht ok.');
            return response.text();
        })
        .then(data => {
            const playlistList = document.getElementById('playlist-url-list');
            playlistList.innerHTML = '';

            const lines = data.split('\n');
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const [label, url] = trimmedLine.split(',').map(part => part.trim());

                    if (label && url) {
                        const li = document.createElement('li');
                        const link = document.createElement('a');
                        link.textContent = label;
                        link.href = '#';

                        link.addEventListener('click', function(event) {
                            event.preventDefault();
                            document.getElementById('stream-url').value = url;

                            // Φόρτωση της playlist στο sidebar
                            fetch(url)
                                .then(response => {
                                    if (!response.ok) throw new Error('Netzwerkantwort war nicht ok.');
                                    return response.text();
                                })
                                .then(data => updateSidebarFromM3U(data))
                                .catch(error => {
                                    console.error('Fehler beim Laden der Playlist:', error);
                                    alert('Fehler beim Laden der Playlist. Siehe Konsole für Details.');
                                });
                        });

                        li.appendChild(link);
                        playlistList.appendChild(li);
                    } else {
                        console.warn('Zeile hat kein Label oder keine URL:', trimmedLine);
                    }
                }
            });
        })
        .catch(error => {
            console.error('Fehler beim Laden der Playlist URLs:', error);
            alert('Fehler beim Laden der Playlist-URLs. Siehe Konsole für Details.');
        });
}

// ⬇️ Ενεργοποίηση όταν γίνει click στο header "Playlist URLs"
document.addEventListener('DOMContentLoaded', function() {
    const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
    if (playlistUrlsTitle) {
        playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
    } else {
        console.error('Element für den Klick-Event-Listener wurde nicht gefunden.');
    }
});


// 📁 Κατηγορία 13: Εναλλαγή εμφάνισης (expand/collapse) για iframe Widgets

function toggleContent(contentId) {
    const allContents = document.querySelectorAll('.content-body');
    allContents.forEach(content => {
        if (content.id === contentId) {
            content.classList.toggle('expanded'); // Εναλλάσσει την εμφάνιση του επιλεγμένου
        } else {
            content.classList.remove('expanded'); // Κλείνει τα υπόλοιπα
        }
    });
}


// 📁 Κατηγορία 14: Εργαλεία Stream URL (Clear – Copy – Playlist Laden)

document.getElementById('clear-button').addEventListener('click', function () {
    document.getElementById('stream-url').value = '';
});

document.getElementById('copy-button').addEventListener('click', function () {
    const input = document.getElementById('stream-url');
    input.select();
    document.execCommand('copy');
});

// Φόρτωση M3U playlist από URL στο input
document.getElementById('playlist-button').addEventListener('click', function () {
    const playlistURL = document.getElementById('stream-url').value;
    if (playlistURL) {
        fetchResource(playlistURL);
    }
});

// ✅ Συνάρτηση για λήψη M3U αρχείου
async function fetchResource(url) {
    let finalUrl = url;

    try {
        const response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
        if (!response.ok) {
            finalUrl = finalUrl.replace('http:', 'https:');
            const retry = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
            if (!retry.ok) throw new Error('Network error');
            finalUrl = retry;
        }
        const data = await finalUrl.text();
        updateSidebarFromM3U(data);
    } catch (e1) {
        console.warn('Proxy failed, trying directly...');
        try {
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error('Direct fetch failed');
            const data = await response.text();
addToGlobalStreamCache(url); // ✅ Καταγραφή στο cache

            updateSidebarFromM3U(data);
        } catch (e2) {
            console.error('Fehler beim Laden der Playlist:', e2);
        }
    }
}


// 📁 Κατηγορία 14: Εργαλεία Stream URL (Clear – Copy – Playlist Laden)

document.getElementById('clear-button').addEventListener('click', function () {
    document.getElementById('stream-url').value = '';
});

document.getElementById('copy-button').addEventListener('click', function () {
    const input = document.getElementById('stream-url');
    input.select();
    document.execCommand('copy');
});

// Φόρτωση M3U playlist από URL στο input
document.getElementById('playlist-button').addEventListener('click', function () {
    const playlistURL = document.getElementById('stream-url').value;
    if (playlistURL) {
        fetchResource(playlistURL);
    }
});

// ✅ Συνάρτηση για λήψη M3U αρχείου
async function fetchResource(url) {
    let finalUrl = url;

    try {
        const response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
        if (!response.ok) {
            finalUrl = finalUrl.replace('http:', 'https:');
            const retry = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
            if (!retry.ok) throw new Error('Network error');
            finalUrl = retry;
        }
        const data = await finalUrl.text();
        updateSidebarFromM3U(data);
    } catch (e1) {
        console.warn('Proxy failed, trying directly...');
        try {
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error('Direct fetch failed');
            const data = await response.text();
addToGlobalStreamCache(url); // ✅ Καταγραφή στο cache

            updateSidebarFromM3U(data);
        } catch (e2) {
            console.error('Fehler beim Laden der Playlist:', e2);
        }
    }
}


// 📁 Κατηγορία 16: Αναπαραγωγή από Input πεδίο και Play Button

document.addEventListener('DOMContentLoaded', function () {
    const playButton = document.getElementById('play-button');
    const streamUrlInput = document.getElementById('stream-url');
    const subtitleFileInput = document.getElementById('subtitle-file');

    // Συνάρτηση αναπαραγωγής από input
    const playStreamFromInput = () => {
        const streamUrl = streamUrlInput.value;
        const subtitleFile = subtitleFileInput.files[0];

        if (streamUrl) {
            if (subtitleFile) {
                handleSubtitleFile(subtitleFile); // Από Κατηγορία 15
            }

            logProxyUrl(streamUrl); // Καταγραφή URL
            playStream(streamUrl, subtitleFile ? document.getElementById('subtitle-track').src : null);
        }
    };

    // Click στο κουμπί Play
    playButton.addEventListener('click', playStreamFromInput);

    // Enter στο input πεδίο
    streamUrlInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            playStreamFromInput();
        }
    });
});


// 📦 Κατηγορία 18: Buttons – Leeren, Kopieren, VLC

// 🧹 Κουμπί Leeren – Καθαρίζει το πεδίο stream-url
document.getElementById('clear-button').addEventListener('click', function () {
    document.getElementById('stream-url').value = '';
});

// 📋 Κουμπί Kopieren – Αντιγράφει την τιμή του πεδίου stream-url
document.getElementById('copy-button').addEventListener('click', function () {
    const streamUrlInput = document.getElementById('stream-url');
    streamUrlInput.select();
    document.execCommand('copy');
});

// 🔄 (Προετοιμασία) VLC Button – Παρόν στο HTML, αλλά προς το παρόν κρυφό
// Αν το ενεργοποιήσεις, εδώ θα μπει η λογική για άνοιγμα μέσω vlc:// ή local handler


// 📦 Κατηγορία 19: Υπότιτλοι – SRT ➜ VTT & Εμφάνιση στο Video Player

// 🧠 Μετατροπή από SRT σε VTT
function convertSrtToVtt(srtContent) {
    const vttContent = 'WEBVTT\n\n' + srtContent
        .replace(/\r\n|\r|\n/g, '\n') // Κανονικοποίηση γραμμών
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4'); // SRT ➜ VTT format
    return vttContent;
}

// 📂 Ανάγνωση αρχείου .srt και εμφάνιση στον player
function handleSubtitleFile(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const srtContent = event.target.result;
        const vttContent = convertSrtToVtt(srtContent);
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);

        const track = document.getElementById('subtitle-track');
        track.src = url;
        track.label = 'Griechisch';
        track.srclang = 'el';
        track.default = true;
        track.track.mode = 'showing';
    };
    reader.readAsText(file);
}


// 📦 Κατηγορία 20: Sidebar Αναζήτηση και Enter για Άμεση Αναπαραγωγή

document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', function () {
        const filter = searchInput.value.toLowerCase();
        const sidebarList = document.getElementById('sidebar-list');
        const items = sidebarList.getElementsByTagName('li');

        let firstVisibleItem = null;

        Array.from(items).forEach(item => {
            const text = item.textContent || item.innerText;
            if (text.toLowerCase().includes(filter)) {
                item.style.display = '';
                if (!firstVisibleItem) {
                    firstVisibleItem = item;
                }
            } else {
                item.style.display = 'none';
            }
        });

        // 💡 Προσθήκη Enter μόνο ΜΙΑ φορά (μέσα στο input)
        const handleEnter = function (event) {
            if (event.key === 'Enter' && firstVisibleItem) {
                const streamURL = firstVisibleItem.querySelector('.channel-info')?.dataset.stream;
                if (streamURL) {
                    logProxyUrl(streamURL);
                    playStream(streamURL);
                }
            }
        };

        // ⚠️ Αποφυγή πολλαπλών listeners
        searchInput.removeEventListener('keydown', handleEnter);
        searchInput.addEventListener('keydown', handleEnter);
    });
});


// 📁 Κατηγορία 21: Playlist URLs - Φόρτωση και Sidebar εμφάνιση

function loadPlaylistUrls() {
    fetch('playlist-urls.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error('Netzwerkantwort war nicht ok.');
            }
            return response.text();
        })
        .then(data => {
            const playlistList = document.getElementById('playlist-url-list');
            playlistList.innerHTML = ''; // Καθαρίζει τη λίστα

            const lines = data.split('\n');
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const [label, url] = trimmedLine.split(',').map(part => part.trim());

                    if (label && url) {
                        const li = document.createElement('li');
                        const link = document.createElement('a');
                        link.textContent = label;
                        link.href = '#';
                        link.addEventListener('click', function(event) {
                            event.preventDefault();
                            document.getElementById('stream-url').value = url;
addToGlobalStreamCache(url); // ✅ Καταγραφή στο cache

                            logProxyUrl(url);

                            fetch(url)
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Netzwerkantwort war nicht ok.');
                                    }
                                    return response.text();
                                })
                                .then(data => {
                                    updateSidebarFromM3U(data);
                                })
                                .catch(error => {
                                    console.error('Fehler beim Laden der Playlist:', error);
                                    alert('Fehler beim Laden der Playlist. Siehe Konsole für Details.');
                                });
                        });

                        li.appendChild(link);
                        playlistList.appendChild(li);
                    } else {
                        console.warn('⚠️ Ungültige Zeile ohne Label oder URL:', trimmedLine);
                    }
                }
            });
        })
        .catch(error => {
            console.error('Fehler beim Laden der Playlist URLs:', error);
            alert('Fehler beim Laden der Playlist-URLs. Siehe Konsole für Details.');
        });
}

// 📌 Καταχώριση Event-Listener για το "Playlist URLs" section
document.addEventListener('DOMContentLoaded', function() {
    const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
    if (playlistUrlsTitle) {
        playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
    } else {
        console.error('⚠️ "Playlist URLs" Section nicht gefunden.');
    }
});


// 📂 Κατηγορία 22: Ανίχνευση και επίλυση .strm αρχείων (π.χ. από GitHub ή απομακρυσμένο .strm)

function isSTRM(url) {
  return url.endsWith('.strm');
}

async function resolveSTRM(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  } catch (e) {
    console.warn('❌ STRM resolve failed:', e);
    return null;
  }
}


// 📂 Κατηγορία 23: Εναλλαγή περιεχομένου στις ενότητες (TV-Programm, Foothubhd κλπ)
function toggleContent(contentId) {
    const allContents = document.querySelectorAll('.content-body');
    allContents.forEach(content => {
        if (content.id === contentId) {
            content.classList.toggle('expanded');
        } else {
            content.classList.remove('expanded');
        }
    });
}


// 📂 Κατηγορία 24: Διαχείριση Playlist URLs (playlist-urls.txt)
function loadPlaylistUrls() {
    fetch('playlist-urls.txt')
        .then(response => {
            if (!response.ok) throw new Error('Αποτυχία φόρτωσης playlist-urls.txt');
            return response.text();
        })
        .then(data => {
            const playlistList = document.getElementById('playlist-url-list');
            playlistList.innerHTML = '';

            const lines = data.split('\n');
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const [label, url] = trimmedLine.split(',').map(part => part.trim());
                    if (label && url) {
                        const li = document.createElement('li');
                        const link = document.createElement('a');
                        link.textContent = label;
                        link.href = '#';
                        link.addEventListener('click', function(event) {
                            event.preventDefault();
                            document.getElementById('stream-url').value = url;
                            logProxyUrl(url);
                            fetch(url)
                                .then(response => response.text())
                                .then(data => updateSidebarFromM3U(data))
                                .catch(error => {
                                    console.error('Σφάλμα φόρτωσης Playlist:', error);
                                    alert('Σφάλμα κατά τη φόρτωση της λίστας.');
                                });
                        });

                        li.appendChild(link);
                        playlistList.appendChild(li);
                    }
                }
            });
        })
        .catch(error => {
            console.error('Σφάλμα φόρτωσης playlist-urls.txt:', error);
            alert('Σφάλμα κατά τη φόρτωση του αρχείου με τις λίστες.');
        });
}

// 🎯 Σύνδεση με το HTML (στο "Playlist URLs" panel)
document.addEventListener('DOMContentLoaded', function() {
    const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
    if (playlistUrlsTitle) {
        playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
    }
});


// 📂 Κατηγορία 25: Αναζήτηση στη Sidebar και autoplay με Enter
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', function () {
        const filter = searchInput.value.toLowerCase();
        const sidebarList = document.getElementById('sidebar-list');
        const items = sidebarList.getElementsByTagName('li');

        let firstVisibleItem = null;

        Array.from(items).forEach(item => {
            const text = item.textContent || item.innerText;
            if (text.toLowerCase().includes(filter)) {
                item.style.display = '';
                if (!firstVisibleItem) firstVisibleItem = item;
            } else {
                item.style.display = 'none';
            }
        });

        // Πατάμε Enter ➜ παίζει το πρώτο εμφανιζόμενο κανάλι
        searchInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && firstVisibleItem) {
                const channelInfo = firstVisibleItem.querySelector('.channel-info');
                if (channelInfo) {
                    const streamURL = channelInfo.dataset.stream;
                    const channelName = channelInfo.querySelector('.sender-name').textContent;
                    setCurrentChannel(channelName, streamURL);
                    logProxyUrl(streamURL);
                    playStream(streamURL);
                    const channelId = channelInfo.dataset.channelId;
                    if (channelId) {
                        const programInfo = getCurrentProgram(channelId);
                        updatePlayerDescription(programInfo.title, programInfo.description);
                        updateNextPrograms(channelId);
                    }
                }
            }
        });
    });
});


// 📂 Κατηγορία 26: Proxy system με cache και fallback
const proxyList = [
  '',
  'https://water-instinctive-peach.glitch.me/',
  'https://tonis-proxy.onrender.com/',
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

// Cache για αποφυγή επαναλήψεων
const proxyUsageCache = new Set();

// Επιστρέφει το πρώτο διαθέσιμο URL με λειτουργικό proxy
async function autoProxyFetch(url) {
  for (let proxy of proxyList) {
    const testUrl = proxy.endsWith('=') ? proxy + encodeURIComponent(url) : proxy + url;

    try {
      let res = await fetch(testUrl, { method: 'HEAD', mode: 'cors' });
      if (res.status === 403 || res.status === 405) {
        res = await fetch(testUrl, { method: 'GET', mode: 'cors' });
      }

      if (res.ok) {
        proxyUsageCache.add(testUrl);
        return testUrl;
      }
    } catch (e) {
      console.warn('Proxy failed:', proxy);
    }
  }

  return null;
}

// Καταγραφή proxy URL στο cache όταν χρησιμοποιείται
function logProxyUrl(url) {
  if (url && !proxyUsageCache.has(url)) {
    proxyUsageCache.add(url);
  }
}


// 📂 Κατηγορία 27: Κουμπί εξαγωγής της proxy cache σε αρχείο JSON
document.addEventListener('DOMContentLoaded', function () {
  const exportButton = document.getElementById('export-cache-button');

  exportButton.addEventListener('click', () => {
    const cacheArray = Array.from(proxyUsageCache);
    const blob = new Blob([JSON.stringify(cacheArray, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'proxy-cache.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});


// 📂 Κατηγορία 28: Καταγραφή κάθε URL που εμφανίζεται στο sidebar ή στο stream-url input
const globalStreamCache = new Set();

// Καταγραφή URL όταν αλλάζει το stream-url input
document.addEventListener('DOMContentLoaded', function () {
  const streamUrlInput = document.getElementById('stream-url');
  streamUrlInput.addEventListener('input', function () {
    const val = streamUrlInput.value.trim();
    if (val.startsWith('http')) {
      globalStreamCache.add(val);
    }
  });
});

// Καταγραφή URL όταν δημιουργείται το sidebar από updateSidebarFromM3U
function addToGlobalStreamCache(url) {
  if (url && url.startsWith('http')) {
    globalStreamCache.add(url);
  }
}



