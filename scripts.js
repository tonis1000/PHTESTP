// 1. Διαχείριση Δεδομένων και Cache
//  Αποθήκευση και Διαχείριση Stream Cache

let globalStreamCache = {};
let lastSentCache = {};
const CACHE_UPLOAD_URL = 'https://yellow-hulking-guan.glitch.me/update-cache';

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

// Έλεγχος αλλαγών στο cache
function hasStreamCacheChanged() {
  return JSON.stringify(globalStreamCache) !== JSON.stringify(lastSentCache);
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

// Απλούστερη έκδοση αποστολής cache στον server
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



// 2. Διαχείριση και Εμφάνιση EPG (Electronic Program Guide)

let epgData = {};

// Φόρτωση δεδομένων EPG
function loadEPGData() {
  fetch('epg-data.json')
    .then(response => response.json())
    .then(data => {
      epgData = data;
      console.log('EPG δεδομένα φορτώθηκαν επιτυχώς');
    })
    .catch(error => {
      console.error('Σφάλμα κατά τη φόρτωση EPG δεδομένων:', error);
    });
}

// Λήψη τρέχοντος προγράμματος για ένα κανάλι
function getCurrentProgram(channelId) {
  if (!epgData[channelId]) {
    return { title: 'Μη διαθέσιμες πληροφορίες προγράμματος', description: '' };
  }

  const now = new Date();
  const programs = epgData[channelId];
  
  for (const program of programs) {
    const startTime = new Date(program.startTime);
    const endTime = new Date(program.endTime);
    
    if (now >= startTime && now < endTime) {
      return program;
    }
  }
  
  return { title: 'Μη διαθέσιμες πληροφορίες προγράμματος', description: '' };
}

// Ενημέρωση πληροφοριών επόμενων προγραμμάτων
function updateNextPrograms(channelId) {
  const nextProgramsList = document.getElementById('next-programs');
  nextProgramsList.innerHTML = '';
  
  if (!epgData[channelId]) {
    const li = document.createElement('li');
    li.textContent = 'Δεν υπάρχουν διαθέσιμες πληροφορίες προγράμματος';
    nextProgramsList.appendChild(li);
    return;
  }
  
  const now = new Date();
  const programs = epgData[channelId];
  let futurePrograms = programs.filter(program => new Date(program.startTime) > now);
  futurePrograms = futurePrograms.slice(0, 3); // Εμφάνιση μόνο των επόμενων 3 προγραμμάτων
  
  for (const program of futurePrograms) {
    const li = document.createElement('li');
    const startTime = new Date(program.startTime);
    li.innerHTML = `<strong>${startTime.getHours()}:${startTime.getMinutes().toString().padStart(2, '0')}</strong>: ${program.title}`;
    nextProgramsList.appendChild(li);
  }
  
  if (futurePrograms.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Δεν υπάρχουν επόμενα προγράμματα για σήμερα';
    nextProgramsList.appendChild(li);
  }
}


// 3. Διαχείριση Ροών Multimedia και Player
//  Βασικές Λειτουργίες Αναπαραγωγής

let streamPerfMap = {}; // Χάρτης απόδοσης streams (proxy-player map)
let videoPlayer = null;
let hls = null;
let currentStream = '';

// Αρχικοποίηση του player
function initPlayer() {
  if (videoPlayer) {
    videoPlayer.dispose();
  }
  videoPlayer = videojs('my-video', {
    controls: true,
    autoplay: true,
    preload: 'auto',
    fluid: true,
    html5: {
      hls: {
        enableLowInitialPlaylist: true,
        limitRenditionByPlayerDimensions: true,
        smoothQualityChange: true,
        overrideNative: true
      }
    }
  });
  
  videoPlayer.on('error', function() {
    console.error('Player error:', videoPlayer.error());
    handlePlayerError();
  });
}

// Αναπαραγωγή μιας ροής
function playStream(streamURL, subtitleUrl = null) {
  currentStream = streamURL;
  
  if (!videoPlayer) {
    initPlayer();
  }

  if (hls) {
    hls.destroy();
  }

  console.log('Attempting to play stream:', streamURL);
  
  if (streamURL.includes('.m3u8')) {
    if (Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 10000,
        fragLoadingTimeOut: 20000
      });
      
      hls.loadSource(streamURL);
      hls.attachMedia(document.getElementById('my-video'));
      
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        videoPlayer.play().catch(error => {
          console.error('Play failed:', error);
          handlePlayerError();
        });
      });
      
      hls.on(Hls.Events.ERROR, function(event, data) {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error, trying to recover');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error, trying to recover');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, cannot recover');
              handlePlayerError();
              break;
          }
        }
      });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      videoPlayer.src({
        src: streamURL,
        type: 'application/vnd.apple.mpegurl'
      });
      videoPlayer.play().catch(error => {
        console.error('Play failed:', error);
        handlePlayerError();
      });
    }
  } else {
    videoPlayer.src({
      src: streamURL,
      type: 'video/mp4'
    });
    videoPlayer.play().catch(error => {
      console.error('Play failed:', error);
      handlePlayerError();
    });
  }
  
  // Προσθήκη υποτίτλων αν έχουν παρασχεθεί
  if (subtitleUrl) {
    addSubtitles(subtitleUrl);
  }
  
  updateStreamCache(streamURL);
}

// Διαχείριση σφάλματος player
function handlePlayerError() {
  const streamURL = currentStream;
  const streamInfo = findStreamInfo(streamURL);
  
  if (streamInfo && streamPerfMap[streamURL]) {
    const alternatives = streamPerfMap[streamURL];
    if (alternatives && alternatives.length > 0) {
      console.log('Trying alternative stream:', alternatives[0]);
      playStream(alternatives[0]);
    } else {
      console.error('No alternatives available for this stream');
      displayErrorMessage('Το stream δεν είναι διαθέσιμο αυτή τη στιγμή.');
    }
  } else {
    console.error('Stream not found in performance map');
    displayErrorMessage('Το stream δεν είναι διαθέσιμο αυτή τη στιγμή.');
  }
}

// Προσθήκη υποτίτλων
function addSubtitles(subtitleUrl) {
  const tracks = videoPlayer.textTracks();
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].kind === 'subtitles') {
      videoPlayer.removeRemoteTextTrack(tracks[i]);
    }
  }
  
  const subtitleTrack = videoPlayer.addRemoteTextTrack({
    kind: 'subtitles',
    srclang: 'el',
    label: 'Ελληνικά',
    src: subtitleUrl
  }, false);
  
  subtitleTrack.mode = 'showing';
}

// Ενημέρωση περιγραφής player
function updatePlayerDescription(title, description) {
  const titleElement = document.getElementById('current-program-title');
  const descriptionElement = document.getElementById('current-program-description');
  
  if (titleElement) {
    titleElement.textContent = title || 'Μη διαθέσιμος τίτλος';
  }
  
  if (descriptionElement) {
    descriptionElement.textContent = description || 'Μη διαθέσιμη περιγραφή';
  }
}

// Ορισμός τρέχοντος καναλιού
function setCurrentChannel(channelName, streamURL) {
  const currentChannelElement = document.getElementById('current-channel');
  if (currentChannelElement) {
    currentChannelElement.textContent = channelName;
  }
  document.getElementById('stream-url').value = streamURL;
}


// 4. Χειρισμός υποτίτλων

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




// 5. Έλεγχος κατάστασης streams

function checkStreamStatus() {
  const channelInfos = document.querySelectorAll('.channel-info');
  
  channelInfos.forEach(channelInfo => {
    const streamURL = channelInfo.dataset.stream;
    
    fetch(streamURL, { method: 'HEAD', timeout: 5000 })
      .then(response => {
        if (response.ok) {
          channelInfo.classList.add('online');
          channelInfo.classList.remove('offline');
        } else {
          channelInfo.classList.add('offline');
          channelInfo.classList.remove('online');
        }
      })
      .catch(() => {
        channelInfo.classList.add('offline');
        channelInfo.classList.remove('online');
      });
  });
}


// 6. Ενημέρωση του cache για το stream

function updateStreamCache(streamURL) {
  if (!streamURL) return;
  
  // Ενημέρωση του cache με τα νέα δεδομένα
  const timestamp = new Date().toISOString();
  let proxy = 'default';
  let player = 'default';
  
  // Έλεγχος αν υπάρχει καταχώρηση proxy-player για αυτό το stream
  if (streamPerfMap[streamURL]) {
    proxy = streamPerfMap[streamURL].proxy || 'default';
    player = streamPerfMap[streamURL].player || 'default';
  }
  
  // Καταχώρηση στο globalStreamCache
  globalStreamCache[streamURL] = {
    timestamp,
    proxy,
    player
  };
  
  // Στείλε το ενημερωμένο cache στον server
  sendGlobalCacheIfUpdated();
}


// 7. Διαχείριση Διεπαφής Χρήστη και Αλληλεπίδραση / Λειτουργίες Πλοήγησης UI

// foothubhd-Wetter - Εναλλαγή περιεχομένου
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

// Ενημέρωση ρολογιού
function updateClock() {
  const now = new Date();
  const clockElement = document.getElementById('clock');
  if (clockElement) {
    clockElement.textContent = now.toLocaleTimeString();
  }
}

// Εμφάνιση μηνύματος σφάλματος
function displayErrorMessage(message) {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Απόκρυψη μετά από 5 δευτερόλεπτα
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}


// 8. Φόρτωση λίστας αναπαραγωγής από M3U

function loadPlaylistFromM3U(url, title) {
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Netzwerkantwort war nicht ok.');
      return response.text();
    })
    .then(data => {
      console.log('Daten erfolgreich geladen. Verarbeite M3U-Daten.');
      updateSidebarFromM3U(data);
      if (title) {
        const currentPlaylistTitle = document.getElementById('current-playlist-title');
        if (currentPlaylistTitle) {
          currentPlaylistTitle.textContent = title;
        }
      }
    })
    .catch(error => {
      console.error('Fehler beim Laden der Playlist:', error);
      alert('Fehler beim Laden der Playlist. Siehe Konsole für Details.');
    });
}

// Ενημέρωση της sidebar από M3U δεδομένα
function updateSidebarFromM3U(m3uContent) {
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.innerHTML = '';

  const lines = m3uContent.split('\n');
  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      // Γραμμή πληροφοριών καναλιού
      const channelInfo = parseExtinfLine(line);
      currentChannel = {
        title: channelInfo.title,
        group: channelInfo.group,
        logo: channelInfo.logo
      };
    } else if (line && !line.startsWith('#') && currentChannel) {
      // URL του καναλιού
      const channelURL = line;
      addChannelToSidebar(currentChannel.title, channelURL, currentChannel.logo, currentChannel.group);
      currentChannel = null;
    }
  }
  
  // Έλεγχος κατάστασης των streams
  checkStreamStatus();
}

// Ανάλυση γραμμής EXTINF
function parseExtinfLine(line) {
  const result = {
    title: 'Unknown Channel',
    group: '',
    logo: ''
  };
  
  // Εξαγωγή τίτλου
  const titleMatch = line.match(/,(.+)$/);
  if (titleMatch && titleMatch[1]) {
    result.title = titleMatch[1].trim();
  }
  
  // Εξαγωγή ομάδας
  const groupMatch = line.match(/group-title="([^"]+)"/);
  if (groupMatch && groupMatch[1]) {
    result.group = groupMatch[1];
  }
  
  // Εξαγωγή λογότυπου
  const logoMatch = line.match(/tvg-logo="([^"]+)"/);
  if (logoMatch && logoMatch[1]) {
    result.logo = logoMatch[1];
  }
  
  return result;
}

// Προσθήκη καναλιού στη sidebar
function addChannelToSidebar(title, url, logo, group) {
  const sidebarList = document.getElementById('sidebar-list');
  
  // Δημιουργία στοιχείου λίστας
  const li = document.createElement('li');
  
  // Δημιουργία του container πληροφοριών καναλιού
  const channelInfo = document.createElement('div');
  channelInfo.className = 'channel-info';
  channelInfo.dataset.stream = url;
  channelInfo.dataset.channelId = encodeURIComponent(title);
  
  // Προσθήκη λογότυπου
  const logoContainer = document.createElement('div');
  logoContainer.className = 'logo-container';
  const logoImg = document.createElement('img');
  logoImg.src = logo || 'placeholder.png';
  logoImg.alt = title;
  logoContainer.appendChild(logoImg);
  
  // Προσθήκη ονόματος καναλιού
  const nameSpan = document.createElement('span');
  nameSpan.className = 'sender-name';
  nameSpan.textContent = title;
  
  // Δημιουργία container για την ομάδα (αν υπάρχει)
  if (group) {
    const groupSpan = document.createElement('span');
    groupSpan.className = 'group-info';
    groupSpan.textContent = group;
    channelInfo.appendChild(groupSpan);
  }
  
  // Συναρμολόγηση του channel-info
  channelInfo.appendChild(logoContainer);
  channelInfo.appendChild(nameSpan);
  
  // Προσθήκη channel-info στο στοιχείο λίστας
  li.appendChild(channelInfo);
  
  // Προσθήκη στη sidebar
  sidebarList.appendChild(li);
}

// Φόρτωση "Η λίστα μου"
function loadMyPlaylist() {
  loadPlaylistFromM3U('my-playlist.m3u', 'Η λίστα μου');
}

// Φόρτωση εξωτερικής λίστας
function loadExternalPlaylist() {
  loadPlaylistFromM3U('external-playlist.m3u', 'Εξωτερική λίστα');
}

// Φόρτωση αθλητικής λίστας
function loadSportPlaylist() {
  loadPlaylistFromM3U('sport-playlist.m3u', 'Αθλητικά');
}

// Φόρτωση λιστών αναπαραγωγής από playlist-urls.txt
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


// 9. Ο ενιαίος και σωστός DOMContentLoaded block με όλα τα event listeners

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
  } else {
    console.error('Element für den Klick-Event-Listener wurde nicht gefunden.');
  }
});



// 10. Βοηθητικές Λειτουργίες και Χρησιμότητες
//   Βοηθητικές Λειτουργίες για το UI

// Βοηθητική συνάρτηση για εύρεση πληροφοριών ροής
function findStreamInfo(streamURL) {
  if (!streamURL) return null;
  
  const channelInfos = document.querySelectorAll('.channel-info');
  for (const info of channelInfos) {
    if (info.dataset.stream === streamURL) {
      return {
        title: info.querySelector('.sender-name').textContent,
        logo: info.querySelector('.logo-container img').src,
        channelId: info.dataset.channelId
      };
    }
  }
  
  return null;
}

// Χειρισμός σημείων αλλαγής του player
function handlePlayerSizeChange() {
  const playerContainer = document.getElementById('player-container');
  const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
  
  if (isFullscreen) {
    playerContainer.classList.add('fullscreen-mode');
  } else {
    playerContainer.classList.remove('fullscreen-mode');
  }
  
  // Ρύθμιση του player για τη νέα διάσταση
  if (videoPlayer) {
    videoPlayer.dimensions(
      playerContainer.clientWidth,
      playerContainer.clientHeight
    );
  }
}
