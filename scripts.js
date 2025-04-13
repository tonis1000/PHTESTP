// Ολοκληρωμένος κώδικας JavaScript για WebTV με οργανωμένες ενότητες και σχόλια

// 1. Βοηθητικές συναρτήσεις / Χρόνος
// ----------------------------------------

// Συνάρτηση για μορφοποίηση ώρας σε μορφή HH:MM (με μηδενικά μπροστά)
function formatTime(date) {
  let h = date.getHours();
  let m = date.getMinutes();
  let hh = h < 10 ? '0' + h : '' + h;
  let mm = m < 10 ? '0' + m : '' + m;
  return hh + ':' + mm;
}

// Συνάρτηση για μετατροπή ώρας αγώνα από τοπική (π.χ. Ελλάδας) σε ώρα Γερμανίας
// Υποθέτουμε διαφορά ζώνης +1 ώρα (Ελλάδα -> Γερμανία)
function toGermanyTime(date) {
  // Αφαίρεση 1 ώρας για μετατροπή από EET/EEST σε CET/CEST
  date.setHours(date.getHours() - 1);
  return date;
}

// Συνάρτηση για έλεγχο αν ένας αγώνας είναι live (±100 λεπτά από την προγραμματισμένη ώρα)
function isMatchLive(eventTime) {
  if (!eventTime) return false;
  const now = new Date();
  const diffMinutes = (now.getTime() - eventTime.getTime()) / 60000; // διαφορά σε λεπτά
  return diffMinutes >= -100 && diffMinutes <= 100;
}

// Συνάρτηση για αντιγραφή κειμένου στο πρόχειρο (π.χ. αντιγραφή URL καναλιού)
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Σφάλμα αντιγραφής στο clipboard:', err);
    });
  } else {
    // Fallback για παλιότερους browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Σφάλμα αντιγραφής στο clipboard (fallback):', err);
    }
    document.body.removeChild(textarea);
  }
}

// 2. Διαχείριση αναπαραγωγής και player (video, iframe, Clappr)
// -------------------------------------------------------------

// Global μεταβλητές για τον player (Clappr) και το τρέχον επιλεγμένο κανάλι/stream
let player = null;
let currentItem = null;

// Ρύθμιση Proxy (αν υπάρχει διαθέσιμο script για proxy)
const PROXY_URL = '';   // π.χ. 'proxy.php?url=' ή κενό αν δεν χρησιμοποιείται
let enableProxy = false; // flag για χρήση proxy σε όλα τα streams

// Συνάρτηση για αναπαραγωγή επιλεγμένου καναλιού/αγώνα μέσω Clappr ή iframe
function playItem(item) {
  currentItem = item;
  let streamURL = item.url;
  // Αν είναι ενεργοποιημένο το proxy ή αν το κανάλι απαιτεί proxy, προετοιμασία URL
  if (enableProxy && PROXY_URL) {
    streamURL = PROXY_URL + encodeURIComponent(item.url);
    currentItem.usingProxy = true;
  } else {
    currentItem.usingProxy = false;
  }
  // Έλεγχος αν το URL είναι άμεσο stream (HLS, MP4 κλπ) ή σελίδα για iframe
  if (!isDirectStream(item.url)) {
    // Αναπαραγωγή μέσω iframe (π.χ. αν το URL είναι σελίδα html ή embed)
    showIframePlayer(item.url);
    return;
  }
  // Αν υπήρχε iframe από προηγούμενο stream, το αφαιρούμε
  removeIframePlayer();
  // Καταστροφή προηγούμενου Clappr player αν υπάρχει
  if (player) {
    try { player.destroy(); } catch(e) {}
    player = null;
  }
  // Δημιουργία νέου Clappr player για το stream
  player = new Clappr.Player({
    parentId: '#player',            // το container στοιχείο στο HTML για τον player
    source: streamURL,
    autoPlay: true,
    mute: false,
    height: '100%',
    width: '100%',
    plugins: typeof ClapprSubtitle !== 'undefined' ? [ClapprSubtitle] : [], // προσθήκη plugin υπότιτλων αν υπάρχει
    // Αν υπάρχει διαθέσιμος υπότιτλος για το κανάλι, τον περνάμε στο config
    subtitle: item.subtitle ? {
      src: item.subtitle,
      auto: true,
      backgroundColor: 'transparent',
      fontSize: '14px',
      fontWeight: 'normal',
      color: '#ffffff',
      textShadow: '1px 1px 2px #000000'
    } : null
  });
  // Προσθήκη event listener για σφάλματα αναπαραγωγής του player
  player.on(Clappr.Events.PLAYER_ERROR, onPlayerError);
  player.on(Clappr.Events.PLAYBACK_ERROR, onPlayerError);
}

// Βοηθητική συνάρτηση που ελέγχει αν ένα URL είναι άμεσο video stream (και όχι ιστοσελίδα)
function isDirectStream(url) {
  // θεωρούμε ως άμεσο stream τα URLs με καταλήξεις αρχείων video/stream ή πρωτόκολλο rtmp
  return /\.(m3u8|mp4|mpd|webm|ogg)($|\?)/i.test(url) || url.startsWith('rtmp');
}

// Συνάρτηση fallback: εμφάνιση iframe player για περιπτώσεις που δεν παίζει ο Clappr
function showIframePlayer(pageURL) {
  const playerContainer = document.getElementById('player');
  if (!playerContainer) return;
  // Καταστροφή Clappr player αν υπάρχει
  if (player) {
    try { player.destroy(); } catch(e) {}
    player = null;
  }
  // Δημιουργία iframe και εμφάνισή του
  const iframe = document.createElement('iframe');
  iframe.id = 'playerIframe';
  iframe.src = pageURL;
  iframe.width = '100%';
  iframe.height = '100%';
  iframe.frameBorder = '0';
  iframe.allowFullscreen = true;
  // Καθαρισμός container και προσθήκη του iframe
  playerContainer.innerHTML = '';
  playerContainer.appendChild(iframe);
}

// Συνάρτηση για αφαίρεση iframe player (όταν επιστρέφουμε σε Clappr)
function removeIframePlayer() {
  const existingIframe = document.getElementById('playerIframe');
  if (existingIframe) {
    existingIframe.remove();
  }
}

// Event handler για σφάλματα player - εφαρμόζει fallback (proxy ή iframe)
function onPlayerError(error) {
  console.warn('Σφάλμα αναπαραγωγής:', error);
  if (currentItem) {
    // Αν δεν χρησιμοποιήθηκε ήδη proxy, δοκιμάζουμε ξανά με proxy ενεργό
    if (!currentItem.usingProxy && PROXY_URL) {
      console.log('Δοκιμή αναπαραγωγής μέσω proxy...');
      enableProxy = true;
      playItem(currentItem); // επανάκληση με χρήση proxy
      return;
    }
    // Αλλιώς, fallback σε iframe player
    console.log('Fallback σε iframe player...');
    showIframePlayer(currentItem.url);
  }
}

// 3. Ανάγνωση playlist, EPG και sport-program
// --------------------------------------------

// Σταθερές URLs για playlist (MyPlaylist) και αρχεία EPG, sports (αν υπάρχουν)
const MY_PLAYLIST_URL = 'my.m3u';  // URL ή διαδρομή αρχείου για το προσωπικό playlist
let externalPlaylistURL = null;
let sportPlaylistURL = null;

// Λίστες καναλιών/αγώνων (θα γεμίσουν μετά την ανάγνωση των playlist)
let myChannels = [];
let externalChannels = [];
let sportEvents = [];

// Συνάρτηση για φόρτωση των διαθέσιμων playlist URLs από αρχείο (π.χ. playlist-urls.txt)
function loadPlaylistURLs() {
  fetch('playlist-urls.txt').then(response => response.text())
    .then(text => {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      if (lines.length > 0) {
        externalPlaylistURL = lines[0];
      }
      if (lines.length > 1) {
        sportPlaylistURL = lines[1];
      }
    })
    .catch(err => {
      console.warn('Αδυναμία φόρτωσης playlist-urls.txt:', err);
    })
    .finally(() => {
      // Μετά την προσπάθεια φόρτωσης URLs, προχωράμε στη φόρτωση των ίδιων των playlist
      loadAllPlaylists();
    });
}

// Συνάρτηση για φόρτωση όλων των playlist (MyPlaylist, External, Sports)
function loadAllPlaylists() {
  // Φόρτωση του τοπικού MyPlaylist
  loadPlaylist(MY_PLAYLIST_URL, 'my');
  // Φόρτωση External playlist (αν έχει οριστεί URL)
  if (externalPlaylistURL) {
    loadPlaylist(externalPlaylistURL, 'ext');
  }
  // Φόρτωση Sport playlist (αν έχει οριστεί URL)
  if (sportPlaylistURL) {
    loadPlaylist(sportPlaylistURL, 'sport');
  }
}

// Συνάρτηση για φόρτωση και ανάλυση ενός playlist (Μ3U) ανάλογα με τον τύπο του
function loadPlaylist(url, type) {
  fetch(url).then(response => response.text())
    .then(data => {
      // Ανάγνωση του κειμένου M3U και δημιουργία αντικειμένων καναλιών/αγώνων
      const items = parseM3U(data, type);
      if (type === 'my') {
        myChannels = items;
      } else if (type === 'ext') {
        externalChannels = items;
      } else if (type === 'sport') {
        sportEvents = items;
        // Ταξινόμηση αγώνων ανά ώρα (χρησιμοποιώντας ώρα Γερμανίας)
        sportEvents.sort((a, b) => {
          if (!a.eventTime || !b.eventTime) return 0;
          return a.eventTime - b.eventTime;
        });
      }
      // Απόπειρα εντοπισμού EPG URL στο ίδιο το playlist (αν πρόκειται για κύριο playlist)
      if ((type === 'my' || type === 'ext') && data.indexOf('x-tvg-url') !== -1) {
        const match = data.match(/x-tvg-url=\"([^\"]+)\"/i);
        if (match) {
          const epgUrl = match[1];
          loadEPG(epgUrl);
        }
      }
      // Rendering της λίστας στο sidebar
      renderPlaylist(items, type);
      // Αν το type είναι κανάλι (my ή ext), ξεκινάμε ανίχνευση online status & ενημέρωση EPG
      if (type !== 'sport') {
        updateEPGDisplay(); // αρχική ενημέρωση EPG (τρέχον/επόμενο πρόγραμμα)
        detectOnlineChannels(items, type);
      }
    })
    .catch(err => {
      console.error('Σφάλμα φόρτωσης playlist (' + type + '):', err);
    });
}

// Συνάρτηση για ανάλυση περιεχομένου M3U και δημιουργία λίστας αντικειμένων καναλιών/αγώνων
function parseM3U(data, type) {
  const lines = data.split(/\r?\n/);
  const items = [];
  let current = null;
  for (let line of lines) {
    if (line.startsWith('#EXTINF')) {
      // Νέο στοιχείο playlist
      current = {};
      // Εξαγωγή ονόματος καναλιού (μετά το κόμμα)
      const commaIndex = line.indexOf(',');
      let name = (commaIndex !== -1) ? line.substring(commaIndex + 1).trim() : '';
      current.name = name;
      // Έλεγχος για tvg-id, tvg-logo, group-title
      const tvgIdMatch = line.match(/tvg-id=\"([^\"]+)\"/i);
      const logoMatch = line.match(/tvg-logo=\"([^\"]+)\"/i);
      const groupMatch = line.match(/group-title=\"([^\"]+)\"/i);
      if (tvgIdMatch) current.tvgId = tvgIdMatch[1];
      if (logoMatch) current.logo = logoMatch[1];
      if (groupMatch) current.group = groupMatch[1];
    } else if (line.startsWith('#')) {
      // Αγνοούμε άλλες γραμμές μετα-πληροφορίας ή σχόλια
      if (line.toUpperCase().startsWith('#EXTM3U')) {
        // Ίσως περιέχει πληροφορίες EPG URL
      }
      continue;
    } else if (line.trim() !== '') {
      // Γραμμή με URL stream
      if (!current) current = {};
      current.url = line.trim();
      // Αν το αντικείμενο είναι αγώνας (sport playlist), εξαγωγή χρόνου αγώνα από το όνομα ή group
      if (type === 'sport') {
        // Προσπάθεια εντοπισμού ώρας μέσα στο όνομα (HH:MM ή HH.MM)
        let timeMatch = current.name.match(/(\d{1,2}[:\.]\d{2})/);
        let dateMatch = current.name.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        let eventDate = new Date();
        if (dateMatch) {
          // Αν υπάρχει και ημερομηνία στο όνομα, τη χρησιμοποιούμε
          let dateParts = dateMatch[1].split('/');
          let day = parseInt(dateParts[0], 10);
          let month = parseInt(dateParts[1], 10) - 1;
          let year = parseInt(dateParts[2], 10);
          if (year < 100) { // περίπτωση διψήφιου έτους
            year += 2000;
          }
          eventDate = new Date(year, month, day);
        }
        if (timeMatch) {
          let t = timeMatch[1].replace('.', ':'); // αντικατάσταση τυχόν μορφής με τελεία
          let [hour, min] = t.split(':').map(x => parseInt(x, 10));
          eventDate.setHours(hour);
          eventDate.setMinutes(min);
          eventDate.setSeconds(0);
          // Μετατροπή ώρας αγώνα σε ώρα Γερμανίας
          current.eventTime = toGermanyTime(new Date(eventDate));
        } else {
          current.eventTime = null;
        }
      }
      // Προσθήκη του στοιχείου στη λίστα
      items.push(current);
      current = null;
    }
  }
  return items;
}

// Συνάρτηση για φόρτωση και ανάλυση αρχείου EPG (XML)
let epgData = null; // μεταβλητή που θα κρατά τα δεδομένα EPG (DOM ή δομή προγραμμάτων)
function loadEPG(epgUrl) {
  fetch(epgUrl).then(res => res.text())
    .then(xmlText => {
      // Χρήση DOMParser για να μετατρέψουμε το XML σε DOM
      const parser = new DOMParser();
      epgData = parser.parseFromString(xmlText, 'application/xml');
      console.log('EPG δεδομένα φορτώθηκαν.');
      updateEPGDisplay(); // ενημέρωση EPG στις λίστες μετά τη φόρτωση
    })
    .catch(err => {
      console.error('Σφάλμα φόρτωσης EPG:', err);
    });
}

// 4. Sidebar rendering και αλληλεπίδραση
// ---------------------------------------

// Συνάρτηση για εμφάνιση λίστας καναλιών ή αγώνων στο sidebar
function renderPlaylist(items, type) {
  let listElement;
  if (type === 'my') {
    listElement = document.getElementById('myList');
  } else if (type === 'ext') {
    listElement = document.getElementById('extList');
  } else if (type === 'sport') {
    listElement = document.getElementById('sportList');
  }
  if (!listElement) {
    // Αν δεν υπάρχει το UL στοιχείο, το δημιουργούμε δυναμικά στο sidebar
    listElement = document.createElement('ul');
    listElement.id = (type === 'my' ? 'myList' : type === 'ext' ? 'extList' : 'sportList');
    // Προσθήκη μιας επικεφαλίδας κατηγορίας πριν από το UL
    const header = document.createElement('h3');
    header.textContent = (type === 'my' ? 'My Playlist' : type === 'ext' ? 'External Playlist' : 'Sport Playlist');
    header.className = 'playlist-header';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.appendChild(header);
      sidebar.appendChild(listElement);
    } else {
      document.body.appendChild(header);
      document.body.appendChild(listElement);
    }
  }
  // Καθαρισμός τυχόν προηγούμενων entries
  listElement.innerHTML = '';
  // Δημιουργία list items
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'playlist-item';
    li.textContent = item.name || 'Untitled';
    // Αν υπάρχει λογότυπο, προσθήκη εικόνας
    if (item.logo) {
      const img = document.createElement('img');
      img.src = item.logo;
      img.alt = 'logo';
      img.className = 'channel-logo';
      li.prepend(img);
    }
    // Αν το στοιχείο είναι αγώνας με προγραμματισμένη ώρα, προσθήκη ώρας εμφάνισης
    if (type === 'sport' && item.eventTime) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'match-time';
      timeSpan.textContent = formatTime(item.eventTime);
      li.appendChild(document.createTextNode(' '));
      li.appendChild(timeSpan);
    }
    // Προσθήκη event listener για click στο κανάλι/αγώνα
    li.addEventListener('click', () => {
      playItem(item);
      // τονισμός του επιλεγμένου στοιχείου στη λίστα
      document.querySelectorAll('.playlist-item.selected').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
    });
    // Αποθήκευση αναφοράς DOM στο ίδιο το αντικείμενο (για εύκολη ενημέρωση EPG/status)
    item.element = li;
    // Προσθήκη στη λίστα
    listElement.appendChild(li);
  });
}

// Συνάρτηση για εναλλαγή εμφάνισης μεταξύ των τριών λιστών playlist στο sidebar
function showPlaylist(type) {
  // Εύρεση των UL στοιχείων λίστας
  const myListEl = document.getElementById('myList');
  const extListEl = document.getElementById('extList');
  const sportListEl = document.getElementById('sportList');
  // Εμφάνιση μόνο της επιλεγμένης λίστας, απόκρυψη των άλλων
  if (myListEl) myListEl.style.display = (type === 'my') ? 'block' : 'none';
  if (extListEl) extListEl.style.display = (type === 'ext') ? 'block' : 'none';
  if (sportListEl) sportListEl.style.display = (type === 'sport') ? 'block' : 'none';
}

// 5. Ανίχνευση online καναλιών
// -----------------------------

// Συνάρτηση για έλεγχο διαθεσιμότητας (online/offline) των καναλιών σε μια λίστα
function detectOnlineChannels(channelList, type) {
  channelList.forEach((ch, index) => {
    // Έλεγχος με μια μικρή καθυστέρηση ανά κανάλι για να μην φορτώνονται όλα μαζί
    setTimeout(() => {
      fetch(ch.url, { method: 'HEAD', mode: 'no-cors', cache: 'no-cache' })
        .then(() => {
          // Αν λάβουμε απάντηση (ακόμα και χωρίς CORS), θεωρούμε το κανάλι online
          ch.online = true;
          if (ch.element) {
            ch.element.classList.add('online');
          }
        })
        .catch(() => {
          // Σε σφάλμα fetch, θεωρούμε το κανάλι offline
          ch.online = false;
          if (ch.element) {
            ch.element.classList.add('offline');
          }
        });
    }, 100 * index);
  });
}

// 6. Buttons (clear, copy, search, filter)
// -----------------------------------------

// Event listeners για κουμπιά και πεδία αναζήτησης/φίλτρων
function initControls() {
  // Κουμπί αντιγραφής συνδέσμου τρέχοντος καναλιού
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (currentItem) {
        copyToClipboard(currentItem.url);
      }
    });
  }
  // Πεδίο αναζήτησης καναλιών
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.toLowerCase();
      // Φιλτράρισμα μόνο στη λίστα που είναι ορατή αυτή τη στιγμή
      ['myList', 'extList', 'sportList'].forEach(listId => {
        const ul = document.getElementById(listId);
        if (!ul) return;
        // Ελέγχουμε αν αυτή η λίστα είναι ορατή (ή αν κάνουμε συνολικό φιλτράρισμα σε όλες)
        if (ul.style.display === 'none') {
          // Αν χρησιμοποιούμε tabs και η λίστα είναι κρυφή, αγνοούμε το φιλτράρισμα σε αυτήν
          return;
        }
        Array.from(ul.getElementsByTagName('li')).forEach(li => {
          const text = li.textContent.toLowerCase();
          if (text.includes(term)) {
            li.style.display = '';
          } else {
            li.style.display = 'none';
          }
        });
      });
    });
  }
  // Κουμπί εκκαθάρισης αναζήτησης
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      const event = new Event('input');
      searchInput.dispatchEvent(event); // πυροδότηση του input event για να εμφανιστούν ξανά όλα
    });
  }
  // Φίλτρο online καναλιών (π.χ. checkbox "μόνο online")
  const onlineToggle = document.getElementById('onlineToggle');
  if (onlineToggle) {
    onlineToggle.addEventListener('change', () => {
      const showOnlyOnline = onlineToggle.checked;
      ['myList', 'extList', 'sportList'].forEach(listId => {
        const ul = document.getElementById(listId);
        if (!ul) return;
        Array.from(ul.getElementsByTagName('li')).forEach(li => {
          if (showOnlyOnline) {
            // Εμφάνιση μόνο όσων έχουν κλάση 'online'
            if (!li.classList.contains('online')) {
              li.style.display = 'none';
            }
          } else {
            // Επαναφορά εμφάνισης (σε συνδυασμό με το search φίλτρο)
            li.style.display = '';
          }
        });
      });
    });
  }
}

// 7. SRT και υπότιτλοι
// ----------------------

// Αν υπάρχει input αρχείου για φόρτωση SRT υποτίτλων από το χρήστη
const srtFileInput = document.getElementById('srtFileInput');
if (srtFileInput) {
  srtFileInput.addEventListener('change', () => {
    const file = srtFileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const srtContent = reader.result;
        // Δημιουργία blob URL για το περιεχόμενο SRT
        const blob = new Blob([srtContent], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        if (currentItem) {
          // Ορισμός του subtitle URL στο τρέχον κανάλι και ενημέρωση του player
          currentItem.subtitle = blobUrl;
          if (player) {
            player.configure({ subtitle: { src: blobUrl, auto: true } });
          }
        }
      };
      reader.readAsText(file);
    }
  });
}

// Αρχικοποίηση όλων των απαιτούμενων event listeners και φόρτωση αρχικών δεδομένων μόλις φορτωθεί η σελίδα
document.addEventListener('DOMContentLoaded', () => {
  initControls();
  // Φόρτωση όλων των playlist και δεδομένων
  loadPlaylistURLs();
  // Επαναληπτικός έλεγχος/ενημέρωση EPG & live αγώνων κάθε λεπτό
  setInterval(updateEPGDisplay, 60000);
});

// Συνάρτηση για ενημέρωση της εμφάνισης EPG (τρέχον & επόμενο πρόγραμμα) και live αγώνων
function updateEPGDisplay() {
  const now = new Date();
  if (epgData) {
    // Για κάθε κανάλι στο myChannels και externalChannels, ενημέρωση EPG
    const allChannels = myChannels.concat(externalChannels);
    allChannels.forEach(ch => {
      if (!ch.element || !ch.tvgId) return;
      // Εύρεση τρέχοντος και επόμενου προγράμματος για το κανάλι με βάση το tvgId
      const channelId = ch.tvgId;
      // Λήψη όλων των <programme> για το συγκεκριμένο κανάλι
      const programs = Array.from(epgData.querySelectorAll('programme[channel="' + channelId + '"]'));
      let currentProg = null;
      let nextProg = null;
      for (let i = 0; i < programs.length; i++) {
        const prog = programs[i];
        const startAttr = prog.getAttribute('start');
        const stopAttr = prog.getAttribute('stop');
        if (!startAttr || !stopAttr) continue;
        const startTime = parseEPGDate(startAttr);
        const stopTime = parseEPGDate(stopAttr);
        if (startTime <= now && now < stopTime) {
          // Βρέθηκε το τρέχον πρόγραμμα
          currentProg = prog.querySelector('title') ? prog.querySelector('title').textContent : 'Πρόγραμμα';
          // Το επόμενο είναι το αμέσως επόμενο στο array (αν υπάρχει)
          if (programs[i+1]) {
            nextProg = programs[i+1].querySelector('title') ? programs[i+1].querySelector('title').textContent : '';
          }
          break;
        }
      }
      // Ενημέρωση κειμένου EPG στο στοιχείο λίστας
      if (currentProg !== null) {
        // Προσθήκη ή ενημέρωση span για current/next
        let epgSpan = ch.element.querySelector('.epg-info');
        if (!epgSpan) {
          epgSpan = document.createElement('span');
          epgSpan.className = 'epg-info';
          ch.element.appendChild(document.createTextNode(' '));
          ch.element.appendChild(epgSpan);
        }
        epgSpan.textContent = currentProg + (nextProg ? ' | Επόμενο: ' + nextProg : '');
      }
    });
  }
  // Ενημέρωση χρωματισμού για live αγώνες στη λίστα sportEvents
  sportEvents.forEach(ev => {
    if (!ev.element) return;
    if (isMatchLive(ev.eventTime)) {
      ev.element.classList.add('live');
    } else {
      ev.element.classList.remove('live');
    }
  });
}

// Συνάρτηση για μετατροπή ημερομηνίας/ώρας από string EPG (μορφή XMLTV) σε Date αντικείμενο
function parseEPGDate(dateStr) {
  // Μορφή: YYYYMMDDhhmmss ±ZZZZ (offset)
  // Παράδειγμα: 20250413070000 +0200
  const year = parseInt(dateStr.substring(0,4), 10);
  const month = parseInt(dateStr.substring(4,6), 10) - 1;
  const day = parseInt(dateStr.substring(6,8), 10);
  const hour = parseInt(dateStr.substring(8,10), 10);
  const min = parseInt(dateStr.substring(10,12), 10);
  const sec = parseInt(dateStr.substring(12,14), 10);
  // Offset timezone
  const offsetSign = dateStr.charAt(15);
  const offsetHours = parseInt(dateStr.substring(16,18), 10);
  const offsetMins = parseInt(dateStr.substring(18,20), 10);
  // Δημιουργία UTC ημερομηνίας
  const utcTime = Date.UTC(year, month, day, hour, min, sec);
  let offsetTotalMin = offsetHours * 60 + offsetMins;
  let utcMillis;
  if (offsetSign === '+') {
    utcMillis = utcTime - offsetTotalMin * 60000;
  } else {
    utcMillis = utcTime + offsetTotalMin * 60000;
  }
  return new Date(utcMillis);
}
