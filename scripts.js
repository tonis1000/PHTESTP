
const globalStreamCache = {}; // Κεντρική μνήμη για όλα τα stream URLs

let streamPerfMap = {};



// Funktion zum Laden der Playlist.m3u und Aktualisieren der Sidebar
function loadMyPlaylist() {
    fetch('playlist.m3u')
        .then(response => response.text())
        .then(data => updateSidebarFromM3U(data))
        .catch(error => console.error('Fehler beim Laden der Playlist:', error));
}

// Funktion zum Laden der externen Playlist und Aktualisieren der Sidebar
function loadExternalPlaylist() {
    fetch('https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR')
        .then(response => response.text())
        .then(data => updateSidebarFromM3U(data))
        .catch(error => console.error('Fehler beim Laden der externen Playlist:', error));
}




// Αντιγράφεις αυτό το κομμάτι στην αρχή του scripts.js
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
    // ❌ Αν δεν βρεθεί κάτι λογικό, κρατάμε την αρχική ημερομηνία
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


  




// Playlist Button
document.getElementById('playlist-button').addEventListener('click', function() {
    const playlistURL = document.getElementById('stream-url').value;
    if (playlistURL) {
        fetchResource(playlistURL);
    }
});

// Funktion, um die Ressource abzurufen
async function fetchResource(url) {
    let finalUrl = url;

    try {
        // 1. Versuch: Verwende den CORS-Proxy direkt
        console.log('Trying with CORS proxy...');
        let response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);

        // Wenn die Antwort nicht OK ist, versuchen, die URL auf HTTPS zu ändern
        if (!response.ok) {
            console.log('CORS proxy request failed, trying HTTPS...');
            finalUrl = finalUrl.replace('http:', 'https:'); // Ändern zu HTTPS
            response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
        }

        // Wenn die Antwort immer noch nicht OK ist, Fehler werfen
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.text();
        updateSidebarFromM3U(data);
    } catch (error) {
        console.error('Fehler beim Laden der Playlist mit CORS-Proxy:', error);
    }

    try {
        // 2. Versuch: Ohne den CORS-Proxy
        console.log('Trying without CORS proxy...');
        let response = await fetch(finalUrl);

        // Wenn die Antwort nicht OK ist, versuchen, die URL auf HTTPS zu ändern
        if (!response.ok) {
            console.log('Direct request failed, trying HTTPS...');
            finalUrl = finalUrl.replace('http:', 'https:'); // Ändern zu HTTPS
            response = await fetch(finalUrl);
        }

        // Wenn die Antwort immer noch nicht OK ist, Fehler werfen
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
    document.getElementById('stream-url').value = ''; // Setzt den Wert des Eingabefelds auf leer
});




// Kopieren Button
document.getElementById('copy-button').addEventListener('click', function() {
    var streamUrlInput = document.getElementById('stream-url');
    streamUrlInput.select(); // Markiert den Text im Eingabefeld
    document.execCommand('copy'); // Kopiert den markierten Text in die Zwischenablage
});


  // ⬇️ Χειροκίνητη αποστολή cache ⬇️
document.getElementById('send-cache-button')?.addEventListener('click', async () => {
  console.log('⏩ Χειροκίνητη αποστολή cache...');

  const statusEl = document.getElementById('cache-status-message');
  statusEl.style.display = 'block';
  statusEl.style.color = 'white';
  statusEl.textContent = '⏳ Γίνεται αποστολή cache...';

  try {
    const result = await sendGlobalCacheIfUpdated(true); // με force = true

    if (result === 'success') {
      statusEl.style.color = 'lime';
      statusEl.textContent = '✅ Το cache στάλθηκε και αποθηκεύτηκε!';
    } else if (result === 'no-change') {
      statusEl.style.color = 'orange';
      statusEl.textContent = 'ℹ️ Δεν υπάρχουν νέες αλλαγές στο cache.';
    } else {
      statusEl.style.color = 'red';
      statusEl.textContent = '❌ Σφάλμα αποστολής στο Glitch ή αποθήκευσης.';
    }
  } catch (e) {
    statusEl.style.color = 'red';
    statusEl.textContent = '🚫 Γενικό σφάλμα: ' + e.message;
  }

  setTimeout(() => {
    statusEl.style.display = 'none';
    statusEl.textContent = '';
  }, 3000);
});




// Globales Objekt für EPG-Daten
let epgData = {};

// Funktion zum Laden und Parsen der EPG-Daten
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
                const titleElement = prog.getElementsByTagName('title')[0];
                const descElement = prog.getElementsByTagName('desc')[0];
                if (titleElement) {
                    const title = titleElement.textContent;
                    const desc = descElement ? descElement.textContent : 'Keine Beschreibung verfügbar';
                    if (!epgData[channelId]) {
                        epgData[channelId] = [];
                    }
                    epgData[channelId].push({
                        start: parseDateTime(start),
                        stop: parseDateTime(stop),
                        title: title,
                        desc: desc
                    });
                }
            });
        })
        .catch(error => console.error('Fehler beim Laden der EPG-Daten:', error));
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
            const start = currentProgram.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Startzeit des laufenden Programms
            const end = currentProgram.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Endzeit des laufenden Programms
            const title = currentProgram.title.replace(/\s*\[.*?\]\s*/g, '').replace(/[\[\]]/g, ''); // Titel ohne den Teil in eckigen Klammern

            return {
                title: `${title} (${start} - ${end})`, // Verwende den bereinigten Titel ohne den Teil in eckigen Klammern
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

// Funktion zum Aktualisieren des Players mit der Programmbeschreibung
function updatePlayerDescription(title, description) {
    console.log('Updating player description:', title, description);
    document.getElementById('program-title').textContent = title;
    document.getElementById('program-desc').textContent = description;
}


// Funktion zum Aktualisieren der nächsten Programme
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
                    nextProgramDesc.style.display = 'none'; // Standardmäßig ausgeblendet

                    nextProgramDiv.appendChild(nextProgramTitle);
                    nextProgramDiv.appendChild(nextProgramDesc);

                    nextProgramTitle.addEventListener('click', function() {
                        if (nextProgramDesc.style.display === 'none') {
                            nextProgramDesc.style.display = 'block';
                            updateProgramInfo(title, nextProgramDesc.textContent);
                        } else {
                            nextProgramDesc.style.display = 'none';
                        }
                    });

                    nextProgramsContainer.appendChild(nextProgramDiv);
                });
            }
        }






// Funktion zum Aktualisieren der Sidebar von einer M3U-Datei
async function updateSidebarFromM3U(data) {
    const sidebarList = document.getElementById('sidebar-list');
    sidebarList.innerHTML = '';

    const extractStreamURLs = (data) => {
        const urls = {};
        const lines = data.split('\n');
        let currentChannelId = null;

        lines.forEach(line => {
            if (line.startsWith('#EXTINF')) {
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                currentChannelId = idMatch ? idMatch[1] : null;
                if (currentChannelId && !urls[currentChannelId]) {
                    urls[currentChannelId] = [];
                }
            } else if (currentChannelId && line.startsWith('http')) {
                urls[currentChannelId].push(line);
                currentChannelId = null;
            }
        });

        return urls;
    };

    const streamURLs = extractStreamURLs(data);
    const lines = data.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF')) {
            const idMatch = lines[i].match(/tvg-id="([^"]+)"/);
            const channelId = idMatch ? idMatch[1] : null;
            const nameMatch = lines[i].match(/,(.*)$/);
            const name = nameMatch ? nameMatch[1].trim() : 'Unbekannt';

            const imgMatch = lines[i].match(/tvg-logo="([^"]+)"/);
            const imgURL = imgMatch ? imgMatch[1] : 'default_logo.png';

            const streamURL = lines[i + 1].startsWith('http') ? lines[i + 1].trim() : null;

            if (streamURL) {
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

    checkStreamStatus();
}






// Funktion zum Überprüfen des Status der Streams und Markieren der gesamten Sidebar-Einträge
function checkStreamStatus() {
    const sidebarChannels = document.querySelectorAll('.channel-info');
    sidebarChannels.forEach(channel => {
        const streamURL = channel.dataset.stream;
        if (streamURL) {
            fetch(streamURL)
                .then(response => {
                    if (response.ok) {
                        channel.classList.add('online'); // Markiere den gesamten Sidebar-Eintrag
                        channel.querySelector('.sender-name').style.color = 'lightgreen'; // Ändere die Textfarbe des Sendernamens
                        channel.querySelector('.sender-name').style.fontWeight = 'bold'; // Ändere die Schriftstärke des Sendernamens
                    } else {
                        channel.classList.remove('online'); // Entferne die Markierung
                        channel.querySelector('.sender-name').style.color = ''; // Setze die Textfarbe des Sendernamens zurück
                        channel.querySelector('.sender-name').style.fontWeight = ''; // Setze die Schriftstärke des Sendernamens zurück
                    }
                })
                .catch(error => {
                    console.error('Fehler beim Überprüfen des Stream-Status:', error);
                    channel.classList.remove('online'); // Entferne die Markierung bei einem Fehler
                    channel.querySelector('.sender-name').style.color = ''; // Setze die Textfarbe des Sendernamens zurück
                    channel.querySelector('.sender-name').style.fontWeight = ''; // Setze die Schriftstärke des Sendernamens zurück
                });
        }
    });
}






// Funktion zum Setzen des aktuellen Sendernamens und der URL
function setCurrentChannel(channelName, streamUrl) {
    const currentChannelName = document.getElementById('current-channel-name');
    const streamUrlInput = document.getElementById('stream-url');
    currentChannelName.textContent = channelName; // Nur der Sendername
    streamUrlInput.value = streamUrl;
}

// Aktualisierung der Uhrzeit
function updateClock() {
    const now = new Date();
    const tag = now.toLocaleDateString('de-DE', { weekday: 'long' });
    const datum = now.toLocaleDateString('de-DE');
    const uhrzeit = now.toLocaleTimeString('de-DE', { hour12: false });
    document.getElementById('tag').textContent = tag;
    document.getElementById('datum').textContent = datum;
    document.getElementById('uhrzeit').textContent = uhrzeit;
}




// scripts.js – Ανανεωμένη έκδοση με γρηγορότερη ανίχνευση και Proxy fallback
const proxyList = [
  "", // δοκιμή χωρίς proxy πρώτα
  'https://groovy-ossified-legal.glitch.me/?url=',
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://tonis-proxy.onrender.com/',
  'https://api.allorigins.win/raw?url=',
  'https://thingproxy.freeboard.io/fetch/',
  'https://corsproxy.io/?',
  'https://cors.bridged.cc/',
  'https://yacdn.org/proxy/'
];

let clapprPlayer = null;



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



async function autoProxyFetch(url) {
  debug(`🌐 Ξεκινάω δοκιμές proxy για: ${url}`);

  for (let proxy of proxyList) {
    const testUrl = proxy.endsWith('=') ? proxy + encodeURIComponent(url) : proxy + url;
    try {
      let res = await fetch(testUrl, { method: 'HEAD', mode: 'cors' });

      if (res.status === 403 || res.status === 405) {
        debug(`⚠️ Proxy ${proxy || "direct"} δεν υποστηρίζει HEAD, δοκιμή με GET...`);
        res = await fetch(testUrl, { method: 'GET', mode: 'cors' });
      }

      if (res.ok) {
        debug(`✅ Proxy πέτυχε: ${proxy || "direct"}`);
        return testUrl;
      } else {
        debug(`⛔ Proxy απέτυχε: ${proxy || "direct"} (status ${res.status})`);
      }
    } catch (e) {
      debug(`⛔ Proxy απέτυχε: ${proxy || "direct"} (${e.message})`);
    }
  }

  debug('❌ Κανένας proxy δεν λειτούργησε.');
  return null;
}






async function findM3U8inIframe(url, proxyList) {
  for (let proxy of proxyList) {
    const proxiedUrl = proxy.endsWith('=') ? proxy + encodeURIComponent(url) : proxy + url;
    try {
      const response = await fetch(proxiedUrl);
      if (response.ok) {
        const html = await response.text();
        const m3u8Match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8)/i);
        if (m3u8Match) {
          console.log('🔎 Βρέθηκε .m3u8 μέσα σε iframe:', m3u8Match[1]);
          return m3u8Match[1];
        }
      }
    } catch (error) {
      console.warn('⚠️ Σφάλμα προσπάθειας ανάκτησης από proxy:', proxy, error);
    }
  }
  console.warn('❌ Δεν βρέθηκε απευθείας .m3u8 στο iframe, θα παίξουμε το iframe όπως είναι.');
  return null;
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







function debug(msg) {
  console.log(msg);
  const el = document.getElementById('debug-log');
  if (el) {
    el.innerHTML += msg + '<br>';
  }
}




async function fixM3U8RelativeLinks(m3u8Url) {
  try {
    const response = await fetch(m3u8Url);
    if (!response.ok) throw new Error('Failed to fetch M3U8');

    const text = await response.text();
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

    const fixedText = text.replace(
      /^(?!#)(?!https?:\/\/)([^\s]+)$/gm,
      (match) => {
        let absUrl = baseUrl + match;
        if (m3u8Url.includes('glitch.me') || m3u8Url.includes('railway.app') || m3u8Url.includes('proxy')) {
          const proxyPrefix = m3u8Url.split('?url=')[0] + '?url=';
          absUrl = proxyPrefix + encodeURIComponent(absUrl);
        }
        return absUrl;
      }
    );

    const blob = new Blob([fixedText], { type: 'application/vnd.apple.mpegurl' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('⚠️ Σφάλμα στο fixM3U8RelativeLinks:', error);
    return m3u8Url;
  }
}



const safeTryPlay = async (proxy, player) => {
  try {
    let tempURL = initialURL;
    if (proxy) {
      tempURL = proxy.endsWith('=') ? proxy + encodeURIComponent(initialURL) : proxy + initialURL;
    }

    console.log(`🧪 Προσπαθώ με player: ${player} μέσω ${proxy ? proxy : 'direct'}`);

    let success = false;

    if (player === 'iframe') {
      iframePlayer.style.display = 'block';
      iframePlayer.src = tempURL.includes('autoplay') ? tempURL : tempURL + (tempURL.includes('?') ? '&' : '?') + 'autoplay=1';
      success = true; // iframe δεν έχει "playing" event, το θεωρούμε ΟΚ
    } else if (player === 'clappr') {
      clapprDiv.style.display = 'block';
      clapprPlayer = new Clappr.Player({
        source: tempURL,
        parentId: '#clappr-player',
        autoPlay: true,
        width: '100%',
        height: '100%'
      });
      success = true; // Clappr δεν μπορεί να γίνει σωστά await
    } else {
      // Για native και hls.js
      let setupPlayer = false;

      if (player === 'hls.js' && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(tempURL);
        hls.attachMedia(videoPlayer);
        setupPlayer = true;
      } else if (player === 'native-hls' && videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = tempURL;
        setupPlayer = true;
      } else if (player === 'dash.js' && tempURL.endsWith('.mpd')) {
        const dashPlayer = dashjs.MediaPlayer().create();
        dashPlayer.initialize(videoPlayer, tempURL, true);
        setupPlayer = true;
      } else if (player === 'native-mp4' && (videoPlayer.canPlayType('video/mp4') || videoPlayer.canPlayType('video/webm'))) {
        videoPlayer.src = tempURL;
        setupPlayer = true;
      }

      if (setupPlayer) {
        videoPlayer.style.display = 'block';

        // ΤΩΡΑ: περιμένω να γίνει το playing μέσα σε 5 sec
        success = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('⏳ Χρονικό όριο έληξε χωρίς αναπαραγωγή.');
            resolve(false);
          }, 5000);

          videoPlayer.addEventListener('playing', function handler() {
            clearTimeout(timeout);
            videoPlayer.removeEventListener('playing', handler);
            console.log('🎬 Video ξεκίνησε πραγματικά!');
            resolve(true);
          });

          videoPlayer.play().catch(err => {
            console.warn('⛔ Σφάλμα play():', err);
            clearTimeout(timeout);
            resolve(false);
          });
        });
      }
    }

    if (!success) console.warn('⛔ Απέτυχε ο player:', player);
    return success;
  } catch (e) {
    console.error('⛔ Σφάλμα σε safeTryPlay:', e);
    return false;
  }
};





async function playStream(initialURL, subtitleURL = null) {
  console.log('🚀 Ξεκινάω αναπαραγωγή:', initialURL);

  const videoPlayer = document.getElementById('video-player');
  const iframePlayer = document.getElementById('iframe-player');
  const clapprDiv = document.getElementById('clappr-player');
  const subtitleTrack = document.getElementById('subtitle-track');

  // Καθαρίζω όλους τους players
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

  let streamURL = initialURL;

  // Αν υπάρχει Cache
  const cached = streamPerfMap[initialURL];
  if (cached) {
    console.log(`📦 Υπάρχει cache: Προσπαθώ πρώτα με ${cached.player}`);
    const ok = await safeTryPlay(cached.proxy, cached.player);
    if (ok) {
      console.log('✅ Παίχτηκε από cache!');
      return;
    } else {
      console.warn('🔄 Cache λάθος, σβήνω και ξαναπροσπαθώ από την αρχή.');
      delete streamPerfMap[initialURL];
    }
  }

  // Αν είναι STRM
  if (isSTRM(streamURL)) {
    const resolved = await resolveSTRM(streamURL);
    if (resolved) streamURL = resolved;
    else return;
  }

  // Αν είναι iframe
  if (isIframeStream(streamURL)) {
    const directM3u8 = await findM3U8inIframe(streamURL, proxyList);
    if (directM3u8) {
      streamURL = directM3u8;
    } else {
      await safeTryPlay(null, 'iframe');
      logStreamUsage(initialURL, initialURL, 'iframe');
      return;
    }
  }

  // Proxy Try
  const workingURL = await autoProxyFetch(streamURL);
  if (!workingURL) {
    console.error('❌ Καμία proxy δεν λειτούργησε.');
    return;
  }

  streamURL = workingURL;
  let playerUsed = '';
  let proxyUsed = workingURL !== initialURL ? workingURL.replace(initialURL, '') : '';

  const streamType = detectStreamType(streamURL);

  console.log(`🔎 Stream Type αναγνωρίστηκε: ${streamType}`);

  // ΔΟΚΙΜΕΣ παικτών
  const playerTrials = [];

  if (streamType === 'hls') {
    playerTrials.push(['hls.js', null]);
    playerTrials.push(['native-hls', null]);
    playerTrials.push(['clappr', null]);
  } else if (streamType === 'dash') {
    playerTrials.push(['dash.js', null]);
    playerTrials.push(['clappr', null]);
  } else if (streamType === 'mp4' || streamType === 'webm') {
    playerTrials.push(['native-mp4', null]);
    playerTrials.push(['clappr', null]);
  } else if (streamType === 'ts') {
    // .ts streams θα φορτώνονται στο player.html μέσω iframe
    iframePlayer.style.display = 'block';
    iframePlayer.src = `player.html?url=${encodeURIComponent(streamURL)}`;
    playerUsed = 'iframe';
    logStreamUsage(initialURL, streamURL, playerUsed);
    console.log('✅ TS stream παίζει μέσω player.html');
    return;
  } else {
    playerTrials.push(['clappr', null]);
  }

  let success = false;
  for (let [player, proxy] of playerTrials) {
    success = await safeTryPlay(proxy, player);
    if (success) {
      playerUsed = player;
      break;
    }
  }

  if (success) {
    console.log(`✅ Βρέθηκε λειτουργικός player: ${playerUsed}`);
    logStreamUsage(initialURL, streamURL, playerUsed);
  } else {
    console.error('❌ Καμία μέθοδος δεν λειτούργησε.');
  }
}









function logStreamUsage(initialUrl, finalUrl, playerUsed) {
  const now = new Date().toISOString();
  const proxyUsed = finalUrl !== initialUrl ? finalUrl.replace(initialUrl, '') : '';

  if (!globalStreamCache[initialUrl]) {
    globalStreamCache[initialUrl] = {
      timestamp: now,
      proxy: proxyUsed,
      player: playerUsed
    };
    console.log('📦 Καταγραφή στο globalStreamCache:', initialUrl, globalStreamCache[initialUrl]);
  }
}


const CACHE_UPLOAD_URL = 'https://yellow-hulking-guan.glitch.me/update-cache';
let lastSentCache = {};

// Συγκρίνει αν υπάρχουν νέες εγγραφές
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

// Στέλνει το cache στον Glitch Server
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








// Funktion zum Lesen der SRT-Datei und Anzeigen der griechischen Untertitel
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

// Funktion zum Konvertieren von SRT in VTT
function convertSrtToVtt(srtContent) {
    // SRT-Untertitelzeilen in VTT-Format konvertieren
    const vttContent = 'WEBVTT\n\n' + srtContent
        // Ersetze Trennzeichen
        .replace(/\r\n|\r|\n/g, '\n')
        // Ersetze Zeitformate von SRT in VTT
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');

    return vttContent;
}






// foothubhd-Wetter
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



// Funktion zum Laden der Playlist-URLs aus playlist-urls.txt und Aktualisieren der Sidebar
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

                            // Αφαίρεσε την .active από όλες τις άλλες
                            document.querySelectorAll('#playlist-url-list a').forEach(a => a.classList.remove('active'));
                            // Πρόσθεσε .active στο τρέχον
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


// Event-Listener für den Klick auf den Playlist-URLs-Titel
document.addEventListener('DOMContentLoaded', function() {
    const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
    if (playlistUrlsTitle) {
        playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
    } else {
        console.error('Element für den Klick-Event-Listener wurde nicht gefunden.');
    }
});




function hasStreamCacheChanged() {
  return JSON.stringify(globalStreamCache) !== JSON.stringify(lastSentCache);
}

function sendStreamCacheToServer() {
  if (!hasStreamCacheChanged()) {
    console.log('📭 Καμία αλλαγή στο cache, δεν έγινε αποστολή.');
    return;
  }

  fetch('https://yellow-hulking-guan.glitch.me/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(globalStreamCache)
  })
  .then(res => {
    if (res.ok) {
      console.log('✅ Αποστολή cache στο Glitch επιτυχής.');
      lastSentCache = JSON.parse(JSON.stringify(globalStreamCache)); // βαθύ αντίγραφο
    } else {
      console.error('❌ Σφάλμα κατά την αποστολή στο Glitch:', res.status);
    }
  })
  .catch(err => {
    console.error('⚠️ Σφάλμα σύνδεσης με το Glitch server:', err);
  });
}



// Ο ενιαίος και σωστός DOMContentLoaded block με όλα τα event listeners
document.addEventListener('DOMContentLoaded', function () {
  // 🔄 Φόρτωση proxy-map.json
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
      const streamURL = channelInfo.dataset.stream;
      const channelId = channelInfo.dataset.channelId;
      const programInfo = getCurrentProgram(channelId);

      setCurrentChannel(channelInfo.querySelector('.sender-name').textContent, streamURL);
      playStream(streamURL);

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

  // Φίλτρο μόνο Online
  const filterOnlineButton = document.getElementById('filter-online-button');
  filterOnlineButton.addEventListener('click', function () {
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => {
      const channelInfo = item.querySelector('.channel-info');
      item.style.display = (channelInfo && channelInfo.classList.contains('online')) ? '' : 'none';
    });
  });

  // Εμφάνιση Όλων
  const showAllButton = document.getElementById('show-all-button');
  showAllButton.addEventListener('click', function () {
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => item.style.display = '');
  });

  // Playlist-URLs φορτώνουν όταν κάνεις κλικ στο playlist-urls panel
  const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
  if (playlistUrlsTitle) {
    playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
  }
});
