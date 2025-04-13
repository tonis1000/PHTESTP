// 🔹 1. ΦΟΡΤΩΣΗ PLAYLISTS 🔹
// Περιλαμβάνει: Τοπική playlist.m3u, Εξωτερική από GitHub, Sport προγράμματα & Δυναμικά URLs

// ✅ Φόρτωση της προσωπικής τοπικής Playlist (playlist.m3u)
function loadMyPlaylist() {
    fetch('playlist.m3u')
        .then(response => response.text())
        .then(data => updateSidebarFromM3U(data))
        .catch(error => console.error('Σφάλμα κατά τη φόρτωση της τοπικής playlist:', error));
}

// ✅ Φόρτωση εξωτερικής M3U playlist από GitHub
function loadExternalPlaylist() {
    fetch('https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR')
        .then(response => response.text())
        .then(data => updateSidebarFromM3U(data))
        .catch(error => console.error('Σφάλμα κατά τη φόρτωση της εξωτερικής playlist:', error));
}

// ✅ Φόρτωση Sport Events από txt αρχείο (σειρά, ώρα, link)
async function loadSportPlaylist() {
    const sidebarList = document.getElementById('sidebar-list');
    sidebarList.innerHTML = '';

    try {
        const response = await fetch('https://tonis1000.github.io/PHTESTP/sport-program.txt');
        if (!response.ok) throw new Error('Αποτυχία στη φόρτωση του sport προγράμματος');
        const lines = (await response.text()).split('\n');

        let currentDate = '';
        let matchesForDay = [];

        const flushDay = () => {
            if (!currentDate || !matchesForDay.length) return;

            // Εισαγωγή τίτλου για την ημερομηνία
            const header = document.createElement('li');
            header.textContent = `--- ${currentDate.toUpperCase()} ---`;
            header.style.fontWeight = 'bold';
            header.style.color = '#ff4d4d';
            sidebarList.appendChild(header);

            // Ταξινόμηση και εμφάνιση αγώνων
            matchesForDay.sort((a, b) => a.time.localeCompare(b.time));
            matchesForDay.forEach(match => {
                const li = document.createElement('li');
                li.style.marginBottom = '8px';

                const title = document.createElement('div');
                title.textContent = `${match.time} ${match.title}`;
                title.style.color = 'white';

                const linksDiv = document.createElement('div');
                match.links.forEach((link, i) => {
                    const a = document.createElement('a');
                    a.textContent = `[Link${i + 1}]`;
                    a.href = '#';
                    a.style.marginRight = '6px';

                    if (isLiveGame(match.time)) {
                        a.style.color = 'limegreen';
                        a.style.fontWeight = 'bold';
                    }

                    a.addEventListener('click', e => {
                        e.preventDefault();
                        document.getElementById('stream-url').value = link;
                        playStream(link);
                    });

                    linksDiv.appendChild(a);
                });

                li.appendChild(title);
                li.appendChild(linksDiv);
                sidebarList.appendChild(li);
            });

            matchesForDay = [];
        };

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            const dateMatch = line.match(/ΠΡΟΓΡΑΜΜΑ\s+([Α-Ωα-ωA-Za-z]+\s+\d{1,2}\/\d{1,2}\/\d{4})/);
            if (dateMatch) {
                flushDay();
                currentDate = dateMatch[1];
                continue;
            }

            const gameMatches = [...line.matchAll(/(\d{1,2}:\d{2})\s+([^\/\n]+?)(?=\s*(\/|https?:\/\/|$))/g)];
            const linkMatches = [...line.matchAll(/https?:\/\/[^\s]+/g)].map(m => m[0]);

            if (gameMatches.length && linkMatches.length) {
                gameMatches.forEach(game => {
                    matchesForDay.push({
                        time: adjustHourForGermany(game[1]),
                        title: game[2].trim(),
                        links: linkMatches
                    });
                });
            }
        }

        flushDay();

    } catch (error) {
        console.error('Σφάλμα στη φόρτωση Sport προγράμματος:', error);
    }
}

// ✅ Επιστροφή ώρας -1 για να συγχρονιστεί με ώρα Γερμανίας
function adjustHourForGermany(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    h = (h - 1 + 24) % 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ✅ Έλεγχος αν ο αγώνας είναι live (±10 έως +130 λεπτά από ώρα έναρξης)
function isLiveGame(timeStr) {
    const now = new Date();
    const [h, m] = timeStr.split(':').map(Number);
    const gameTime = new Date(now);
    gameTime.setHours(h, m, 0, 0);
    const diffMin = (now - gameTime) / 60000;
    return diffMin >= -10 && diffMin <= 130;
}



// 🔹 2. ΑΝΑΠΑΡΑΓΩΓΗ ΡΟΗΣ 🔹
// Περιλαμβάνει: Αυτόματη αναγνώριση format (m3u8, mp4, iframe), proxy fallback, υπότιτλοι, Clappr

// ✅ Λίστα με proxy URLs για παράκαμψη CORS/403
const proxyList = [
  '', // απευθείας
  'https://tonis-proxy.onrender.com/',
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

// ✅ Έλεγχος αν η URL είναι αναπαραγώγιμη
function isPlayableFormat(url) {
  return /\.(m3u8|ts|mp4|mpd|webm)$/i.test(url);
}

// ✅ Αναζήτηση Proxy που επιτρέπει πρόσβαση (HEAD/GET)
async function autoProxyFetch(url) {
  for (let proxy of proxyList) {
    const testUrl = proxy.endsWith('=') ? proxy + encodeURIComponent(url) : proxy + url;
    try {
      let res = await fetch(testUrl, { method: 'HEAD', mode: 'cors' });
      if (res.status === 403) {
        res = await fetch(testUrl, { method: 'GET', mode: 'cors' });
      }
      if (res.ok) return testUrl;
    } catch (e) {
      console.warn('Αποτυχία proxy:', proxy);
    }
  }
  return null;
}

// ✅ Κεντρική συνάρτηση για αναπαραγωγή stream
async function playStream(streamURL, subtitleURL = null) {
  const videoPlayer = document.getElementById('video-player');
  const iframePlayer = document.getElementById('iframe-player');
  const clapprDiv = document.getElementById('clappr-player');
  const subtitleTrack = document.getElementById('subtitle-track');

  // Επαναφορά όλων
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  videoPlayer.load();
  iframePlayer.src = '';
  clapprDiv.style.display = 'none';
  if (clapprPlayer) clapprPlayer.destroy();

  // ➕ Αν είναι embed (π.χ. .php ή iframe link)
  const isIframe = streamURL.includes('embed') || streamURL.endsWith('.php') || streamURL.endsWith('.html');

  if (isIframe) {
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

    if (foundStream) {
      streamURL = foundStream;
    } else {
      // Fallback σε iframe
      videoPlayer.style.display = 'none';
      iframePlayer.style.display = 'block';
      if (!streamURL.includes('autoplay')) {
        streamURL += (streamURL.includes('?') ? '&' : '?') + 'autoplay=1';
      }
      iframePlayer.src = streamURL;
      return;
    }
  }

  // ✅ Αν είναι m3u8/mp4 κλπ, κάνε proxy fetch
  if (isPlayableFormat(streamURL)) {
    const workingUrl = await autoProxyFetch(streamURL);
    if (!workingUrl) console.warn('Κανένα proxy δεν δούλεψε. Χρήση αρχικού:', streamURL);
    streamURL = workingUrl || streamURL;
  }

  // ✅ Ρύθμιση υπότιτλων αν υπάρχει αρχείο
  if (subtitleURL) {
    subtitleTrack.src = subtitleURL;
    subtitleTrack.track.mode = 'showing';
  } else {
    subtitleTrack.src = '';
    subtitleTrack.track.mode = 'hidden';
  }

  // ✅ Προσπάθεια αναπαραγωγής με HLS.js
  if (Hls.isSupported() && streamURL.endsWith('.m3u8')) {
    try {
      const hls = new Hls();
      hls.loadSource(streamURL);
      hls.attachMedia(videoPlayer);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play());
      videoPlayer.style.display = 'block';
      return;
    } catch (e) {}
  }

  // ✅ Native HLS (π.χ. Safari)
  if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
    videoPlayer.src = streamURL;
    videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
    videoPlayer.style.display = 'block';
    return;
  }

  // ✅ DASH (.mpd αρχεία)
  if (streamURL.endsWith('.mpd')) {
    try {
      const dashPlayer = dashjs.MediaPlayer().create();
      dashPlayer.initialize(videoPlayer, streamURL, true);
      videoPlayer.style.display = 'block';
      return;
    } catch (e) {}
  }

  // ✅ Άμεσο mp4/webm stream
  if (videoPlayer.canPlayType('video/mp4') || videoPlayer.canPlayType('video/webm')) {
    videoPlayer.src = streamURL;
    videoPlayer.play();
    videoPlayer.style.display = 'block';
    return;
  }

  // ✅ Fallback σε Clappr player (universal)
  videoPlayer.style.display = 'none';
  iframePlayer.style.display = 'none';
  clapprDiv.style.display = 'block';

  clapprPlayer = new Clappr.Player({
    source: streamURL,
    parentId: '#clappr-player',
    autoPlay: true,
    width: '100%',
    height: '100%',
  });
}



// 🔹 3. ΗΛΕΚΤΡΟΝΙΚΟΣ ΟΔΗΓΟΣ ΠΡΟΓΡΑΜΜΑΤΟΣ (EPG) 🔹
// Περιλαμβάνει: Ανάγνωση XML, ζωντανό πρόγραμμα, επόμενα, περιγραφή, progress bar

// ✅ Γενική αποθήκευση όλων των δεδομένων EPG ανά κανάλι
let epgData = {};

// ✅ Φόρτωση EPG XML αρχείου και μετατροπή του σε JSON-like αντικείμενο
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
                    const desc = descElement ? descElement.textContent : 'Χωρίς περιγραφή';
                    if (!epgData[channelId]) epgData[channelId] = [];
                    epgData[channelId].push({
                        start: parseDateTime(start),
                        stop: parseDateTime(stop),
                        title: title,
                        desc: desc
                    });
                }
            });
        })
        .catch(error => console.error('Σφάλμα φόρτωσης EPG XML:', error));
}

// ✅ Μετατροπή συμβολοσειράς EPG σε Date object
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
    return new Date(Date.UTC(year, month, day, hour - tzHour, minute - tzMin, second));
}

// ✅ Εύρεση του τρέχοντος προγράμματος για ένα κανάλι
function getCurrentProgram(channelId) {
    const now = new Date();
    if (epgData[channelId]) {
        const prog = epgData[channelId].find(p => now >= p.start && now < p.stop);
        if (prog) {
            const past = now - prog.start;
            const total = prog.stop - prog.start;
            const percent = (past / total) * 100;

            return {
                title: `${cleanTitle(prog.title)} (${formatTime(prog.start)} - ${formatTime(prog.stop)})`,
                description: prog.desc || 'Χωρίς περιγραφή',
                pastPercentage: percent,
                futurePercentage: 100 - percent
            };
        }
    }
    return {
        title: 'Δεν υπάρχει τρέχον πρόγραμμα',
        description: 'Χωρίς περιγραφή',
        pastPercentage: 0,
        futurePercentage: 0
    };
}

// ✅ Καθαρισμός τίτλου από περιττά (π.χ. [HD])
function cleanTitle(title) {
    return title.replace(/\s*\[.*?\]\s*/g, '').replace(/[\[\]]/g, '');
}

// ✅ Μορφοποίηση ώρας (00:00)
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ✅ Ενημέρωση του player με τίτλο + περιγραφή
function updatePlayerDescription(title, description) {
    document.getElementById('program-title').textContent = title;
    document.getElementById('program-desc').textContent = description;
}

// ✅ Προβολή των επόμενων 4 προγραμμάτων για ένα κανάλι
function updateNextPrograms(channelId) {
    const container = document.getElementById('next-programs');
    container.innerHTML = '';

    if (epgData[channelId]) {
        const now = new Date();
        const upcoming = epgData[channelId].filter(p => p.start > now).slice(0, 4);

        upcoming.forEach(program => {
            const div = document.createElement('div');
            div.classList.add('next-program');

            const title = document.createElement('h4');
            title.classList.add('next-program-title');
            title.textContent = `${cleanTitle(program.title)} (${formatTime(program.start)} - ${formatTime(program.stop)})`;

            const desc = document.createElement('p');
            desc.classList.add('next-program-desc');
            desc.textContent = program.desc || 'Χωρίς περιγραφή';
            desc.style.display = 'none';

            title.addEventListener('click', () => {
                desc.style.display = desc.style.display === 'none' ? 'block' : 'none';
                updatePlayerDescription(title.textContent, desc.textContent);
            });

            div.appendChild(title);
            div.appendChild(desc);
            container.appendChild(div);
        });
    }
}



// 🔹 4. UI: ΠΛΗΚΤΡΑ, SIDEBAR, ΛΟΓΟΤΥΠΑ, ΕΝΗΜΕΡΩΣΗ 🔹
// Περιλαμβάνει: Click events σε λίστα καναλιών, copy/clear, set current channel, player trigger

// ✅ Ενημέρωση ονόματος και stream URL για το ενεργό κανάλι
function setCurrentChannel(channelName, streamUrl) {
    const nameDisplay = document.getElementById('current-channel-name');
    const streamInput = document.getElementById('stream-url');

    nameDisplay.textContent = channelName;
    streamInput.value = streamUrl;
}

// ✅ Πλήκτρο PLAY – αναπαραγωγή URL από input
function setupPlayButton() {
    const playBtn = document.getElementById('play-button');
    const streamInput = document.getElementById('stream-url');
    const subtitleInput = document.getElementById('subtitle-file');

    const play = () => {
        const url = streamInput.value;
        const subtitle = subtitleInput.files[0];
        if (url) {
            if (subtitle) handleSubtitleFile(subtitle);
            playStream(url, subtitle ? document.getElementById('subtitle-track').src : null);
        }
    };

    playBtn.addEventListener('click', play);
    streamInput.addEventListener('keydown', (e) => e.key === 'Enter' && play());
}

// ✅ Πλήκτρο CLEAR – καθαρίζει το input
function setupClearButton() {
    document.getElementById('clear-button').addEventListener('click', () => {
        document.getElementById('stream-url').value = '';
    });
}

// ✅ Πλήκτρο COPY – αντιγραφή URL στο clipboard
function setupCopyButton() {
    document.getElementById('copy-button').addEventListener('click', () => {
        const input = document.getElementById('stream-url');
        input.select();
        document.execCommand('copy');
    });
}

// ✅ Sidebar click: όταν επιλεγεί κανάλι από λίστα
function setupSidebarClick() {
    const sidebarList = document.getElementById('sidebar-list');

    sidebarList.addEventListener('click', (event) => {
        const channelInfo = event.target.closest('.channel-info');
        if (!channelInfo) return;

        const stream = channelInfo.dataset.stream;
        const channelId = channelInfo.dataset.channelId;
        const name = channelInfo.querySelector('.sender-name').textContent;
        const logo = channelInfo.querySelector('.logo-container img')?.src;

        const program = getCurrentProgram(channelId);

        setCurrentChannel(name, stream);
        playStream(stream);
        updatePlayerDescription(program.title, program.description);
        updateNextPrograms(channelId);

        if (logo) {
            document.getElementById('current-channel-logo').src = logo;
        }
    });
}


// ✅ Ενεργοποίηση όλων των UI components μετά τη φόρτωση της σελίδας
document.addEventListener('DOMContentLoaded', () => {
    setupPlayButton();
    setupClearButton();
    setupCopyButton();
    setupSidebarClick();

    // Φόρτωση EPG στην αρχή
    loadEPGData();

    // Ενημέρωση ρολογιού κάθε 1 δευτερόλεπτο
    updateClock();
    setInterval(updateClock, 1000);

    // Κουμπιά Playlist
    document.getElementById('myPlaylist')?.addEventListener('click', loadMyPlaylist);
    document.getElementById('externalPlaylist')?.addEventListener('click', loadExternalPlaylist);
    document.getElementById('sportPlaylist')?.addEventListener('click', loadSportPlaylist);
});



// 🔹 5. ΦΙΛΤΡΑ, ONLINE STATUS, STREAM CHECK 🔹
// Περιλαμβάνει: Έλεγχο κατάστασης URLs, εμφάνιση μόνο ενεργών, αναζήτηση + Enter για αυτόματη αναπαραγωγή

// ✅ Έλεγχος κάθε stream URL για διαθεσιμότητα και επισήμανση στο sidebar
function checkStreamStatus() {
    const channels = document.querySelectorAll('.channel-info');
    channels.forEach(channel => {
        const streamURL = channel.dataset.stream;
        if (!streamURL) return;

        fetch(streamURL)
            .then(response => {
                const senderName = channel.querySelector('.sender-name');
                if (response.ok) {
                    channel.classList.add('online');
                    senderName.style.color = 'lightgreen';
                    senderName.style.fontWeight = 'bold';
                } else {
                    channel.classList.remove('online');
                    senderName.style.color = '';
                    senderName.style.fontWeight = '';
                }
            })
            .catch(() => {
                channel.classList.remove('online');
                const senderName = channel.querySelector('.sender-name');
                senderName.style.color = '';
                senderName.style.fontWeight = '';
            });
    });
}

// ✅ Φίλτρο: Εμφανίζει ΜΟΝΟ τα ενεργά (online) κανάλια
function setupFilterOnlineButton() {
    const filterBtn = document.getElementById('filter-online-button');
    if (!filterBtn) return;

    filterBtn.addEventListener('click', () => {
        const items = document.querySelectorAll('#sidebar-list li');
        items.forEach(item => {
            const channel = item.querySelector('.channel-info');
            item.style.display = channel && channel.classList.contains('online') ? '' : 'none';
        });
    });
}

// ✅ Πλήκτρο "Εμφάνισε Όλα" – Επαναφέρει τη λίστα
function setupShowAllButton() {
    const showAllBtn = document.getElementById('show-all-button');
    if (!showAllBtn) return;

    showAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#sidebar-list li').forEach(item => {
            item.style.display = '';
        });
    });
}

// ✅ Αναζήτηση καναλιών με Enter για αυτόματη αναπαραγωγή του πρώτου αποτελέσματος
function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const items = document.querySelectorAll('#sidebar-list li');

        items.forEach(item => {
            const text = item.textContent || item.innerText;
            item.style.display = text.toLowerCase().includes(query) ? '' : 'none';
        });
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const visible = Array.from(document.querySelectorAll('#sidebar-list li'))
                .find(item => item.style.display !== 'none');

            const streamURL = visible?.querySelector('.channel-info')?.dataset?.stream;
            if (streamURL) playStream(streamURL);
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // ...προηγούμενα setup (play/copy/clear/sidebar)...

    // ✅ Εκκίνηση ελέγχου κατάστασης κάθε 60s
    checkStreamStatus();
    setInterval(checkStreamStatus, 60000);

    // ✅ Φίλτρα και αναζήτηση
    setupFilterOnlineButton();
    setupShowAllButton();
    setupSearchInput();
});



// 🔹 6. ΥΠΟΤΙΤΛΟΙ: SRT → VTT 🔹
// Επιτρέπει την επιλογή αρχείου .srt, μετατροπή σε .vtt και προβολή με τον HTML5 player

// ✅ Ανάγνωση αρχείου SRT και μετατροπή σε προσωρινό VTT blob για αναπαραγωγή
function handleSubtitleFile(file) {
    const reader = new FileReader();

    reader.onload = function (event) {
        const srtContent = event.target.result;
        const vttContent = convertSrtToVtt(srtContent);

        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);

        const track = document.getElementById('subtitle-track');
        track.src = url;
        track.label = 'Ελληνικά';
        track.srclang = 'el';
        track.default = true;
        track.track.mode = 'showing';
    };

    reader.readAsText(file);
}

// ✅ Μετατροπή SRT format σε VTT format για υποστήριξη από HTML5 player
function convertSrtToVtt(srtContent) {
    const vttHeader = 'WEBVTT\n\n';

    return vttHeader + srtContent
        .replace(/\r\n|\r|\n/g, '\n') // Ομοιομορφία στα newlines
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4'); // Μετατροπή χρόνων SRT → VTT
}


document.addEventListener('DOMContentLoaded', () => {
    const subtitleInput = document.getElementById('subtitle-file');
    const streamInput = document.getElementById('stream-url');
    const playBtn = document.getElementById('play-button');

    const playWithSubtitles = () => {
        const streamUrl = streamInput.value;
        const subtitleFile = subtitleInput.files[0];
        if (streamUrl) {
            if (subtitleFile) handleSubtitleFile(subtitleFile);
            playStream(streamUrl, subtitleFile ? document.getElementById('subtitle-track').src : null);
        }
    };

    playBtn.addEventListener('click', playWithSubtitles);
    streamInput.addEventListener('keydown', e => e.key === 'Enter' && playWithSubtitles());

    subtitleInput.addEventListener('change', (e) => {
        const subtitleFile = e.target.files[0];
        if (subtitleFile) handleSubtitleFile(subtitleFile);
    });
});



// 🔹 7. ΡΟΛΟΪ & ΗΜΕΡΟΜΗΝΙΑ 🔹
// Ζωντανή ενημέρωση ώρας, ημέρας και ημερομηνίας στην UI εμφάνιση

function updateClock() {
    const now = new Date();

    // ✅ Επιστροφή ημέρας της εβδομάδας στα ελληνικά
    const day = now.toLocaleDateString('el-GR', { weekday: 'long' });

    // ✅ Μορφοποιημένη ημερομηνία
    const date = now.toLocaleDateString('el-GR');

    // ✅ Ώρα σε 24ωρη μορφή (π.χ. 13:42:05)
    const time = now.toLocaleTimeString('el-GR', { hour12: false });

    // ✅ Ενημέρωση των κατάλληλων HTML στοιχείων
    document.getElementById('tag').textContent = day;
    document.getElementById('datum').textContent = date;
    document.getElementById('uhrzeit').textContent = time;
}


document.addEventListener('DOMContentLoaded', () => {
    updateClock();               // Εκκίνηση άμεσα
    setInterval(updateClock, 1000); // Επανάληψη κάθε 1000ms (1 sec)
});






