// ==================== 1. ΚΟΙΝΕΣ ΜΕΤΑΒΛΗΤΕΣ & INIT ====================
let clapprPlayer = null;
let epgData = {};
const proxyUsageCache = new Set();
const proxyList = [
  '',
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

// ==================== 2. ΡΟΛΟΓΙ & ΗΜΕΡΟΜΗΝΙΑ ====================
function updateClock() {
  const now = new Date();
  document.getElementById('tag').textContent = now.toLocaleDateString('el-GR', { weekday: 'long' });
  document.getElementById('datum').textContent = now.toLocaleDateString('el-GR');
  document.getElementById('uhrzeit').textContent = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}

// ==================== 3. ΛΕΙΤΟΥΡΓΙΕΣ PLAYLIST ====================
async function fetchResource(url) {
  for (const proxy of proxyList) {
    try {
      const proxyUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
      const response = await fetch(proxyUrl);
      if (response.ok) return await response.text();
    } catch (e) {
      console.warn(`Proxy ${proxy} failed:`, e);
    }
  }
  throw new Error('All proxies failed');
}

function updateSidebarFromM3U(data) {
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.innerHTML = '';
  const lines = data.split('\n');
  let currentChannel = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
      currentChannel = {
        id: line.match(/tvg-id="([^"]+)"/)?.[1],
        name: line.split(/,(.*)$/)[1]?.trim(),
        logo: line.match(/tvg-logo="([^"]+)"/)?.[1] || 'default.png',
        url: null
      };
    } 
    else if (line.startsWith('http') && currentChannel.name) {
      currentChannel.url = line;
      createChannelElement(currentChannel);
      currentChannel = {};
    }
  }
  checkStreamStatus();
}

function createChannelElement(channel) {
  const li = document.createElement('li');
  li.innerHTML = `
    <div class="channel-info" data-stream="${channel.url}" data-channel-id="${channel.id}">
      <div class="logo-container">
        <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='default.png'">
      </div>
      <span class="sender-name">${channel.name}</span>
      <span class="epg-channel">
        <span>Loading...</span>
        <div class="epg-timeline">
          <div class="epg-past" style="width: 0%"></div>
          <div class="epg-future" style="width: 100%"></div>
        </div>
      </span>
    </div>
  `;
  document.getElementById('sidebar-list').appendChild(li);
}

// ==================== 4. PLAYER ΛΕΙΤΟΥΡΓΙΕΣ ====================
function playStreamFromInput() {
  const url = document.getElementById('stream-url').value;
  if (url) playStream(url);
}

async function playStream(url) {
  console.log("Attempting to play:", url);
  const videoPlayer = document.getElementById('video-player');
  const iframePlayer = document.getElementById('iframe-player');
  const clapprDiv = document.getElementById('clappr-player');

  // Reset players
  if (clapprPlayer) clapprPlayer.destroy();
  videoPlayer.src = '';
  iframePlayer.src = '';
  [videoPlayer, iframePlayer, clapprDiv].forEach(el => el.style.display = 'none');

  try {
    // Try HTML5 video first
    if (/\.(mp4|webm)$/i.test(url)) {
      videoPlayer.src = url;
      videoPlayer.style.display = 'block';
      await videoPlayer.play();
      return;
    }

    // Try HLS.js
    if (Hls.isSupported() && /\.m3u8$/i.test(url)) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(videoPlayer);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoPlayer.style.display = 'block';
        videoPlayer.play();
      });
      return;
    }

    // Fallback to iframe for embeds
    if (/embed|youtube|\.php|\.html/i.test(url)) {
      iframePlayer.src = url.includes('?') ? `${url}&autoplay=1` : `${url}?autoplay=1`;
      iframePlayer.style.display = 'block';
      return;
    }

    // Ultimate fallback: Clappr
    clapprDiv.style.display = 'block';
    clapprPlayer = new Clappr.Player({
      source: url,
      parentId: '#clappr-player',
      autoPlay: true,
      width: '100%',
      height: '100%'
    });

  } catch (error) {
    console.error("Playback failed:", error);
    alert(`Αδυναμία αναπαραγωγής: ${error.message}`);
  }
}

// ==================== 5. EPG ΛΕΙΤΟΥΡΓΙΕΣ ====================
async function loadEPGData() {
  try {
    const response = await fetch('https://ext.greektv.app/epg/epg.xml');
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    epgData = {};
    Array.from(xmlDoc.getElementsByTagName('programme')).forEach(prog => {
      const channelId = prog.getAttribute('channel');
      if (!epgData[channelId]) epgData[channelId] = [];
      
      epgData[channelId].push({
        start: parseEPGTime(prog.getAttribute('start')),
        stop: parseEPGTime(prog.getAttribute('stop')),
        title: prog.getElementsByTagName('title')[0]?.textContent || 'Χωρίς τίτλο',
        desc: prog.getElementsByTagName('desc')[0]?.textContent || 'Χωρίς περιγραφή'
      });
    });
    updateEPGDisplay();
  } catch (error) {
    console.error("EPG error:", error);
  }
}

function parseEPGTime(epgTime) {
  if (!epgTime || epgTime.length < 14) return null;
  const dateStr = `${epgTime.substr(0,4)}-${epgTime.substr(4,2)}-${epgTime.substr(6,2)}`;
  const timeStr = `${epgTime.substr(8,2)}:${epgTime.substr(10,2)}`;
  return new Date(`${dateStr}T${timeStr}:00`);
}

// ==================== 6. ΑΘΛΗΤΙΚΕΣ ΜΕΤΑΔΟΣΕΙΣ ====================
async function loadSportPlaylist() {
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.innerHTML = '<li>Φόρτωση αγώνων...</li>';

  try {
    const proxyUrl = 'https://cors-anywhere-production-d9b6.up.railway.app/';
    const response = await fetch(`${proxyUrl}https://foothubhd.online/program.txt`);
    const text = await response.text();
    
    sidebarList.innerHTML = '';
    const lines = text.split('\n');
    let currentDate = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check for date line
      const dateMatch = trimmed.match(/ΠΡΟΓΡΑΜΜΑ\s+(\w+)\s+(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        currentDate = `${dateMatch[2]}/${dateMatch[3]}/${dateMatch[4]}`;
        return;
      }

      // Parse game info
      const gameMatch = trimmed.match(/(\d{2}:\d{2})\s+(.+?)(?:\s+\/|$)/);
      if (gameMatch && currentDate) {
        const [_, time, teams] = gameMatch;
        const links = [...trimmed.matchAll(/https?:\/\/[^\s]+/g)].map(m => m[0]);
        
        if (links.length > 0) {
          const li = document.createElement('li');
          li.innerHTML = `
            <div class="sport-event" data-time="${time}" data-date="${currentDate}">
              <span class="event-time">${adjustHourForGermany(time)}</span>
              <span class="event-teams">${teams}</span>
              <div class="event-links">
                ${links.map((link, i) => 
                  `<a href="#" class="stream-link" data-url="${link}">Link ${i+1}</a>`
                ).join('')}
              </div>
            </div>
          `;
          sidebarList.appendChild(li);
        }
      }
    });

  } catch (error) {
    console.error("Sports error:", error);
    sidebarList.innerHTML = '<li style="color:red;">Σφάλμα φόρτωσης αγώνων</li>';
  }
}

// ==================== 7. INIT & EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize
  updateClock();
  setInterval(updateClock, 60000);
  loadEPGData();
  setInterval(updateEPGDisplay, 30000);

  // Button events
  document.getElementById('myPlaylist').addEventListener('click', loadMyPlaylist);
  document.getElementById('externalPlaylist').addEventListener('click', loadExternalPlaylist);
  document.getElementById('sportPlaylist').addEventListener('click', loadSportPlaylist);
  document.getElementById('play-button').addEventListener('click', playStreamFromInput);
  document.getElementById('stream-url').addEventListener('keypress', e => {
    if (e.key === 'Enter') playStreamFromInput();
  });

  // Sidebar events
  document.getElementById('sidebar-list').addEventListener('click', e => {
    const channelEl = e.target.closest('.channel-info');
    const streamLink = e.target.closest('.stream-link');
    
    if (channelEl) {
      setCurrentChannel(
        channelEl.querySelector('.sender-name').textContent, 
        channelEl.dataset.stream
      );
      playStream(channelEl.dataset.stream);
    }
    
    if (streamLink) {
      e.preventDefault();
      playStream(streamLink.dataset.url);
    }
  });
});

// ==================== 8. ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ====================
function adjustHourForGermany(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return `${(h - 1 + 24) % 24}:${m.toString().padStart(2, '0')}`;
}

function checkStreamStatus() {
  document.querySelectorAll('.channel-info').forEach(channel => {
    fetch(channel.dataset.stream, { method: 'HEAD' })
      .then(res => {
        channel.classList.toggle('online', res.ok);
      })
      .catch(() => channel.classList.remove('online'));
  });
}

// ==================== 9.1 ΣΥΝΑΡΤΗΣΗ ΓΙΑ ΤΑ SUBTITLES ====================
function handleSubtitleFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const srtContent = e.target.result;
    const vttContent = convertSrtToVtt(srtContent);
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    
    const track = document.getElementById('subtitle-track');
    if (track) {
      track.src = url;
      track.label = 'Ελληνικά';
      track.srclang = 'el';
      track.default = true;
    }
  };
  reader.readAsText(file);
}

function convertSrtToVtt(srtText) {
  return 'WEBVTT\n\n' + srtText
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

// ==================== 9.2 ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ΤΟ PLAYLIST URLs ====================
function loadPlaylistUrls() {
  fetch('playlist-urls.txt')
    .then(response => response.text())
    .then(data => {
      const playlistList = document.getElementById('playlist-url-list');
      playlistList.innerHTML = '';
      
      data.split('\n').forEach(line => {
        const [label, url] = line.split(',').map(item => item.trim());
        if (label && url) {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = '#';
          a.textContent = label;
          a.onclick = () => {
            document.getElementById('stream-url').value = url;
            fetchResource(url)
              .then(data => updateSidebarFromM3U(data))
              .catch(console.error);
          };
          li.appendChild(a);
          playlistList.appendChild(li);
        }
      });
    })
    .catch(error => {
      console.error('Error loading playlist URLs:', error);
      document.getElementById('playlist-url-list').innerHTML = 
        '<li style="color:red;">Σφάλμα φόρτωσης λίστας</li>';
    });
}

// ==================== 9.3 ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ΤΟ FILTERING ====================
function filterOnlineChannels() {
  const items = document.querySelectorAll('#sidebar-list li');
  items.forEach(item => {
    item.style.display = item.querySelector('.online') ? '' : 'none';
  });
}

function showAllChannels() {
  document.querySelectorAll('#sidebar-list li').forEach(item => {
    item.style.display = '';
  });
}

function searchChannels() {
  const query = document.getElementById('search-input').value.toLowerCase();
  document.querySelectorAll('#sidebar-list li').forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(query) ? '' : 'none';
  });
}

// ==================== 9.4 ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ΤΟ PROXY CACHE ====================
function logProxyUrl(url) {
  proxyUsageCache.add(url);
  console.log('Proxy cache updated:', Array.from(proxyUsageCache));
}

function exportProxyCache() {
  const data = JSON.stringify(Array.from(proxyUsageCache), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'proxy_cache.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== 10.1 INIT EVENT LISTENERS ====================
function initializeEventListeners() {
  // Subtitle handling
  document.getElementById('subtitle-file').addEventListener('change', (e) => {
    if (e.target.files[0]) handleSubtitleFile(e.target.files[0]);
  });

  // Filter buttons
  document.getElementById('filter-online-button').addEventListener('click', filterOnlineChannels);
  document.getElementById('show-all-button').addEventListener('click', showAllChannels);
  document.getElementById('search-input').addEventListener('input', searchChannels);

  // Playlist URLs section
  document.querySelector('.content-title[onclick*="playlist-urls"]').addEventListener('click', loadPlaylistUrls);

  // Proxy cache export
  document.getElementById('export-cache-button').addEventListener('click', exportProxyCache);

  // Copy/Paste buttons
  document.getElementById('copy-button').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('stream-url').value);
  });

  document.getElementById('clear-button').addEventListener('click', () => {
    document.getElementById('stream-url').value = '';
  });
}

// ==================== 10.2 MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 60000);
  
  loadEPGData();
  setInterval(updateEPGDisplay, 30000);
  
  initializeEventListeners();
  
  // Optional: Auto-load first playlist
  loadMyPlaylist();
});

