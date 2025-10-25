/* scripts.js — REORDER ONLY + minor fixes (points 1,4,5,6,7) — no logic changes */

/* =========================
   ========== Globals ======
   ========================= */

const globalStreamCache = {}; // Κεντρική μνήμη για όλα τα stream URLs
let streamPerfMap = {};
let clapprPlayer = null;

const CACHE_UPLOAD_URL = 'https://yellow-hulking-guan.glitch.me/upload-cache';
let lastSentCache = {};

// Debug flag & light logger (μείωση θορύβου χωρίς αλλαγή ροής)
const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log(...args); };

// scripts.js – Ανανεωμένη έκδοση με γρηγορότερη ανίχνευση και Proxy fallback
const proxyList = [
  "", // ➔ Πρώτα δοκιμάζουμε direct χωρίς proxy
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy/?quest=',
  'https://proxy.cors.sh/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://api.allorigins.win/raw?url=',
];


/* =========================
   ======== Helpers ========
   ========================= */

// === Helper: Fetch text με CORS fallback ===
async function fetchTextWithCorsFallback(url, init = {}) {
  // 1) Δοκιμάζει direct
  try {
    const r = await fetch(url, init);
    const t = await r.text(); // εδώ θα αποτύχει αν υπάρχει CORS block
    if (r.ok) return t;
  } catch (_) { /* συνεχίζουμε σε proxies */ }

  // 2) Δοκιμάζει όλους τους proxies στη σειρά
  for (const proxy of proxyList) {
    if (!proxy) continue; // direct έγινε ήδη
    const proxiedUrl = (proxy.endsWith('=') || proxy.endsWith('?'))
      ? proxy + encodeURIComponent(url)
      : proxy + url;
    try {
      const r = await fetch(proxiedUrl, init);
      const t = await r.text();
      if (r.ok) return t;
    } catch (_) { /* πάμε επόμενο proxy */ }
  }

  throw new Error('CORS fallback exhausted for: ' + url);
}


// Τύποι/ανιχνεύσεις/καθαρισμοί URL
function cleanProxyFromUrl(url) {
  for (const proxy of proxyList) {
    if (proxy && url.startsWith(proxy)) {
      return decodeURIComponent(url.replace(proxy, ''));
    }
  }
  return url;
}

function isIframeStream(url) {
  return /embed|\.php$|\.html$/i.test(url);
}

function isDirectStream(url) {
  return /\.(m3u8|ts|mp4|mpd|webm)$/i.test(url);
}

function isSTRM(url) {
  return url.endsWith('.strm');
}

function isTSStream(url) {
  return url.toLowerCase().endsWith('.ts') || url.toLowerCase().endsWith('.m2ts') || url.toLowerCase().includes('mpeg.2ts');
}

function detectStreamType(url) {
  if (!url) return 'unknown';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.m3u8')) return 'hls';
  if (lowerUrl.endsWith('.ts')) return 'ts';
  if (lowerUrl.endsWith('.mpd')) return 'dash';
  if (lowerUrl.endsWith('.mp4')) return 'mp4';
  if (lowerUrl.endsWith('.webm')) return 'webm';
  if (lowerUrl.endsWith('.strm')) return 'strm';
  if (lowerUrl.includes('/embed/') || lowerUrl.endsWith('.php') || lowerUrl.endsWith('.html')) return 'iframe';
  return 'unknown';
}

// STRM → URL
async function resolveSTRM(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  } catch (e) {
    return null;
  }
}

// Εξαγωγή nested m3u8
function extractChunksUrl(m3uText, baseUrl) {
  baseUrl = cleanProxyFromUrl(baseUrl);
  const lines = m3uText.split('\n');
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#') && line.endsWith('.m3u8')) {
      return new URL(line.trim(), baseUrl).href;
    }
  }
  return null;
}

// Παίζει το καλύτερο διαθέσιμο URL για tvgId με fallback
async function playStreamByTvgId(tvgId) {
  if (!tvgId) return;

  const res = await fetch('https://yellow-hulking-guan.glitch.me/channel-streams.json');
  const streamData = await res.json();
  const urls = streamData[tvgId];

  if (!urls || urls.length === 0) {
    console.warn(`❌ Δεν βρέθηκαν URLs για tvgId: ${tvgId}`);
    return;
  }

  let currentIndex = 0;

  async function tryNext() {
    if (currentIndex >= urls.length) {
      console.warn(`🚫 Κανένα λειτουργικό stream για ${tvgId}`);
      showPlayerInfo('❌ Κανένα stream');
      return;
    }

    const url = urls[currentIndex];
    currentIndex++;

    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) throw new Error('Not OK');
    } catch (e) {
      console.warn(`❌ Stream νεκρό: ${url}`);
      return tryNext(); // ➤ επόμενο
    }

    console.log(`🎯 Παίζει stream για ${tvgId}:`, url);
    playStream(url);

    const video = document.getElementById('video-player');
    video.onerror = () => {
      console.warn(`⚠️ Stream κόπηκε: ${url}, δοκιμή επόμενου...`);
      tryNext();
    };

    if (clapprPlayer) {
      clapprPlayer.on('error', () => {
        console.warn(`⚠️ Clappr error: ${url}, δοκιμή επόμενου...`);
        tryNext();
      });
    }
  }

  tryNext();
}

// iframe → εντοπισμός .m3u8
async function findM3U8inIframe(url) {
  const foundUrl = await findWorkingUrl(url);
  if (!foundUrl) return null;

  try {
    const res = await fetch(foundUrl);
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8)/i);
      if (match) {
        console.log('🔎 Βρέθηκε .m3u8 μέσα σε iframe:', match[1]);
        return match[1];
      }
    }
  } catch (e) {
    console.warn('❌ Σφάλμα ανάλυσης iframe:', e.message);
  }

  console.warn('❌ Δεν βρέθηκε απευθείας .m3u8 στο iframe');
  return null;
}

// Proxy cycling / validation — τώρα χρησιμοποιεί το global proxyList
async function findWorkingUrl(initialURL) {
  for (const proxy of proxyList) {
    const fullUrl = proxy ? (proxy.endsWith("=") ? proxy + encodeURIComponent(initialURL) : proxy + initialURL) : initialURL;
    log(`🔍 Δοκιμή proxy: ${proxy || "direct"} ➔ ${fullUrl}`);

    try {
      const res = await fetch(fullUrl, { method: "GET", mode: "cors" });
      if (!res.ok) {
        console.warn(`❌ Αποτυχία fetch stream: ${res.status}`);
        continue;
      }

      const text = await res.text();

      // nested m3u8
      const nestedMatch = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
      if (nestedMatch) {
        const nestedURL = nestedMatch[0];
        log('🔎 Βρέθηκε nested m3u8 ➔', nestedURL);

        const nestedRes = await fetch(proxy ? proxy + encodeURIComponent(nestedURL) : nestedURL);
        if (nestedRes.ok) {
          const nestedText = await nestedRes.text();
          if (nestedText.includes(".ts")) {
            log("✅ Βρέθηκε .ts μέσα στο nested .m3u8");
            return proxy ? proxy + encodeURIComponent(initialURL) : initialURL;
          } else {
            console.warn("⚠️ Δεν βρέθηκε ts στο nested m3u8");
          }
        }
        continue;
      }

      // direct .ts
      const tsMatch = text.match(/https?:\/\/[^\s"']+\.ts[^\s"']*/i);
      if (tsMatch) {
        const tsUrl = tsMatch[0];
        log("⏳ HEAD έλεγχος στο ts:", tsUrl);
        const tsHead = await fetch(tsUrl, { method: "HEAD" });
        if (tsHead.ok) {
          log("✅ Βρέθηκε άμεσα ts!");
          return proxy ? proxy + encodeURIComponent(initialURL) : initialURL;
        }
      }

      // Fallback αν μοιάζει με m3u8/ts
      if (text.includes("#EXTM3U") || text.includes(".ts")) {
        log("✅ .m3u8 ή .ts περιεχόμενο OK");
        return proxy ? proxy + encodeURIComponent(initialURL) : initialURL;
      } else {
        console.warn("⚠️ Δεν είναι έγκυρο .m3u8");
      }
    } catch (err) {
      console.error("❌ Σφάλμα fetch proxy:", err.message);
    }
  }

  console.warn("🚨 Τέλος: Κανένα proxy δεν δούλεψε για", initialURL);
  return null;
}


/* =========================
   ========== EPG ==========
   ========================= */

// Globales Objekt für EPG-Daten
let epgData = {};

// === EPG loader με fallback ===
function loadEPGData() {
  const epgUrl = 'https://ext.greektv.app/epg/epg.xml';
  fetchTextWithCorsFallback(epgUrl)
    .then(data => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, "application/xml");
      const programmes = xmlDoc.getElementsByTagName('programme');
      Array.from(programmes).forEach(prog => {
        const channelId = prog.getAttribute('channel');
        const start = prog.getAttribute('start');
        const stop = prog.getAttribute('stop');

        // ➤ Αν λείπουν start ή stop, αγνόησε αυτό το πρόγραμμα
        if (!start || !stop) return;

        const titleElement = prog.getElementsByTagName('title')[0];
        const descElement = prog.getElementsByTagName('desc')[0];
        if (titleElement) {
          const title = titleElement.textContent;
          const desc = descElement
            ? descElement.textContent
            : 'Keine Beschreibung verfügbar';
          if (!epgData[channelId]) epgData[channelId] = [];
          epgData[channelId].push({
            start: parseDateTime(start),
            stop: parseDateTime(stop),
            title,
            desc
          });
        }
      });
    })
    .catch(error => {
      console.error('Fehler beim Laden der EPG-Daten:', error);
      // Optional: document.getElementById('program-title').textContent = 'EPG nicht verfügbar';
    });
}


// Hilfsfunktion zum Umwandeln der EPG-Zeitangaben in Date-Objekte
function parseDateTime(epgTime) {
  if (!epgTime || epgTime.length < 19) {
    console.error('Ungültige EPG-Zeitangabe:', epgTime);
    return null;
  }

  const year = parseInt(epgTime.substr(0, 4), 10);
  const month = parseInt(epgTime.substr(4, 2), 10) - 1;
  const day = parseInt(epgTime.substr(6, 2), 10);
  const hour = parseInt(epgTime.substr(8, 2), 10);
  const minute = parseInt(epgTime.substr(10, 2), 10);
  const second = parseInt(epgTime.substr(12, 2), 10);
  const tzHour = parseInt(epgTime.substr(15, 3), 10);
  const tzMin = parseInt(epgTime.substr(18, 2), 10) * (epgTime[14] === '+' ? 1 : -1);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute) || isNaN(second) || isNaN(tzHour) || isNaN(tzMin)) {
    console.error('Ungültige EPG-Zeitangabe:', epgTime);
    return null;
  }

  if (year < 0 || month < 0 || month > 11 || day < 1 || day > 31) {
    console.error('Ungültige EPG-Zeitangabe:', epgTime);
    return null;
  }

  const date = new Date(Date.UTC(year, month, day, hour - tzHour, minute - tzMin, second));
  return date;
}

// Funktion zum Finden des aktuellen Programms basierend auf der Uhrzeit
function getCurrentProgram(channelId) {
  const now = new Date();
  if (epgData[channelId]) {
    const currentProgram = epgData[channelId].find(prog => now >= prog.start && now < prog.stop);
    if (currentProgram) {
      const pastTime = now - currentProgram.start;
      const futureTime = currentProgram.stop - now;
      const totalTime = currentProgram.stop - currentProgram.start;
      const pastPercentage = (pastTime / totalTime) * 100;
      const futurePercentage = (futureTime / totalTime) * 100;
      const description = currentProgram.desc || 'Keine Beschreibung verfügbar';
      const start = currentProgram.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Startzeit
      const end = currentProgram.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });   // Endzeit
      const title = currentProgram.title.replace(/\s*\[.*?\]\s*/g, '').replace(/[\[\]]/g, '');

      return {
        title: `${title} (${start} - ${end})`,
        description: description,
        pastPercentage: pastPercentage,
        futurePercentage: futurePercentage
      };

    } else {
      return { title: 'Keine aktuelle Sendung verfügbar', description: 'Keine Beschreibung verfügbar', pastPercentage: 0, futurePercentage: 0 };
    }
  }
  return { title: 'Keine EPG-Daten verfügbar', description: 'Keine Beschreibung verfügbar', pastPercentage: 0, futurePercentage: 0 };
}

// Player description / next programs
function updatePlayerDescription(title, description) {
  console.log('Updating player description:', title, description);
  document.getElementById('program-title').textContent = title;
  document.getElementById('program-desc').textContent = description;
}

function updateNextPrograms(channelId) {
  console.log('Updating next programs for channel:', channelId);
  const nextProgramsContainer = document.getElementById('next-programs');
  nextProgramsContainer.innerHTML = '';

  if (epgData[channelId]) {
    const now = new Date();
    const upcomingPrograms = epgData[channelId]
      .filter(prog => prog.start > now)
      .slice(0, 4);

    upcomingPrograms.forEach(program => {
      const nextProgramDiv = document.createElement('div');
      nextProgramDiv.classList.add('next-program');

      const nextProgramTitle = document.createElement('h4');
      nextProgramTitle.classList.add('next-program-title');
      const start = program.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const end = program.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const title = program.title.replace(/\s*\[.*?\]\s*/g, '').replace(/[\[\]]/g, '');
      nextProgramTitle.textContent = `${title} (${start} - ${end})`;

      const nextProgramDesc = document.createElement('p');
      nextProgramDesc.classList.add('next-program-desc');
      nextProgramDesc.textContent = program.desc || 'Keine Beschreibung verfügbar';
      nextProgramDesc.style.display = 'none';

      nextProgramDiv.appendChild(nextProgramTitle);
      nextProgramDiv.appendChild(nextProgramDesc);

      nextProgramTitle.addEventListener('click', function() {
        if (nextProgramDesc.style.display === 'none') {
          nextProgramDesc.style.display = 'block';
          // NOTE: Σκόπιμα δεν πειράζω το σημείο 8 (κρατάω την υπάρχουσα κλήση)
          updateProgramInfo(title, nextProgramDesc.textContent);
        } else {
          nextProgramDesc.style.display = 'none';
        }
      });

      nextProgramsContainer.appendChild(nextProgramDiv);
    });
  }
}


/* =========================
   ======== Playlists ======
   ========================= */

// Λίστα μου (τοπικό playlist.m3u)
function loadMyPlaylist() {
  fetch('playlist.m3u')
    .then(response => response.text())
    .then(data => updateSidebarFromM3U(data))
    .catch(error => console.error('Fehler beim Laden der Playlist:', error));
}

// Εξωτερική my-channels.m3u + channel-streams.json
async function loadExternalPlaylist() {
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.innerHTML = '';

  const m3uUrl = 'https://raw.githubusercontent.com/tonis1000/PHTESTP/main/my-channels.m3u';
  const streamsJsonUrl = 'https://yellow-hulking-guan.glitch.me/channel-streams.json';

  try {
    const [m3uRes, jsonRes] = await Promise.all([
      fetch(m3uUrl),
      fetch(streamsJsonUrl)
    ]);

    const m3uText = await m3uRes.text();
    const streamMap = await jsonRes.json();
    const lines = m3uText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXTINF')) {
        const idMatch = lines[i].match(/tvg-id="([^"]+)"/);
        const nameMatch = lines[i].match(/,(.*)$/);
        const nameTagMatch = lines[i].match(/tvg-name="([^"]+)"/);
        const groupMatch = lines[i].match(/group-title="([^"]+)"/);
        const imgMatch = lines[i].match(/tvg-logo="([^"]+)"/);

        const tvgId = idMatch ? idMatch[1] : null;
        const name = nameTagMatch ? nameTagMatch[1].trim() :
                      nameMatch ? nameMatch[1].trim() : 'Unbekannt';
        const group = groupMatch ? groupMatch[1].trim() : '';
        const logo = imgMatch ? imgMatch[1] : 'default_logo.png';

        if (!tvgId || !streamMap[tvgId]) continue;

        let finalUrl = null;
        let usedIndex = -1;

        for (let index = 0; index < streamMap[tvgId].length; index++) {
          const url = streamMap[tvgId][index];
          try {
            const res = await fetch(url);
            if (!res.ok) continue;

            const text = await res.text();
            const isValidM3U = text.includes('#EXTM3U') && /(\.ts|chunklist|media)/i.test(text) && !text.includes('404');

            if (isValidM3U) {
              finalUrl = url;
              usedIndex = index;
              break;
            }
          } catch (e) {
            console.warn(`❌ Stream check failed για ${tvgId}:`, url);
          }
        }

        if (!finalUrl) {
          console.warn(`⚠️ Δεν βρέθηκε ενεργό URL για ${tvgId}`);
          continue;
        }

        const fallbackBadge = usedIndex > 0 ? `<span style="color: orange; font-size: 0.85em;"> 🔁</span>` : '';

        const programInfo = getCurrentProgram(tvgId);
        const listItem = document.createElement('li');
        listItem.innerHTML = `
          <div class="channel-info" data-stream="${finalUrl}" data-channel-id="${tvgId}" data-group="${group}" data-source="external">
            <div class="logo-container">
              <img src="${logo}" alt="${name} Logo">
            </div>
            <span class="sender-name">${name}${fallbackBadge}</span>
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
      }
    }

    checkStreamStatus();
  } catch (error) {
    console.error('❌ Σφάλμα φόρτωσης εξωτερικής playlist:', error);
    sidebarList.innerHTML = '<li style="color:red;">Αποτυχία φόρτωσης λίστας καναλιών.</li>';
  }
}

// Sport πρόγραμμα (foothubhd)
function adjustHourForGermany(timeStr) {
  let [h, m] = timeStr.split(':').map(Number);
  h = (h - 1 + 24) % 24;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function isLiveGame(timeStr, dateStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const [day, month, year] = dateStr.split('/').map(Number);

  // Ώρα αγώνα (σε UTC, αφαιρώντας 3 ώρες από GR ώρα)
  const gameDateUTC = new Date(Date.UTC(year, month - 1, day, h - 3, m));

  // Τρέχουσα ώρα (UTC)
  const now = new Date();
  const nowUTC = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

  // Έλεγχος αν είναι η ίδια μέρα
  const isSameDay = gameDateUTC.getUTCDate() === nowUTC.getUTCDate() &&
                    gameDateUTC.getUTCMonth() === nowUTC.getUTCMonth() &&
                    gameDateUTC.getUTCFullYear() === nowUTC.getUTCFullYear();

  const diffMin = (nowUTC - gameDateUTC) / 60000;
  return isSameDay && diffMin >= -10 && diffMin <= 130;
}

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
          match.links.forEach(async (link, idx) => {
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
              document.getElementById('current-channel-name').textContent = match.title;

              // ➕ Εμφάνιση ποιο link πατήθηκε
              const logoContainer = document.getElementById('current-channel-logo');
              logoContainer.innerHTML = `<span style="color: gold; font-weight: bold;">🔗 ${a.textContent}</span>`;

              playStream(link);
            });

            // 🟢 Ανίχνευση LIVE preview από iframe (π.χ. .m3u8 μέσα στο HTML)
            try {
              const html = await fetch(proxy + link).then(res => res.text());

              if (
                html.includes('.m3u8') ||
                html.includes('<video') ||
                html.includes('autoplay') ||
                html.includes('hls.js') ||
                html.includes('Clappr') ||
                html.includes('jwplayer')
              ) {
                const liveBadge = document.createElement('span');
                liveBadge.textContent = ' 🟢LIVE?';
                liveBadge.style.color = 'limegreen';
                liveBadge.style.fontWeight = 'bold';
                a.appendChild(liveBadge);
              }
            } catch (e) {
              console.warn('Δεν μπορώ να κάνω preview για:', link);
            }

            linksDiv.appendChild(a);
          });

          li.appendChild(title);
          li.appendChild(linksDiv);
          sidebarList.appendChild(li);
        });

        matchesForDay = [];
      }
    };

    // 🔁 Ανάλυση κάθε γραμμής του αρχείου
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // ✅ Εντοπισμός header "ΠΡΟΓΡΑΜΜΑ ..."
      const dateMatch = line.match(/ΠΡΟΓΡΑΜΜΑ\s+([Α-Ωα-ωA-Za-z]+)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        flushDay();

        const weekdayFromText = dateMatch[1].toLowerCase();
        const originalDay = parseInt(dateMatch[2], 10);
        const originalMonth = parseInt(dateMatch[3], 10);
        const originalYear = parseInt(dateMatch[4], 10);

        let originalDate = new Date(originalYear, originalMonth - 1, originalDay);
        let correctedDate = null;

        // 🔎 Ψάχνουμε μόνο ±3 μέρες από σήμερα
        const today = new Date();
        for (let offset = -3; offset <= 7; offset++) {
          const testDate = new Date(today);
          testDate.setDate(today.getDate() + offset);

          const weekday = testDate.toLocaleDateString('el-GR', { weekday: 'long' }).toLowerCase();
          if (weekday === weekdayFromText) {
            correctedDate = testDate;
            break;
          }
        }

        if (!correctedDate) {
          console.warn(`⚠️ Δεν βρέθηκε κατάλληλη ημερομηνία για "${weekdayFromText}", κρατάμε ${originalDate.toLocaleDateString()}`);
          correctedDate = originalDate;
        } else {
          console.log(`✅ Διορθώθηκε ημερομηνία για "${weekdayFromText}": ${correctedDate.toLocaleDateString('el-GR')}`);
        }

        currentDate = `${correctedDate.getDate()}/${correctedDate.getMonth() + 1}/${correctedDate.getFullYear()}`;
        currentDateWithDay = `${correctedDate.toLocaleDateString('el-GR', { weekday: 'long' })} ${currentDate}`;
        continue;
      }

      const gameMatches = [...line.matchAll(/(\d{1,2}:\d{2})\s+([^\/\n]+?)(?=\s*(\/|https?:\/\/|$))/g)];
      const linkMatches = [...line.matchAll(/https?:\/\/[^\s]+/g)].map(m => m[0]);

      if (gameMatches.length && linkMatches.length) {
        gameMatches.forEach(game => {
          matchesForDay.push({
            time: game[1], // κρατάμε την ώρα GR όπως είναι
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

// Playlist URLs panel (playlist-urls.txt)
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
            link.classList.add('source-entry');

            link.addEventListener('click', function (event) {
              event.preventDefault();

              document.querySelectorAll('#playlist-url-list a').forEach(a => a.classList.remove('active'));
              this.classList.add('active');

              document.getElementById('stream-url').value = url;

              console.log('Versuche URL abzurufen:', url);
              fetch(url)
                .then(response => {
                  if (!response.ok) throw new Error('Netzwerkantwort war nicht ok.');
                  return response.text();
                })
                .then(data => {
                  console.log('Daten erfolgreich geladen. Verarbeite M3U-Daten.');
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


/* =========================
   ======= Rendering =======
   ========================= */

// Sidebar από M3U
function updateSidebarFromM3U(data) {
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.innerHTML = '';

  const lines = data.split('\n');
  const foundGroups = new Set(); // 🆕 Ομάδες για group-title
  const groupSelect = document.getElementById('group-select');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF')) {
      const idMatch = lines[i].match(/tvg-id="([^"]+)"/);
      const nameMatch = lines[i].match(/,(.*)$/);
      const nameTagMatch = lines[i].match(/tvg-name="([^"]+)"/);
      const groupMatch = lines[i].match(/group-title="([^"]+)"/);
      const imgMatch = lines[i].match(/tvg-logo="([^"]+)"/);

      const channelId = idMatch ? idMatch[1] : null;
      const name = nameTagMatch
        ? nameTagMatch[1].trim()
        : nameMatch
        ? nameMatch[1].trim()
        : 'Unbekannt';
      const group = groupMatch ? groupMatch[1].trim() : '';
      const imgURL = imgMatch ? imgMatch[1] : 'default_logo.png';

      const streamLine = lines[i + 1] || '';
      const streamURL = streamLine.trim().startsWith('http') ? streamLine.trim() : null;

      if (streamURL) {
        try {
          const programInfo = getCurrentProgram(channelId);

          // 🧠 Εύρεση από cache
          const normalizedUrl = streamURL.replace(/^http:/, 'https:');
          const alternateUrl = streamURL.replace(/^https:/, 'http:');
          const perf =
            streamPerfMap[streamURL] ||
            streamPerfMap[normalizedUrl] ||
            streamPerfMap[alternateUrl] ||
            {};

          const playerBadge = perf.player
            ? `<span class="badge" style="font-size: 0.7em; color: gold; margin-left: 6px;">[${perf.player}]</span>`
            : '';

          if (group) foundGroups.add(group); // 🆕 Προσθήκη group

          const listItem = document.createElement('li');
          listItem.innerHTML = `
            <div class="channel-info ${perf.player ? 'cached-stream' : ''}" data-stream="${streamURL}" data-channel-id="${channelId}" data-group="${group}">
              <div class="logo-container">
                <img src="${imgURL}" alt="${name} Logo">
              </div>
              <span class="sender-name">${name}${playerBadge}</span>
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

  // Γέμισμα dropdown group-select με ομάδες
  if (groupSelect) {
    if (foundGroups.size > 0) {
      groupSelect.disabled = false;
      groupSelect.innerHTML = '<option value="__all__">Όλα</option>';
      [...foundGroups].sort().forEach(group => {
        const opt = document.createElement('option');
        opt.value = group;
        opt.textContent = group;
        groupSelect.appendChild(opt);
      });
    } else {
      groupSelect.disabled = true;
      groupSelect.innerHTML = '<option value="__all__">-- Δεν υπάρχουν κατηγορίες --</option>';
    }
  }

  checkStreamStatus();
}

// Έλεγχος online/marking
function checkStreamStatus() {
  const sidebarChannels = document.querySelectorAll('.channel-info');
  sidebarChannels.forEach(channel => {
    const streamURL = channel.dataset.stream;

    if (streamURL) {
      // ➤ Αναγνώρισε αν είναι iframe stream από αξιόπιστο domain
      const looksLikeIframe = streamURL.includes('lakatamia.tv') || streamURL.includes('anacon.org') || streamURL.includes('sportskeeda') || streamURL.includes('embed.vindral.com');

      if (looksLikeIframe) {
        // Θεώρησέ το ως online
        channel.classList.add('online');
        const senderName = channel.querySelector('.sender-name');
        if (senderName) {
          senderName.style.color = 'lightgreen';
          senderName.style.fontWeight = 'bold';
        }
        return; // Παράκαμψε το fetch()
      }

      // ➤ Κανονικός έλεγχος fetch για m3u8, mp4 κλπ
      fetch(streamURL)
        .then(response => {
          const senderName = channel.querySelector('.sender-name');
          if (response.ok) {
            channel.classList.add('online');
            if (senderName) {
              senderName.style.color = 'lightgreen';
              senderName.style.fontWeight = 'bold';
            }
          } else {
            channel.classList.remove('online');
            if (senderName) {
              senderName.style.color = '';
              senderName.style.fontWeight = '';
            }
          }
        })
        .catch(error => {
          console.error('Fehler beim Überprüfen des Stream-Status:', error);
          channel.classList.remove('online');
          const senderName = channel.querySelector('.sender-name');
          if (senderName) {
            senderName.style.color = '';
            senderName.style.fontWeight = '';
          }
        });
    }
  });
}


/* =========================
   ========= Player ========
   ========================= */

// Καταγραφή χρήσης stream (με tvgId, proxy κλπ)
function logStreamUsage(initialUrl, finalUrl, playerUsed) {
  const now = new Date().toISOString();
  const proxyUsed = (initialUrl !== finalUrl) ? finalUrl.replace(initialUrl, '') : '';
  const type = detectStreamType(initialUrl);

  const previous = globalStreamCache[initialUrl];

  // ➕ Απόπειρα ανάγνωσης tvg-id από DOM
  let tvgId = null;
  const el = document.querySelector(`.channel-info[data-stream="${initialUrl}"]`);
  if (el && el.dataset.channelId) {
    tvgId = el.dataset.channelId;
  }

  if (
    previous &&
    previous.proxy === proxyUsed &&
    previous.player === playerUsed &&
    previous.type === type &&
    previous.tvgId === tvgId
  ) {
    console.log(`ℹ️ Stream ήδη καταγεγραμμένο χωρίς αλλαγές: ${initialUrl}`);
    return;
  }

  globalStreamCache[initialUrl] = {
    timestamp: now,
    proxy: proxyUsed,
    player: playerUsed,
    type: type,
    tvgId: tvgId || null
  };

  if (previous) {
    console.log(`♻️ Ενημερώθηκε stream στο cache: ${initialUrl}`);
  } else {
    console.log(`➕ Νέα καταγραφή stream: ${initialUrl}`);
  }
}

// Κύριο playStream + fallbacks
async function playStream(initialURL, subtitleURL = null) {
  const videoPlayer = document.getElementById('video-player');
  const iframePlayer = document.getElementById('iframe-player');
  const clapprDiv = document.getElementById('clappr-player');
  const subtitleTrack = document.getElementById('subtitle-track');

  console.log('🔄 Reset players και sources');
  if (clapprPlayer) clapprPlayer.destroy();
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  videoPlayer.load();
  iframePlayer.src = '';
  subtitleTrack.src = '';
  subtitleTrack.track.mode = 'hidden';
  videoPlayer.style.display = 'none';
  iframePlayer.style.display = 'none';
  clapprDiv.style.display = 'none';

  const showVideoPlayer = () => {
    videoPlayer.style.display = 'block';
    if (subtitleURL) {
      subtitleTrack.src = subtitleURL;
      subtitleTrack.track.mode = 'showing';
    }
  };

  let streamURL = initialURL;
  const normalizedUrl = initialURL.replace(/^http:/, 'https:');
  const alternateUrl = initialURL.replace(/^https:/, 'http:');
  const cached = streamPerfMap[normalizedUrl] || streamPerfMap[initialURL] || streamPerfMap[alternateUrl];
  console.log('🎯 Cache:', normalizedUrl, cached);

  if (cached) {
    console.log('⚡ Παίζει από Cache:', cached.player);
    try {
      if (cached.player === 'iframe') {
        iframePlayer.style.display = 'block';
        iframePlayer.src = initialURL.includes('autoplay') ? initialURL : initialURL + (initialURL.includes('?') ? '&' : '?') + 'autoplay=1';
        showPlayerInfo('iframe', true);
        return;
      } else if (cached.player === 'clappr') {
        clapprDiv.style.display = 'block';
        clapprPlayer = new Clappr.Player({ source: initialURL, parentId: '#clappr-player', autoPlay: true, width: '100%', height: '100%' });
        showPlayerInfo('clappr', true);
        return;
      } else if (cached.player.startsWith('hls') && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(initialURL);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play());
        showVideoPlayer();
        showPlayerInfo('hls.js', true);
        return;
      }
    } catch (e) {
      console.warn('❌ Σφάλμα από Cache:', e.message);
    }
  }

  const type = detectStreamType(streamURL);
  console.log('📦 Τύπος Stream:', type);

  if (isIframeStream(streamURL)) {
    console.log('🌐 Ύποπτο Iframe. Ψάχνω .m3u8...');
    const m3u8 = await findM3U8inIframe(streamURL);
    if (m3u8) {
      streamURL = m3u8;
      console.log('✅ Βρέθηκε .m3u8:', streamURL);
    } else {
      console.warn('▶️ Δεν βρέθηκε .m3u8 ➜ Παίζει το iframe');
      iframePlayer.style.display = 'block';
      iframePlayer.src = streamURL.includes('autoplay') ? streamURL : streamURL + (streamURL.includes('?') ? '&' : '?') + 'autoplay=1';
      logStreamUsage(initialURL, streamURL, 'iframe');
      showPlayerInfo('iframe');
      return;
    }
  }

  console.log('🌍 Έλεγχος Direct/Proxy...');
  const workingUrl = await findWorkingUrl(streamURL);
  if (!workingUrl) {
    console.warn('🚫 Δεν βρέθηκε τίποτα ➜ Fallback...');
    return tryFallbackPlayers(initialURL, streamURL);
  }
  streamURL = workingUrl;

  try {
    if (streamURL.endsWith('.m3u8') && Hls.isSupported()) {
      console.log('▶️ HLS.js αναπαραγωγή...');
      const hls = new Hls();
      hls.loadSource(streamURL);
      hls.attachMedia(videoPlayer);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play());
      showVideoPlayer();
      logStreamUsage(initialURL, streamURL, 'hls.js');
      showPlayerInfo('HLS.js');
      return;
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('▶️ Native HLS...');
      videoPlayer.src = streamURL;
      videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
      showVideoPlayer();
      logStreamUsage(initialURL, streamURL, 'native-hls');
      showPlayerInfo('Native HLS');
      return;
    } else if (streamURL.endsWith('.mpd')) {
      console.log('▶️ DASH με dash.js...');
      const dashPlayer = dashjs.MediaPlayer().create();
      dashPlayer.initialize(videoPlayer, streamURL, true);
      showVideoPlayer();
      logStreamUsage(initialURL, streamURL, 'dash.js');
      showPlayerInfo('Dash.js');
      return;
    } else if (streamURL.endsWith('.mp4') || streamURL.endsWith('.webm')) {
      console.log('▶️ Αναπαραγωγή MP4/WebM...');
      videoPlayer.src = streamURL;
      videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
      showVideoPlayer();
      logStreamUsage(initialURL, streamURL, 'native-mp4');
      showPlayerInfo('MP4/WebM');
      return;
    }
  } catch (err) {
    console.warn('⚠️ Σφάλμα κατά την αναπαραγωγή:', err);
  }

  return tryFallbackPlayers(initialURL, streamURL);
}

function tryFallbackPlayers(initialURL, streamURL) {
  const iframePlayer = document.getElementById('iframe-player');
  const clapprDiv = document.getElementById('clappr-player');

  const isVideo = /\.(m3u8|mp4|ts|webm)$/i.test(streamURL);
  console.log('🔁 Fallback:', isVideo ? 'Clappr' : 'Iframe');

  if (isVideo) {
    clapprDiv.style.display = 'block';
    let started = false;

    clapprPlayer = new Clappr.Player({
      source: streamURL,
      parentId: '#clappr-player',
      autoPlay: true,
      width: '100%',
      height: '100%'
    });

    clapprPlayer.on('PLAYING', () => {
      started = true;
      console.log('✅ Clappr ξεκίνησε');
      logStreamUsage(initialURL, streamURL, 'clappr-fallback');
      showPlayerInfo('Clappr fallback');
    });

    clapprPlayer.on('ERROR', () => {
      if (!started) {
        console.warn('⚠️ Clappr ERROR ➜ iframe fallback');
        fallbackToIframe();
      }
    });

    setTimeout(() => {
      const html = clapprDiv?.innerHTML.trim();
      if (!started || !html || html.length < 100) {
        console.warn('⏱️ Clappr δεν ξεκίνησε ➜ iframe fallback');
        fallbackToIframe();
      }
    }, 5000);
  } else {
    fallbackToIframe();
  }

  function fallbackToIframe() {
    if (clapprPlayer) clapprPlayer.destroy();
    clapprDiv.style.display = 'none';
    iframePlayer.style.display = 'block';
    iframePlayer.src = streamURL.includes('autoplay') ? streamURL : streamURL + (streamURL.includes('?') ? '&' : '?') + 'autoplay=1';
    logStreamUsage(initialURL, streamURL, 'iframe-fallback');
    showPlayerInfo('Iframe fallback');
  }
}

// Ενδείξεις player/overlay
function showPlayerInfo(playerName, fromCache = false) {
  const label = document.getElementById('player-info-label');
  if (label) {
    label.textContent = `${fromCache ? '🧠 Από Cache: ' : '🎯 Player: '}${playerName}`;
    label.style.display = 'block';

    clearTimeout(label.hideTimeout);
    label.hideTimeout = setTimeout(() => {
      label.style.display = 'none';
    }, 4000);
  }

  const overlay = document.getElementById('player-status');
  if (overlay) {
    let displayText = '';
    if (!playerName || playerName.toLowerCase() === 'none') {
      displayText = '🚫 Δεν βρέθηκε κατάλληλος player';
    } else {
      displayText = `🎥 Παίζει με: ${playerName}`;
    }
    overlay.textContent = displayText;
    overlay.style.display = 'block';

    clearTimeout(overlay.hideTimeout);
    if (!playerName.toLowerCase().includes('fallback') && playerName.toLowerCase() !== 'none') {
      overlay.hideTimeout = setTimeout(() => {
        overlay.style.display = 'none';
      }, 5000);
    }
  }
}


/* =========================
   ========= Cache =========
   ========================= */

function hasNewEntries(current, previous) {
  const currentKeys = Object.keys(current);
  const previousKeys = Object.keys(previous);
  if (currentKeys.length !== previousKeys.length) return true;

  return currentKeys.some(key => {
    return !previous[key] ||
           previous[key].timestamp !== current[key].timestamp ||
           previous[key].proxy !== current[key].proxy ||
           previous[key].player !== current[key].player;
  });
}

async function sendGlobalCacheIfUpdated(force = false) {
  if (!force && !hasNewEntries(globalStreamCache, lastSentCache)) {
    console.log('⏸️ Καμία αλλαγή, δεν στάλθηκε τίποτα στο Glitch.');
    return 'no-change';
  }

  try {
    const response = await fetch(CACHE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(globalStreamCache)
    });

    if (response.ok) {
      console.log('✅ Το globalStreamCache στάλθηκε επιτυχώς στο Glitch API');
      lastSentCache = JSON.parse(JSON.stringify(globalStreamCache)); // βαθύ αντίγραφο
      return 'success';
    } else {
      console.warn('❌ Αποτυχία αποστολής στο API:', await response.text());
      return 'error';
    }
  } catch (err) {
    console.error('🚫 Σφάλμα κατά την αποστολή στο Glitch API:', err);
    return 'error';
  }
}

// Χειροκίνητη αποστολή cache
document.getElementById('send-cache-button')?.addEventListener('click', async () => {
  console.log('⏩ Χειροκίνητη αποστολή cache...');

  const statusEl = document.getElementById('cache-status-message');
  statusEl.style.display = 'block';
  statusEl.style.color = 'white';
  statusEl.textContent = '⏳ Γίνεται αποστολή cache...';

  try {
    const response = await fetch('https://yellow-hulking-guan.glitch.me/upload-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(globalStreamCache)
    });

    if (!response.ok) {
      throw new Error('Αποτυχία απόκρισης server');
    }

    const result = await response.json();

    if (result.status === 'Updated') {
      statusEl.style.color = 'lime';
      statusEl.textContent = `✅ Το cache στάλθηκε! Προστέθηκαν ${result.tvgCount || 0} κανάλια στο channel-streams.json.`;
    } else if (result.status === 'No changes') {
      statusEl.style.color = 'orange';
      statusEl.textContent = 'ℹ️ Δεν υπήρχαν αλλαγές. Το channel-streams παρέμεινε ίδιο.';
    } else {
      statusEl.style.color = 'red';
      statusEl.textContent = '❌ Απροσδιόριστη απάντηση από server.';
    }
  } catch (e) {
    console.error('❌ Σφάλμα κατά την αποστολή cache:', e);
    statusEl.style.color = 'red';
    statusEl.textContent = '🚫 Γενικό σφάλμα: ' + e.message;
  }

  setTimeout(() => {
    statusEl.style.display = 'none';
    statusEl.textContent = '';
  }, 4000);
});


/* =========================
   ======== Subtitles ======
   ========================= */

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

function convertSrtToVtt(srtContent) {
  const vttContent = 'WEBVTT\n\n' + srtContent
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');

  return vttContent;
}


/* =========================
   ========== UI ===========
   ========================= */

function setCurrentChannel(channelName, streamUrl) {
  const currentChannelName = document.getElementById('current-channel-name');
  const streamUrlInput = document.getElementById('stream-url');
  currentChannelName.textContent = channelName; // Nur der Sendername
  streamUrlInput.value = streamUrl;
}

// Ώρα/ημερομηνία
function updateClock() {
  const now = new Date();
  const tag = now.toLocaleDateString('de-DE', { weekday: 'long' });
  const datum = now.toLocaleDateString('de-DE');
  const uhrzeit = now.toLocaleTimeString('de-DE', { hour12: false });
  document.getElementById('tag').textContent = tag;
  document.getElementById('datum').textContent = datum;
  document.getElementById('uhrzeit').textContent = uhrzeit;
}

// foothubhd-Wetter toggle
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


/* =========================
   ======== Events =========
   ========================= */

// Playlist Button
document.getElementById('playlist-button').addEventListener('click', function() {
  const playlistURL = document.getElementById('stream-url').value;
  if (playlistURL) {
    fetchResource(playlistURL);
  }
});

// Fetch resource (με/χωρίς CORS proxy)
async function fetchResource(url) {
  let finalUrl = url;

  try {
    // 1. Versuch: CORS-Proxy
    log('Trying with CORS proxy...');
    let response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);

    if (!response.ok) {
      log('CORS proxy request failed, trying HTTPS...');
      finalUrl = finalUrl.replace('http:', 'https:');
      response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
    }

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.text();
    updateSidebarFromM3U(data);
    // επιτυχία με proxy -> δεν συνεχίζουμε σε direct
    return;
  } catch (error) {
    console.error('Fehler beim Laden der Playlist mit CORS-Proxy:', error);
  }

  try {
    // 2. Versuch: Direkt
    log('Trying without CORS proxy...');
    let response = await fetch(finalUrl);

    if (!response.ok) {
      log('Direct request failed, trying HTTPS...');
      finalUrl = finalUrl.replace('http:', 'https:');
      response = await fetch(finalUrl);
    }

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.text();
    updateSidebarFromM3U(data);
  } catch (error) {
    console.error('Fehler beim Laden der Playlist ohne CORS-Proxy:', error);
  }
}

// Leeren Button
document.getElementById('clear-button').addEventListener('click', function() {
  document.getElementById('stream-url').value = '';
});

// Kopieren Button
document.getElementById('copy-button').addEventListener('click', function() {
  var streamUrlInput = document.getElementById('stream-url');
  streamUrlInput.select();
  document.execCommand('copy');
});

// Group filter (standalone handler)
document.getElementById('group-select').addEventListener('change', function () {
  const selectedGroup = this.value;
  const allItems = document.querySelectorAll('#sidebar-list .channel-info');
  allItems.forEach(el => {
    const li = el.closest('li');
    if (!li) return;
    const group = el.dataset.group || '';
    li.style.display = (selectedGroup === '__all__' || group === selectedGroup) ? '' : 'none';
  });
});

// Δημιουργία overlay αν δεν υπάρχει
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('player-status')) {
    const overlay = document.createElement('div');
    overlay.id = 'player-status';
    overlay.style.position = 'absolute';
    overlay.style.top = '5px';
    overlay.style.left = '5px';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.color = 'white';
    overlay.style.padding = '4px 8px';
    overlay.style.zIndex = '9999';
    overlay.style.fontSize = '13px';
    overlay.style.borderRadius = '4px';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
  }
});

// Κύριο DOMContentLoaded: φόρτωση χαρτών, EPG, handlers, search/filters
document.addEventListener('DOMContentLoaded', function () {
  // Φόρτωση proxy-map.json
  fetch('https://yellow-hulking-guan.glitch.me/proxy-map.json')
    .then(res => res.json())
    .then(data => {
      streamPerfMap = data;
      console.log('🔁 Proxy-Player Map geladen:', streamPerfMap);
    })
    .catch(err => {
      console.warn('⚠️ Fehler beim Laden des proxy-map.json:', err);
    });

  loadEPGData();
  updateClock();
  setInterval(updateClock, 1000);

  document.getElementById('myPlaylist').addEventListener('click', loadMyPlaylist);
  document.getElementById('externalPlaylist').addEventListener('click', loadExternalPlaylist);
  document.getElementById('sportPlaylist').addEventListener('click', loadSportPlaylist);

  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.addEventListener('click', function (event) {
    const channelInfo = event.target.closest('.channel-info');
    if (channelInfo) {
      // Αφαίρεση "selected" από όλα
      document.querySelectorAll('.channel-info.selected').forEach(el => {
        el.classList.remove('selected');
      });

      // Προσθήκη "selected"
      channelInfo.classList.add('selected');

      const streamURL = channelInfo.dataset.stream;
      const channelId = channelInfo.dataset.channelId;
      const source = channelInfo.dataset.source || 'default';
      const programInfo = getCurrentProgram(channelId);

      setCurrentChannel(channelInfo.querySelector('.sender-name').textContent, streamURL);

      if (source === 'external') {
        playStreamByTvgId(channelId);
      } else {
        playStream(streamURL);
      }

      updatePlayerDescription(programInfo.title, programInfo.description);
      updateNextPrograms(channelId);

      const logoContainer = document.getElementById('current-channel-logo');
      const logoImg = channelInfo.querySelector('.logo-container img').src;
      logoContainer.src = logoImg;
    }
  });

  setInterval(checkStreamStatus, 60000);

  const playButton = document.getElementById('play-button');
  const streamUrlInput = document.getElementById('stream-url');
  const subtitleFileInput = document.getElementById('subtitle-file');

  const playStreamFromInput = () => {
    const streamUrl = streamUrlInput.value;
    const subtitleFile = subtitleFileInput?.files?.[0];
    if (streamUrl) {
      if (subtitleFile) {
        handleSubtitleFile(subtitleFile);
      }
      playStream(streamUrl, subtitleFile ? document.getElementById('subtitle-track').src : null);
    }
  };

  playButton.addEventListener('click', playStreamFromInput);
  streamUrlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') playStreamFromInput();
  });
  subtitleFileInput?.addEventListener('change', (event) => {
    const subtitleFile = event.target.files[0];
    if (subtitleFile) handleSubtitleFile(subtitleFile);
  });

  // 🔍 Αναζήτηση
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', function () {
    const filter = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => {
      const text = item.textContent || item.innerText;
      item.style.display = text.toLowerCase().includes(filter) ? '' : 'none';
    });
  });

  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      const firstVisibleItem = document.querySelector('#sidebar-list li[style=""]');
      if (firstVisibleItem) {
        const streamURL = firstVisibleItem.querySelector('.channel-info').dataset.stream;
        playStream(streamURL);
      }
    }
  });

  // Φίλτρα Ομάδας & Online
  const groupSelect = document.getElementById('group-select');

  function applyGroupAndStatusFilter(filterOnlineOnly = false) {
    const selectedGroup = groupSelect?.value || '__all__';
    const allItems = document.querySelectorAll('#sidebar-list .channel-info');

    allItems.forEach(el => {
      const li = el.closest('li');
      if (!li) return;

      const group = el.dataset.group || '';
      const isOnline = el.classList.contains('online');

      const groupMatch = (selectedGroup === '__all__' || group === selectedGroup);
      const onlineMatch = !filterOnlineOnly || isOnline;

      li.style.display = (groupMatch && onlineMatch) ? '' : 'none';
    });
  }

  groupSelect?.addEventListener('change', () => applyGroupAndStatusFilter(false));
  document.getElementById('filter-online-button').addEventListener('click', () => applyGroupAndStatusFilter(true));
  document.getElementById('show-all-button').addEventListener('click', () => applyGroupAndStatusFilter(false));

  // Playlist-URLs panel
  const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
  if (playlistUrlsTitle) {
    playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
  }
});
