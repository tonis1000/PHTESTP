// scripts.js - Τελική Ελληνική Έκδοση ✅

// =========================================================
// 1. ΦΟΡΤΩΣΗ PLAYLISTS (Τοπική, Εξωτερική, Sport)
// =========================================================

function loadMyPlaylist() {
    fetch('playlist.m3u')
        .then(res => res.text())
        .then(updateSidebarFromM3U)
        .catch(err => console.error('Σφάλμα playlist.m3u:', err));
}

function loadExternalPlaylist() {
    fetch('https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR')
        .then(res => res.text())
        .then(updateSidebarFromM3U)
        .catch(err => console.error('Σφάλμα εξωτερικής playlist:', err));
}

async function loadSportPlaylist() {
    const sidebarList = document.getElementById('sidebar-list');
    sidebarList.innerHTML = '';
    try {
        const response = await fetch('https://tonis1000.github.io/PHTESTP/sport-program.txt');
        if (!response.ok) throw new Error('Σφάλμα sport txt');
        const lines = (await response.text()).split('\n');

        let currentDate = '';
        let matchesForDay = [];

        const flushDay = () => {
            if (!currentDate || !matchesForDay.length) return;
            const header = document.createElement('li');
            header.textContent = `--- ${currentDate.toUpperCase()} ---`;
            header.style.fontWeight = 'bold';
            header.style.color = '#ff4d4d';
            sidebarList.appendChild(header);

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
    } catch (err) {
        console.error('Σφάλμα sport:', err);
    }
}

function adjustHourForGermany(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    h = (h - 1 + 24) % 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function isLiveGame(timeStr) {
    const now = new Date();
    const [h, m] = timeStr.split(':').map(Number);
    const gameTime = new Date(now);
    gameTime.setHours(h, m, 0, 0);
    const diffMin = (now - gameTime) / 60000;
    return diffMin >= -10 && diffMin <= 130;
}

// =========================================================
// 2. ΑΝΑΠΑΡΑΓΩΓΗ ΡΟΗΣ (Streams) + Proxy Υποστήριξη
// =========================================================

const proxyList = [
  '',
  'https://tonis-proxy.onrender.com/',
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

let clapprPlayer = null;

function isPlayableFormat(url) {
  return /\.(m3u8|ts|mp4|mpd|webm)$/i.test(url);
}

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
      console.warn('Proxy failed:', proxy);
    }
  }
  return null;
}

async function playStream(streamURL, subtitleURL = null) {
  const videoPlayer = document.getElementById('video-player');
  const iframePlayer = document.getElementById('iframe-player');
  const clapprDiv = document.getElementById('clappr-player');
  const subtitleTrack = document.getElementById('subtitle-track');

  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  videoPlayer.load();
  iframePlayer.src = '';
  clapprDiv.style.display = 'none';
  if (clapprPlayer) clapprPlayer.destroy();

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
      videoPlayer.style.display = 'none';
      iframePlayer.style.display = 'block';
      if (!streamURL.includes('autoplay')) {
        streamURL += (streamURL.includes('?') ? '&' : '?') + 'autoplay=1';
      }
      iframePlayer.src = streamURL;
      return;
    }
  }

  if (isPlayableFormat(streamURL)) {
    const workingUrl = await autoProxyFetch(streamURL);
    if (!workingUrl) console.warn('No proxy succeeded. Using original:', streamURL);
    streamURL = workingUrl || streamURL;
  }

  if (subtitleURL) {
    subtitleTrack.src = subtitleURL;
    subtitleTrack.track.mode = 'showing';
  } else {
    subtitleTrack.src = '';
    subtitleTrack.track.mode = 'hidden';
  }

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

  if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
    videoPlayer.src = streamURL;
    videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
    videoPlayer.style.display = 'block';
    return;
  }

  if (streamURL.endsWith('.mpd')) {
    try {
      const dashPlayer = dashjs.MediaPlayer().create();
      dashPlayer.initialize(videoPlayer, streamURL, true);
      videoPlayer.style.display = 'block';
      return;
    } catch (e) {}
  }

  if (videoPlayer.canPlayType('video/mp4') || videoPlayer.canPlayType('video/webm')) {
    videoPlayer.src = streamURL;
    videoPlayer.play();
    videoPlayer.style.display = 'block';
    return;
  }

  videoPlayer.style.display = 'none';
  iframePlayer.style.display = 'none';
  clapprDiv.style.display = 'block';

  clapprPlayer = new Clappr.Player({
    source: streamURL,
    parentId: '#clappr-player',
    autoPlay: true,
    width: '100%',
    height: '100%'
  });
}

// =========================================================
// 3. ΗΛΕΚΤΡΟΝΙΚΟΣ ΟΔΗΓΟΣ ΠΡΟΓΡΑΜΜΑΤΟΣ (EPG)
// =========================================================

let epgData = {};

function loadEPGData() {
  fetch('https://ext.greektv.app/epg/epg.xml')
    .then(res => res.text())
    .then(data => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'application/xml');
      const programmes = xmlDoc.getElementsByTagName('programme');

      Array.from(programmes).forEach(prog => {
        const channelId = prog.getAttribute('channel');
        const start = prog.getAttribute('start');
        const stop = prog.getAttribute('stop');
        const title = prog.getElementsByTagName('title')[0]?.textContent || '';
        const desc = prog.getElementsByTagName('desc')[0]?.textContent || 'Χωρίς περιγραφή';

        if (!epgData[channelId]) epgData[channelId] = [];
        epgData[channelId].push({
          start: parseDateTime(start),
          stop: parseDateTime(stop),
          title,
          desc
        });
      });
    })
    .catch(err => console.error('Σφάλμα EPG:', err));
}

function parseDateTime(epgTime) {
  const year = parseInt(epgTime.substring(0, 4));
  const month = parseInt(epgTime.substring(4, 6)) - 1;
  const day = parseInt(epgTime.substring(6, 8));
  const hour = parseInt(epgTime.substring(8, 10));
  const min = parseInt(epgTime.substring(10, 12));
  const sec = parseInt(epgTime.substring(12, 14));
  const offsetSign = epgTime[14] === '+' ? 1 : -1;
  const offsetHour = parseInt(epgTime.substring(15, 17));
  const offsetMin = parseInt(epgTime.substring(17, 19));
  return new Date(Date.UTC(year, month, day, hour - offsetSign * offsetHour, min - offsetSign * offsetMin, sec));
}

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
        description: prog.desc,
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

function cleanTitle(title) {
  return title.replace(/\s*\[.*?\]\s*/g, '').replace(/[\[\]]/g, '');
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updatePlayerDescription(title, description) {
  document.getElementById('program-title').textContent = title;
  document.getElementById('program-desc').textContent = description;
}

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
      desc.textContent = program.desc;
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

// =========================================================
// 4. UI: ΠΛΗΚΤΡΑ, SIDEBAR, ΛΟΓΟΤΥΠΑ, ΕΝΗΜΕΡΩΣΗ
// =========================================================

function setCurrentChannel(channelName, streamUrl) {
  document.getElementById('current-channel-name').textContent = channelName;
  document.getElementById('stream-url').value = streamUrl;
}

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

function setupClearButton() {
  document.getElementById('clear-button').addEventListener('click', () => {
    document.getElementById('stream-url').value = '';
  });
}

function setupCopyButton() {
  document.getElementById('copy-button').addEventListener('click', () => {
    const input = document.getElementById('stream-url');
    input.select();
    document.execCommand('copy');
  });
}

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

document.addEventListener('DOMContentLoaded', () => {
  setupPlayButton();
  setupClearButton();
  setupCopyButton();
  setupSidebarClick();

  loadEPGData();
  updateClock();
  setInterval(updateClock, 1000);

  document.getElementById('myPlaylist')?.addEventListener('click', loadMyPlaylist);
  document.getElementById('externalPlaylist')?.addEventListener('click', loadExternalPlaylist);
  document.getElementById('sportPlaylist')?.addEventListener('click', loadSportPlaylist);
});

// =========================================================
// 5. ΦΙΛΤΡΑ, ONLINE STATUS, STREAM CHECK
// =========================================================

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

function setupShowAllButton() {
  const showAllBtn = document.getElementById('show-all-button');
  if (!showAllBtn) return;

  showAllBtn.addEventListener('click', () => {
    document.querySelectorAll('#sidebar-list li').forEach(item => {
      item.style.display = '';
    });
  });
}

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
  checkStreamStatus();
  setInterval(checkStreamStatus, 60000);

  setupFilterOnlineButton();
  setupShowAllButton();
  setupSearchInput();
});

// =========================================================
// 6. ΥΠΟΤΙΤΛΟΙ: SRT → VTT
// =========================================================

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

function convertSrtToVtt(srtContent) {
  const vttHeader = 'WEBVTT\n\n';
  return vttHeader + srtContent
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
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

// =========================================================
// 7. ΡΟΛΟΪ & ΗΜΕΡΟΜΗΝΙΑ
// =========================================================

function updateClock() {
  const now = new Date();
  const day = now.toLocaleDateString('el-GR', { weekday: 'long' });
  const date = now.toLocaleDateString('el-GR');
  const time = now.toLocaleTimeString('el-GR', { hour12: false });

  document.getElementById('tag').textContent = day;
  document.getElementById('datum').textContent = date;
  document.getElementById('uhrzeit').textContent = time;
}

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
});
