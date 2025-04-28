/**
 * ===========================================================================
 * ΔΙΑΧΕΙΡΙΣΗ GLOBAL ΜΕΤΑΒΛΗΤΩΝ ΚΑΙ ΑΡΧΙΚΕΣ ΡΥΘΜΙΣΕΙΣ
 * ===========================================================================
 */

// Γενικές μεταβλητές για διαχείριση του player και των streams
let currentChannel = null;
let player = null;
let currentStream = '';
let isStreamPlaying = false;
let forceLiveliness = false;
let globalStreamCache = {}; // Αποθηκεύει τα δεδομένα των streams
let streamPerfMap = {}; // Αποθηκεύει τον χάρτη proxy-player απόδοσης
let epgData = {}; // Αποθηκεύει τα δεδομένα του Electronic Program Guide
let currentStreamProxy = null; // Τρέχον proxy που χρησιμοποιείται

// Μεταβλητές για τη διαχείριση του cache και την αποστολή στον server
const CACHE_UPLOAD_URL = 'https://yellow-hulking-guan.glitch.me/update-cache';
let lastSentCache = {};

// Stream proxies - Λίστα με διαθέσιμα proxies για βελτιστοποίηση απόδοσης
const streamProxies = [
  "", // No proxy (direct connection)
  "https://corsproxy.io/?",
  "https://thingproxy.freeboard.io/fetch/",
  "https://api.allorigins.win/raw?url=",
  "https://cors-proxy.htmldriven.com/?url=",
  "https://crossorigin.me/"
];

/**
 * ===========================================================================
 * ΔΙΑΧΕΙΡΙΣΗ PLAYER ΚΑΙ ΑΝΑΠΑΡΑΓΩΓΗΣ STREAM
 * ===========================================================================
 */

// Δημιουργία του Hls player και αρχικοποίηση
function initPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }

  const video = document.getElementById('videoPlayer');
  player = new Hls({
    debug: false,
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 90
  });

  player.attachMedia(video);
  player.on(Hls.Events.MEDIA_ATTACHED, function() {
    console.log('Video και hls συνδέθηκαν');
  });

  player.on(Hls.Events.ERROR, function(event, data) {
    handlePlayerError(event, data);
  });

  video.addEventListener('play', function() {
    isStreamPlaying = true;
  });

  video.addEventListener('pause', function() {
    isStreamPlaying = false;
  });

  video.addEventListener('error', function(e) {
    console.error('Σφάλμα αναπαραγωγής βίντεο:', e);
  });
  
  // Αρχική φόρτωση του player με κενή λίστα αναπαραγωγής
  video.load();
}

// Αναπαραγωγή stream με δυνατότητα για υποτίτλους
function playStream(streamUrl, subtitleSrc = null) {
  if (!streamUrl) {
    console.error('Δεν παρέχθηκε URL ροής');
    return;
  }

  if (!player) {
    initPlayer();
  }

  currentStream = streamUrl;
  let processedURL = streamUrl;
  
  // Εφαρμογή του τρέχοντος proxy αν υπάρχει
  if (currentStreamProxy) {
    processedURL = currentStreamProxy + encodeURIComponent(streamUrl);
    console.log(`🔄 Χρήση proxy: ${currentStreamProxy} για stream: ${streamUrl}`);
  } else {
    console.log(`🔄 Απευθείας σύνδεση χωρίς proxy για: ${streamUrl}`);
  }

  if (streamUrl.endsWith('.m3u') || streamUrl.endsWith('.m3u8')) {
    player.loadSource(processedURL);
    player.on(Hls.Events.MANIFEST_PARSED, function() {
      document.getElementById('videoPlayer').play();
      console.log('📺 Έναρξη αναπαραγωγής του stream');
      updateStreamCache(streamUrl, true, currentStreamProxy);
    });
  } else {
    // Για non-HLS streams (π.χ. mp4, webm)
    const video = document.getElementById('videoPlayer');
    video.src = processedURL;
    video.play();
  }

  // Προσθήκη υποτίτλων αν υπάρχουν
  if (subtitleSrc) {
    const track = document.getElementById('subtitle-track');
    track.src = subtitleSrc;
  }
}

// Διαχείριση σφαλμάτων αναπαραγωγής και αλλαγή proxy αν χρειάζεται
function handlePlayerError(event, data) {
  if (data.fatal) {
    console.error(`❌ Κρίσιμο σφάλμα: ${data.type} - ${data.details}`);
    
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        // Προσπάθεια αλλαγής proxy για τη σύνδεση
        if (forceLiveliness) {
          console.log('🔄 Δοκιμή άλλου proxy λόγω σφάλματος δικτύου...');
          switchToNextProxy();
        } else {
          console.log('🔄 Προσπάθεια επαναφόρτωσης του stream...');
          player.startLoad();
        }
        updateStreamCache(currentStream, false);
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.log('🔄 Προσπάθεια ανάκτησης από σφάλμα πολυμέσων...');
        player.recoverMediaError();
        break;
      default:
        // Επανεκκίνηση του player για άλλα σφάλματα
        updateStreamCache(currentStream, false);
        initPlayer();
        playStream(currentStream);
        break;
    }
  } else {
    // Μη κρίσιμο σφάλμα - καταγραφή μόνο
    console.warn(`⚠️ Μη κρίσιμο σφάλμα: ${data.type} - ${data.details}`);
  }
}

// Εναλλαγή στο επόμενο διαθέσιμο proxy για καλύτερη απόδοση
function switchToNextProxy() {
  const currentIndex = currentStreamProxy ? streamProxies.indexOf(currentStreamProxy) : -1;
  let nextIndex = (currentIndex + 1) % streamProxies.length;
  currentStreamProxy = streamProxies[nextIndex];

  console.log(`🔄 Αλλαγή proxy σε: ${currentStreamProxy || "απευθείας σύνδεση"}`);
  
  // Επαναφόρτωση του stream με το νέο proxy
  if (currentStream) {
    playStream(currentStream);
  }
  
  // Ενημέρωση του performance map
  updateStreamPerformanceMap(currentStream, currentStreamProxy);
}

/**
 * ===========================================================================
 * ΔΙΑΧΕΙΡΙΣΗ CACHE ΚΑΙ ΑΠΟΜΑΚΡΥΣΜΕΝΟΥ SERVER
 * ===========================================================================
 */

// Ενημέρωση του cache για το τρέχον stream
function updateStreamCache(streamUrl, isWorking, proxy = currentStreamProxy) {
  if (!streamUrl) return;
  
  let playerType = "hls.js";
  if (document.getElementById('videoPlayer').tagName === 'VIDEO') {
    playerType = player ? "hls.js" : "native";
  }
  
  globalStreamCache[streamUrl] = {
    timestamp: new Date().toISOString(),
    working: isWorking,
    proxy: proxy || "",
    player: playerType
  };

  console.log(`🗃️ Ενημέρωση cache για ${streamUrl}: ${isWorking ? 'Λειτουργεί' : 'Πρόβλημα'} με ${proxy || 'χωρίς'} proxy`);
  
  // Αποστολή του ενημερωμένου cache στον server
  sendGlobalCacheIfUpdated();
}

// Έλεγχος αν υπάρχουν αλλαγές στο cache
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

// Αποστολή του cache στον Glitch Server αν έχει ενημερωθεί
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

// Έλεγχος αν έχει αλλάξει το cache από την τελευταία αποστολή
function hasStreamCacheChanged() {
  return JSON.stringify(globalStreamCache) !== JSON.stringify(lastSentCache);
}

// Αποστολή του cache στον server
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

// Ενημέρωση του χάρτη απόδοσης για τα streams και τα proxies
function updateStreamPerformanceMap(streamUrl, proxyUrl) {
  if (!streamUrl) return;
  
  if (!streamPerfMap[streamUrl]) {
    streamPerfMap[streamUrl] = {};
  }
  
  // Καταγραφή του χρησιμοποιούμενου proxy για αυτό το stream
  streamPerfMap[streamUrl].lastUsedProxy = proxyUrl || "";
  
  // Περιοδική αποστολή του χάρτη απόδοσης στον server
  fetch('https://yellow-hulking-guan.glitch.me/update-proxy-map', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(streamPerfMap)
  }).catch(err => {
    console.warn('⚠️ Αποτυχία ενημέρωσης του proxy map:', err);
  });
}

/**
 * ===========================================================================
 * ΔΙΑΧΕΙΡΙΣΗ ΥΠΟΤΙΤΛΩΝ
 * ===========================================================================
 */

// Διαχείριση αρχείου υποτίτλων και μετατροπή σε VTT
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

// Μετατροπή υποτίτλων από SRT σε VTT μορφή
function convertSrtToVtt(srtContent) {
    // SRT-Untertitelzeilen in VTT-Format konvertieren
    const vttContent = 'WEBVTT\n\n' + srtContent
        // Ersetze Trennzeichen
        .replace(/\r\n|\r|\n/g, '\n')
        // Ersetze Zeitformate von SRT in VTT
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');

    return vttContent;
}

/**
 * ===========================================================================
 * ΔΙΑΧΕΙΡΙΣΗ UI ΚΑΙ ΠΛΟΗΓΗΣΗΣ
 * ===========================================================================
 */

// Εναλλαγή προβολής περιεχομένου
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

// Ενημέρωση του ρολογιού στη διεπαφή
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('de-DE');
    const dateString = now.toLocaleDateString('de-DE');
    document.getElementById('clock').textContent = `${timeString} | ${dateString}`;
}

// Ενημέρωση της περιγραφής του player με τις πληροφορίες του τρέχοντος προγράμματος
function updatePlayerDescription(title, description) {
    const playerTitleElem = document.getElementById('player-title');
    const playerDescElem = document.getElementById('player-description');
    
    if (playerTitleElem) {
        playerTitleElem.textContent = title || 'Κανένα πρόγραμμα';
    }
    if (playerDescElem) {
        playerDescElem.textContent = description || 'Καμία διαθέσιμη περιγραφή';
    }
}

// Ενημέρωση της λίστας με τα επόμενα προγράμματα για το κανάλι
function updateNextPrograms(channelId) {
    const nextProgramsElem = document.getElementById('next-programs');
    if (!nextProgramsElem || !epgData[channelId]) {
        return;
    }
    
    // Καθαρισμός της λίστας
    nextProgramsElem.innerHTML = '';
    
    // Εύρεση των επόμενων προγραμμάτων
    const programs = getUpcomingPrograms(channelId);
    
    // Προσθήκη των προγραμμάτων στη λίστα
    programs.forEach(program => {
        const programItem = document.createElement('div');
        programItem.className = 'next-program-item';
        
        const startTime = new Date(program.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(program.end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        programItem.innerHTML = `
            <div class="program-time">${startTime} - ${endTime}</div>
            <div class="program-title">${program.title}</div>
        `;
        
        nextProgramsElem.appendChild(programItem);
    });
}

// Ορισμός του τρέχοντος καναλιού
function setCurrentChannel(channelName, streamURL) {
    currentChannel = {
        name: channelName,
        stream: streamURL
    };
    
    // Ενημέρωση του τίτλου στη διεπαφή
    const channelTitleElem = document.getElementById('current-channel-title');
    if (channelTitleElem) {
        channelTitleElem.textContent = channelName;
    }
}

// Λειτουργία αναζήτησης στη λίστα καναλιών
function searchChannels(query) {
    const filter = query.toLowerCase();
    const items = document.querySelectorAll('#sidebar-list li');
    
    items.forEach(item => {
        const text = item.textContent || item.innerText;
        item.style.display = text.toLowerCase().includes(filter) ? '' : 'none';
    });
}

/**
 * ===========================================================================
 * ΔΙΑΧΕΙΡΙΣΗ PLAYLIST ΚΑΙ ΚΑΝΑΛΙΩΝ
 * ===========================================================================
 */

// Φόρτωση των URL των playlist από αρχείο
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

// Φόρτωση προσωπικής playlist
function loadMyPlaylist() {
    fetch('my-playlist.m3u')
        .then(response => response.text())
        .then(data => {
            updateSidebarFromM3U(data);
        })
        .catch(err => {
            console.error('Σφάλμα φόρτωσης προσωπικής playlist:', err);
        });
}

// Φόρτωση εξωτερικής playlist
function loadExternalPlaylist() {
    const url = prompt('Εισάγετε το URL της εξωτερικής playlist:');
    if (!url) return;
    
    fetch(url)
        .then(response => response.text())
        .then(data => {
            updateSidebarFromM3U(data);
        })
        .catch(err => {
            console.error('Σφάλμα φόρτωσης εξωτερικής playlist:', err);
            alert('Σφάλμα φόρτωσης. Ελέγξτε το URL και δοκιμάστε ξανά.');
        });
}

// Φόρτωση αθλητικής playlist
function loadSportPlaylist() {
    fetch('sport-playlist.m3u')
        .then(response => response.text())
        .then(data => {
            updateSidebarFromM3U(data);
        })
        .catch(err => {
            console.error('Σφάλμα φόρτωσης αθλητικής playlist:', err);
        });
}

// Ενημέρωση του sidebar με δεδομένα από M3U
function updateSidebarFromM3U(m3uContent) {
    const sidebarList = document.getElementById('sidebar-list');
    sidebarList.innerHTML = '';

    // Ανάλυση του αρχείου M3U για εξαγωγή των καναλιών
    const lines = m3uContent.split('\n');
    let currentChannel = null;

    lines.forEach(line => {
        line = line.trim();
        
        if (line.startsWith('#EXTINF:')) {
            // Γραμμή πληροφοριών για το επόμενο κανάλι
            let channelInfo = parseExtInf(line);
            currentChannel = channelInfo;
        } else if (line.length > 0 && !line.startsWith('#') && currentChannel) {
            // Γραμμή URL του stream
            const channelUrl = line;
            
            // Δημιουργία στοιχείου λίστας για το κανάλι
            const li = document.createElement('li');
            const divInfo = document.createElement('div');
            divInfo.className = 'channel-info';
            divInfo.dataset.stream = channelUrl;
            divInfo.dataset.channelId = currentChannel.id || generateChannelId(currentChannel.name);
            
            // Λογότυπο του καναλιού
            const logoDiv = document.createElement('div');
            logoDiv.className = 'logo-container';
            const logoImg = document.createElement('img');
            logoImg.src = currentChannel.logo || 'default-channel-logo.png';
            logoImg.alt = currentChannel.name;
            logoDiv.appendChild(logoImg);
            
            // Όνομα του καναλιού
            const nameDiv = document.createElement('div');
            nameDiv.className = 'sender-name';
            nameDiv.textContent = currentChannel.name;
            
            divInfo.appendChild(logoDiv);
            divInfo.appendChild(nameDiv);
            li.appendChild(divInfo);
            sidebarList.appendChild(li);
            
            // Έλεγχος κατάστασης του stream
            checkChannelStatus(divInfo, channelUrl);
            
            currentChannel = null;
        }
    });
}

// Ανάλυση γραμμής EXTINF για εξαγωγή πληροφοριών καναλιού
function parseExtInf(line) {
    const result = {
        name: "Unknown",
        logo: "",
        id: ""
    };
    
    // Εξαγωγή ονόματος καναλιού
    const nameMatch = line.match(/,(.+)$/);
    if (nameMatch && nameMatch[1]) {
        result.name = nameMatch[1].trim();
    }
    
    // Εξαγωγή URL λογότυπου
    const logoMatch = line.match(/tvg-logo="([^"]+)"/);
    if (logoMatch && logoMatch[1]) {
        result.logo = logoMatch[1];
    }
    
    // Εξαγωγή ID καναλιού
    const idMatch = line.match(/tvg-id="([^"]+)"/);
    if (idMatch && idMatch[1]) {
        result.id = idMatch[1];
    }
    
    return result;
}

// Δημιουργία ID καναλιού από το όνομα αν δεν υπάρχει
function generateChannelId(channelName) {
    return channelName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Έλεγχος κατάστασης καναλιού (online/offline)
function checkChannelStatus(channelElement, streamUrl) {
    if (globalStreamCache[streamUrl]) {
        // Χρήση του cache αν υπάρχει
        const isWorking = globalStreamCache[streamUrl].working;
        channelElement.classList.toggle('online', isWorking);
        channelElement.classList.toggle('offline', !isWorking);
    } else {
        // Έλεγχος με δοκιμαστική φόρτωση
        fetch(streamUrl, { method: 'HEAD', mode: 'no-cors', timeout: 5000 })
            .then(() => {
                channelElement.classList.add('online');
                channelElement.classList.remove('offline');
                updateStreamCache(streamUrl, true);
            })
            .catch(() => {
                channelElement.classList.add('offline');
                channelElement.classList.remove('online');
                updateStreamCache(streamUrl, false);
            });
    }
}

// Περιοδικός έλεγχος κατάστασης των streams
function checkStreamStatus() {
    const channels = document.querySelectorAll('.channel-info');
    channels.forEach(channel => {
        const streamUrl = channel.dataset.stream;
        if (streamUrl) {
            checkChannelStatus(channel, streamUrl);
        }
    });
}

/**
 * ===========================================================================
 * ΔΙΑΧΕΙΡΙΣΗ EPG (ELECTRONIC PROGRAM GUIDE)
 * ===========================================================================
 */

// Φόρτωση δεδομένων EPG από τον server
function loadEPGData() {
    fetch('https://yellow-hulking-guan.glitch.me/epg-data.json')
        .then(response => response.json())
        .then(data => {
            epgData = data;
            console.log('✅ EPG δεδομένα φορτώθηκαν επιτυχώς');
        })
        .catch(err => {
            console.error('❌ Σφάλμα φόρτωσης EPG δεδομένων:', err);
        });
}

// Λήψη του τρέχοντος προγράμματος για ένα κανάλι
function getCurrentProgram(channelId) {
    if (!epgData[channelId]) {
        return { title: "Μη διαθέσιμο πρόγραμμα", description: "Δεν υπάρχουν διαθέσιμες πληροφορίες EPG." };
    }
    
    const now = new Date();
    const programs = epgData[channelId];
    
    for (const program of programs) {
        const startTime = new Date(program.start);
        const endTime = new Date(program.end);
        
        if (now >= startTime && now < endTime) {
            return program;
        }
    }
    
    return { title: "Εκτός προγράμματος", description: "Δεν υπάρχει τρέχον πρόγραμμα." };
}

// Λήψη των επόμενων προγραμμάτων για ένα κανάλι
function getUpcomingPrograms(channelId) {
    if (!epgData[channelId]) {
        return [];
    }
    
    const now = new Date();
    const programs = epgData[channelId];
    const upcoming = [];
    
    // Έλεγχος για προγράμματα που αρχίζουν στο μέλλον
    for (const program of programs) {
        const startTime = new Date(program.start);
        
        if (startTime > now) {
            upcoming.push(program);
            
            // Περιορισμός σε 5 επόμενα προγράμματα
            if (upcoming.length >= 5) {
                break;
            }
        }
    }
    
    return upcoming;
}

/**
 * ===========================================================================
 * ΑΚΡΟΑΤΕΣ ΣΥΜΒΑΝΤΩΝ (EVENT LISTENERS)
 * ===========================================================================
 */

// Ενιαίος event listener για το DOMContentLoaded
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

  // Αρχικοποίηση EPG και ρολογιού
  loadEPGData();
  updateClock();
  setInterval(updateClock, 1000);

  // Event listeners για τα κουμπιά των playlists
  document.getElementById('myPlaylist').addEventListener('click', loadMyPlaylist);
  document.getElementById('externalPlaylist').addEventListener('click', loadExternalPlaylist);
  document.getElementById('sportPlaylist').addEventListener('click', loadSportPlaylist);

  // Event listener για την επιλογή καναλιού από τη sidebar
  const sidebarList = document.getElementById('sidebar-list');
  sidebarList.addEventListener('click', function (event) {
    const channelInfo = event.target.closest('.channel-info');
    if (channelInfo) {
      // Λήψη πληροφοριών για το επιλεγμένο κανάλι
      const streamURL = channelInfo.dataset.stream;
      const channelId = channelInfo.dataset.channelId;
      const programInfo = getCurrentProgram(channelId);

      // Ενημέρωση τρέχοντος καναλιού και αναπαραγωγή
      setCurrentChannel(channelInfo.querySelector('.sender-name').textContent, streamURL);
      playStream(streamURL);

      // Ενημέρωση πληροφοριών προγράμματος
      updatePlayerDescription(programInfo.title, programInfo.description);
      updateNextPrograms(channelId);

      // Ενημέρωση λογότυπου καναλιού
      const logoContainer = document.getElementById('current-channel-logo');
      const logoImg = channelInfo.querySelector('.logo-container img').src;
      logoContainer.src = logoImg;
    }
  });

  // Περιοδικός έλεγχος κατάστασης των streams
  setInterval(checkStreamStatus, 60000);

  // Event listeners για το κουμπί αναπαραγωγής και τα πεδία εισαγωγής
  const playButton = document.getElementById('play-button');
  const streamUrlInput = document.getElementById('stream-url');
  const subtitleFileInput = document.getElementById('subtitle-file');

  // Συνάρτηση για αναπαραγωγή από το πεδίο εισαγωγής URL
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

  // Προσθήκη event listeners για το κουμπί αναπαραγωγής και το πεδίο URL
  playButton.addEventListener('click', playStreamFromInput);
  streamUrlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') playStreamFromInput();
  });
  
  // Event listener για το πεδίο υποτίτλων
  subtitleFileInput?.addEventListener('change', (event) => {
    const subtitleFile = event.target.files[0];
    if (subtitleFile) handleSubtitleFile(subtitleFile);
  });

  // 🔍 Event listeners για την αναζήτηση
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', function () {
    const filter = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => {
      const text = item.textContent || item.innerText;
      item.style.display = text.toLowerCase().includes(filter) ? '' : 'none';
    });
  });

  // Event listener για το Enter στην αναζήτηση
  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      const firstVisibleItem = document.querySelector('#sidebar-list li[style=""]');
      if (firstVisibleItem) {
        const streamURL = firstVisibleItem.querySelector('.channel-info').dataset.stream;
        playStream(streamURL);
      }
    }
  });

  // Event listener για το φίλτρο "Μόνο Online"
  const filterOnlineButton = document.getElementById('filter-online-button');
  filterOnlineButton.addEventListener('click', function () {
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => {
      const channelInfo = item.querySelector('.channel-info');
      item.style.display = (channelInfo && channelInfo.classList.contains('online')) ? '' : 'none';
    });
  });

  // Event listener για το κουμπί "Εμφάνιση Όλων"
  const showAllButton = document.getElementById('show-all-button');
  showAllButton.addEventListener('click', function () {
    const items = document.querySelectorAll('#sidebar-list li');
    items.forEach(item => item.style.display = '');
  });

  // Event listener για το playlist-urls panel
  const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
  if (playlistUrlsTitle) {
    playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
  } else {
    console.error('Element für den Klick-Event-Listener wurde nicht gefunden.');
  }
});
