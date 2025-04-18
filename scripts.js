
const globalStreamCache = {}; // Κεντρική μνήμη για όλα τα stream URLs

let streamPerfMap = {};
fetch('https://tonis1000.github.io/PHTESTP/proxy-map.json')
  .then(res => res.json())
  .then(data => {
    streamPerfMap = data;
    console.log('🔁 Proxy-Player Map geladen:', streamPerfMap);
  });





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

  const gameDate = new Date(year, month - 1, day, h, m);
  const now = new Date();

  const isSameDay = gameDate.getDate() === now.getDate() &&
                    gameDate.getMonth() === now.getMonth() &&
                    gameDate.getFullYear() === now.getFullYear();

  const diffMin = (now - gameDate) / 60000;
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
              document.getElementById('current-channel-name').textContent = match.title;
              document.getElementById('current-channel-logo').src = '';
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
    await sendGlobalCacheIfUpdated();
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



// Im Event-Handler für den Klick auf einen Sender
const sidebarList = document.getElementById('sidebar-list');
sidebarList.addEventListener('click', function (event) {
    const channelInfo = event.target.closest('.channel-info');
    if (channelInfo) {
        const channelId = channelInfo.dataset.channelId;
        const programInfo = getCurrentProgram(channelId);

        // Aktualisiert den Player mit der aktuellen Sendung
        setCurrentChannel(channelInfo.querySelector('.sender-name').textContent, channelInfo.dataset.stream);
        playStream(channelInfo.dataset.stream);

        // Aktualisiert die Programmbeschreibung
        updatePlayerDescription(programInfo.title, programInfo.description);

        // Aktualisiert die nächsten Programme
        updateNextPrograms(channelId);

        // Zeigt das Logo des ausgewählten Senders an
        const logoContainer = document.getElementById('current-channel-logo');
        const logoImg = channelInfo.querySelector('.logo-container img').src;
        logoContainer.src = logoImg;
    }
});





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


// filter-online-button
document.addEventListener('DOMContentLoaded', function () {
    const filterOnlineButton = document.getElementById('filter-online-button');

    filterOnlineButton.addEventListener('click', function () {
        const items = document.querySelectorAll('#sidebar-list li');
        items.forEach(item => {
            const channelInfo = item.querySelector('.channel-info');
            if (channelInfo && channelInfo.classList.contains('online')) {
                item.style.display = ''; // Zeige online Sender
            } else {
                item.style.display = 'none'; // Verstecke nicht-online Sender
            }
        });
    });
});

// Deine bestehende checkStreamStatus-Funktion bleibt unverändert.


// Ereignisbehandler für Klicks auf Sender
document.addEventListener('DOMContentLoaded', function () {

  // 🔄 Φόρτωση proxy-map.json
  fetch('https://tonis1000.github.io/PHTESTP/proxy-map.json')
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

            // Aktualisieren der Programmbeschreibung
            updatePlayerDescription(programInfo.title, programInfo.description);
        }
    });

    setInterval(checkStreamStatus, 60000);

    const playButton = document.getElementById('play-button');
    const streamUrlInput = document.getElementById('stream-url');

    const playStreamFromInput = () => {
        const streamUrl = streamUrlInput.value;
        if (streamUrl) {
            playStream(streamUrl);
        }
    };

    playButton.addEventListener('click', playStreamFromInput);

    streamUrlInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            playStreamFromInput();
        }
    });
});



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
  '',
  'https://water-instinctive-peach.glitch.me/',  
  'https://tonis-proxy.onrender.com/',
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

let clapprPlayer = null;

function isIframeStream(url) {
  return /embed|\.php$|\.html$/i.test(url);
}

function isDirectStream(url) {
  return /\.(m3u8|ts|mp4|mpd|webm)$/i.test(url);
}

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
    return null;
  }
}

async function autoProxyFetch(url) {
  for (let proxy of proxyList) {
    const testUrl = proxy.endsWith('=') ? proxy + encodeURIComponent(url) : proxy + url;
    try {
      let res = await fetch(testUrl, { method: 'HEAD', mode: 'cors' });
      if (res.status === 403 || res.status === 405) {
        res = await fetch(testUrl, { method: 'GET', mode: 'cors' });
      }
      if (res.ok) return testUrl;
    } catch (e) {
      console.warn('Proxy failed:', proxy);
    }
  }
  return null;
}





async function playStream(initialURL, subtitleURL = null) {
  const videoPlayer = document.getElementById('video-player');
  const iframePlayer = document.getElementById('iframe-player');
  const clapprDiv = document.getElementById('clappr-player');
  const subtitleTrack = document.getElementById('subtitle-track');

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

  // STRM υποστήριξη
  if (isSTRM(streamURL)) {
    const resolved = await resolveSTRM(streamURL);
    if (resolved) streamURL = resolved;
    else return;
  }

  // 👉 Αν υπάρχει καταγεγραμμένος player για αυτό το URL
  if (streamPerfMap[initialURL]) {
    const cached = streamPerfMap[initialURL];
    if (cached.player === 'iframe') {
      document.getElementById('current-channel-logo').src = '';
      const nameEl = document.getElementById('current-channel-name');
      if (nameEl && (!nameEl.textContent || nameEl.textContent.includes('Fallback'))) {
        nameEl.textContent = 'Αγώνας (Iframe Fallback)';
      }
      iframePlayer.style.display = 'block';
      iframePlayer.src = initialURL.includes('autoplay') ? initialURL : initialURL + (initialURL.includes('?') ? '&' : '?') + 'autoplay=1';
      return;
    } else if (cached.player === 'clappr') {
      clapprDiv.style.display = 'block';
      clapprPlayer = new Clappr.Player({
        source: initialURL,
        parentId: '#clappr-player',
        autoPlay: true,
        width: '100%',
        height: '100%'
      });
      return;
    }
  }

  // Iframe ανίχνευση
  if (isIframeStream(streamURL)) {
    let foundStream = null;
    for (let proxy of proxyList) {
      const proxied = proxy.endsWith('=') ? proxy + encodeURIComponent(streamURL) : proxy + streamURL;
      try {
        const res = await fetch(proxied);
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8)/);
          if (match) {
            foundStream = match[1];
            break;
          }
        }
      } catch (e) {}
    }

    if (!foundStream) {
      document.getElementById('current-channel-logo').src = '';
      const nameEl = document.getElementById('current-channel-name');
      if (nameEl && (!nameEl.textContent || nameEl.textContent.includes('Fallback'))) {
        nameEl.textContent = 'Αγώνας (Iframe Fallback)';
      }
      iframePlayer.style.display = 'block';
      iframePlayer.src = streamURL.includes('autoplay') ? streamURL : streamURL + (streamURL.includes('?') ? '&' : '?') + 'autoplay=1';

      logStreamUsage(initialURL, streamURL, 'iframe');
      return;
    }

    streamURL = foundStream;
  }

  const forceClappr = streamURL.includes('norhrgr.top') || streamURL.endsWith('.ts');

  // ➤ Αν υπάρχει cached proxy, χρησιμοποιήσέ τον
  if (!forceClappr) {
    if (streamPerfMap[initialURL] && streamPerfMap[initialURL].proxy) {
      const direct = streamPerfMap[initialURL].proxy.endsWith('=') ?
        streamPerfMap[initialURL].proxy + encodeURIComponent(initialURL) :
        streamPerfMap[initialURL].proxy + initialURL;
      streamURL = direct;
      console.log('⚡ Χρήση cached proxy:', direct);
    } else {
      const workingUrl = await autoProxyFetch(streamURL);
      if (workingUrl) streamURL = workingUrl;
    }
  }

  const showVideoPlayer = () => {
    videoPlayer.style.display = 'block';
    if (subtitleURL) {
      subtitleTrack.src = subtitleURL;
      subtitleTrack.track.mode = 'showing';
    }
  };

  try {
    if (!forceClappr && Hls.isSupported() && streamURL.endsWith('.m3u8')) {
      const hls = new Hls();
      hls.loadSource(streamURL);
      hls.attachMedia(videoPlayer);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play());
      showVideoPlayer();

      logStreamUsage(initialURL, streamURL, 'hls.js');
      return;
    } else if (!forceClappr && videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      videoPlayer.src = streamURL;
      videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
      showVideoPlayer();

      logStreamUsage(initialURL, streamURL, 'native-hls');
      return;
    } else if (!forceClappr && streamURL.endsWith('.mpd')) {
      const dashPlayer = dashjs.MediaPlayer().create();
      dashPlayer.initialize(videoPlayer, streamURL, true);
      showVideoPlayer();

      logStreamUsage(initialURL, streamURL, 'dash.js');
      return;
    } else if (!forceClappr && (videoPlayer.canPlayType('video/mp4') || videoPlayer.canPlayType('video/webm'))) {
      videoPlayer.src = streamURL;
      videoPlayer.play();
      showVideoPlayer();

      logStreamUsage(initialURL, streamURL, 'native-mp4');
      return;
    }
  } catch (e) {
    console.warn('Fallback to Clappr due to error:', e);
  }

  clapprDiv.style.display = 'block';
  clapprPlayer = new Clappr.Player({
    source: streamURL,
    parentId: '#clappr-player',
    autoPlay: true,
    width: '100%',
    height: '100%'
  });

  logStreamUsage(initialURL, streamURL, 'clappr');
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
async function sendGlobalCacheIfUpdated() {
  if (hasNewEntries(globalStreamCache, lastSentCache)) {
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
      } else {
        console.warn('❌ Αποτυχία αποστολής στο API:', await response.text());
      }
    } catch (err) {
      console.error('🚫 Σφάλμα κατά την αποστολή στο Glitch API:', err);
    }
  } else {
    console.log('⏸️ Καμία αλλαγή, δεν στάλθηκε τίποτα στο Glitch.');
  }
}

// ⏱️ Χρονιστής ανά 15 λεπτά
setInterval(sendGlobalCacheIfUpdated, 15 * 60 * 1000);





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



        // Event-Listener für den Play-Button und Datei-Eingabe
        document.addEventListener('DOMContentLoaded', function () {
            const playButton = document.getElementById('play-button');
            const streamUrlInput = document.getElementById('stream-url');
            const subtitleFileInput = document.getElementById('subtitle-file');

            const playStreamFromInput = () => {
                const streamUrl = streamUrlInput.value;
                const subtitleFile = subtitleFileInput.files[0];
                if (streamUrl) {
                    if (subtitleFile) {
                        handleSubtitleFile(subtitleFile);
                    }
                    playStream(streamUrl, subtitleFile ? document.getElementById('subtitle-track').src : null);
                }
            };

            playButton.addEventListener('click', playStreamFromInput);

            streamUrlInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    playStreamFromInput();
                }
            });

            subtitleFileInput.addEventListener('change', (event) => {
                const subtitleFile = event.target.files[0];
                if (subtitleFile) {
                    handleSubtitleFile(subtitleFile);
                }
            });
        });




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
            if (!response.ok) {
                throw new Error('Netzwerkantwort war nicht ok.');
            }
            return response.text();
        })
        .then(data => {
            const playlistList = document.getElementById('playlist-url-list');
            playlistList.innerHTML = ''; // Leert die Liste, um neue Einträge hinzuzufügen

            const lines = data.split('\n');
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const [label, url] = trimmedLine.split(',').map(part => part.trim());

                    if (label && url) {
                        const li = document.createElement('li');
                        const link = document.createElement('a');
                        link.textContent = label;
                        link.href = '#'; // Verhindert, dass der Link die Seite neu lädt
                        link.addEventListener('click', function(event) {
                            event.preventDefault(); // Verhindert, dass der Link die Seite neu lädt
                            document.getElementById('stream-url').value = url; // Setzt die URL in das Eingabefeld stream-url

                            // Nach dem Setzen der URL in das Eingabefeld
                            console.log('Versuche URL abzurufen:', url); // Debugging-Log
                            fetch(url)
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Netzwerkantwort war nicht ok.');
                                    }
                                    return response.text();
                                })
                                .then(data => {
                                    console.log('Daten erfolgreich geladen. Verarbeite M3U-Daten.'); // Debugging-Log
                                    updateSidebarFromM3U(data);
                                })
                                .catch(error => {
                                    console.error('Fehler beim Laden der Playlist:', error);
                                    alert('Fehler beim Laden der Playlist. Siehe Konsole für Details.'); // Optional: Benutzer informieren
                                });
                        });

                        li.appendChild(link);
                        playlistList.appendChild(li);
                    } else {
                        console.warn('Zeile hat kein Label oder keine URL:', trimmedLine); // Debugging-Log für leere Zeilen
                    }
                }
            });
        })
        .catch(error => {
            console.error('Fehler beim Laden der Playlist URLs:', error);
            alert('Fehler beim Laden der Playlist-URLs. Siehe Konsole für Details.'); // Optional: Benutzer informieren
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



document.addEventListener('DOMContentLoaded', function () {
    const filterOnlineButton = document.getElementById('filter-online-button');

    // Event-Listener für den Klick auf den Filter-Button
    filterOnlineButton.addEventListener('click', function () {
        const items = document.querySelectorAll('#sidebar-list li'); // Alle Listeneinträge in der Sidebar abrufen
        items.forEach(item => {
            const channelInfo = item.querySelector('.channel-info'); // Suche nach dem Channel-Info-Element in jedem Listeneintrag
            if (channelInfo && channelInfo.classList.contains('online')) {
                item.style.display = ''; // Zeige den Eintrag, wenn der Sender online ist
            } else {
                item.style.display = 'none'; // Verstecke den Eintrag, wenn der Sender offline ist
            }
        });
    });
});


const showAllButton = document.getElementById('show-all-button');

showAllButton.addEventListener('click', function () {
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => {
        item.style.display = ''; // Zeige alle Sender an
    });
});




// Funktion zum Filtern der Senderliste und Abspielen des ersten sichtbaren Ergebnisses bei Enter
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');

    // Event-Listener für die Eingabe im Suchfeld
    searchInput.addEventListener('input', function() {
        const filter = searchInput.value.toLowerCase();
        const sidebarList = document.getElementById('sidebar-list');
        const items = sidebarList.getElementsByTagName('li');

        let firstVisibleItem = null;

        Array.from(items).forEach(item => {
            const text = item.textContent || item.innerText;
            if (text.toLowerCase().includes(filter)) {
                item.style.display = ''; // Zeige den Eintrag
                if (!firstVisibleItem) {
                    firstVisibleItem = item; // Setze das erste sichtbare Element
                }
            } else {
                item.style.display = 'none'; // Verstecke den Eintrag
            }
        });

        // Event-Listener für die Enter-Taste
        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                if (firstVisibleItem) {
                    const streamURL = firstVisibleItem.querySelector('.channel-info').dataset.stream;
                    playStream(streamURL);
                }
            }
        });
    });
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

// 🕒 Εκτέλεση κάθε 15 λεπτά
setInterval(sendStreamCacheToServer, 15 * 60 * 1000);

