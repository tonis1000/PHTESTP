// Antonis WebTV εφαρμογή - scripts.js
// Υποστήριξη HLS, DASH, MP4/WebM με iframe fallback, υπότιτλους, playlist, αναζήτηση, φίλτρα, EPG, CORS proxies κ.ά.

// Λίστα CORS Proxy (σειρά προσπάθειας)
const CORS_PROXIES = [
    "", // κενό για απευθείας (χωρίς proxy)
    "https://cors-anywhere.herokuapp.com/",
    "https://api.allorigins.win/raw?url=",
    "https://thingproxy.freeboard.io/fetch/"
];

/**
 * Προσπάθεια λήψης κειμένου (π.χ. playlist ή EPG XML) με CORS fallback.
 * Δοκιμάζει απευθείας λήψη και μετά κάθε proxy μέχρι να επιτύχει ή αποτύχουν όλα.
 * Επιστρέφει το κείμενο σε περίπτωση επιτυχίας ή πετάει σφάλμα αν αποτύχουν όλες οι προσπάθειες.
 */
async function fetchTextWithCors(url) {
    let lastError = null;
    for (let prefix of CORS_PROXIES) {
        const targetUrl = prefix ? prefix + url : url;
        try {
            const response = await fetch(targetUrl);
            if (response.ok) {
                // Επιτυχής απόκριση
                const text = await response.text();
                return text;
            } else {
                lastError = new Error("HTTP " + response.status);
            }
        } catch (err) {
            lastError = err;
            // Αν η fetch αποτύχει (CORS ή πρόβλημα δικτύου), δοκιμάζει τον επόμενο proxy
        }
    }
    // Απέτυχαν όλες οι προσπάθειες:
    throw lastError || new Error("Failed to fetch " + url);
}

/**
 * Μετατροπή κειμένου υποτίτλων SRT σε μορφή WebVTT (string).
 * Διατηρεί πολλαπλές γραμμές κειμένου σε ένα cue και μετατρέπει τις χρονικές σημάνσεις.
 */
function srtToVtt(srtData) {
    // Αφαίρεση CR/LF και κενών διαστημάτων από αρχή/τέλος
    let srt = srtData.replace(/\r+/g, '').trim();
    // Διαχωρισμός σε μπλοκ υπότιτλων με κενή γραμμή
    const blocks = srt.split(/\n\n+/);
    let vtt = "WEBVTT\n\n";
    // Regex για αντιστοίχιση χρονικών SRT (με κόμμα ή τελεία στα milliseconds)
    const timeRegex = /(\d+):(\d+):(\d+)(?:[.,](\d+))?\s*-->\s*(\d+):(\d+):(\d+)(?:[.,](\d+))?/;
    for (let block of blocks) {
        block = block.trim();
        if (!block) continue;
        let lines = block.split('\n');
        // Συνένωση πολλαπλών γραμμών κειμένου υπότιτλου σε μία γραμμή (αν >2 γραμμές κειμένου)
        while (lines.length > 3) {
            for (let i = 3; i < lines.length; i++) {
                lines[2] += "\n" + lines[i];
            }
            lines.splice(3); // διατήρηση μόνο των 3 πρώτων στοιχείων (0,1,2)
        }
        let lineIndex = 0;
        // Αν η πρώτη γραμμή δεν είναι χρονική στιγμή αλλά η δεύτερη είναι, θεωρεί την πρώτη ως αναγνωριστικό cue
        if (lines.length > 1 && !lines[0].match(/\d+:\d+:\d+/) && lines[1].match(/\d+:\d+:\d+/)) {
            vtt += lines[0].match(/\w+/) + "\n";
            lineIndex = 1;
        }
        // Τώρα το lineIndex δείχνει στη γραμμή χρόνου
        const timeLine = lines[lineIndex];
        const match = timeRegex.exec(timeLine);
        if (!match) {
            // Μη έγκυρη μορφή χρόνου, παράλειψη αυτού του μπλοκ
            continue;
        }
        // Δημιουργία χρονικής σήμανσης WebVTT (αντικατάσταση ',' με '.' και 3 ψηφία milliseconds)
        const startH = match[1].padStart(2, '0'),
              startM = match[2].padStart(2, '0'),
              startS = match[3].padStart(2, '0');
        let startMs = match[4] || "000";
        startMs = startMs.padEnd(3, '0').substring(0, 3);
        const endH = match[5].padStart(2, '0'),
              endM = match[6].padStart(2, '0'),
              endS = match[7].padStart(2, '0');
        let endMs = match[8] || "000";
        endMs = endMs.padEnd(3, '0').substring(0, 3);
        vtt += `${startH}:${startM}:${startS}.${startMs} --> ${endH}:${endM}:${endS}.${endMs}\n`;
        // Προσθήκη κειμένου υπότιτλου. Αν υπάρχουν πολλαπλές γραμμές, έχουν ήδη συγχωνευθεί με \n.
        const textLine = lines[lineIndex + 1];
        if (textLine) {
            vtt += textLine + "\n\n";
        } else {
            vtt += "\n";
        }
    }
    return vtt;
}

// Κύριος κώδικας εφαρμογής (μέσα σε DOMContentLoaded για να είναι έτοιμο το DOM)
document.addEventListener('DOMContentLoaded', function() {
    // Element references
    const videoPlayer = document.getElementById('videoPlayer') || document.querySelector('video');
    const iframePlayer = document.getElementById('iframePlayer') || document.querySelector('iframe');
    const channelListEl = document.getElementById('channelList');
    const searchInput = document.getElementById('searchInput') || document.getElementById('search');
    const filterAllBtn = document.getElementById('filterAll');
    const filterOnlineBtn = document.getElementById('filterOnline');
    const playlistUrlInput = document.getElementById('playlistUrlInput');
    const loadPlaylistBtn = document.getElementById('loadPlaylistBtn');
    const currentUrlInput = document.getElementById('currentUrlInput') || document.getElementById('urlInput');
    const copyUrlBtn = document.getElementById('copyUrlBtn');
    const clearUrlBtn = document.getElementById('clearUrlBtn');
    const subtitleFileInput = document.getElementById('subtitleFileInput') || document.getElementById('subtitleFile');
    const clockEl = document.getElementById('clock');
    const epgContainer = document.getElementById('epgContainer') || document.getElementById('epgInfo');
    
    // Global state
    let channels = [];       // πίνακας αντικειμένων καναλιών {name, url, tvgId, tvgName, tvgLogo, group, isOnline}
    let filterOnlineOnly = false;
    let currentChannel = null;  // αντικείμενο τρέχοντος καναλιού που παίζει (αν επιλέχθηκε από λίστα)
    let hlsPlayer = null;
    let dashPlayer = null;
    let epgData = null;      // XML Document για το EPG
    let epgByChannel = {};   // Αντιστοίχιση ID καναλιού σε λίστα αντικειμένων προγράμματος (cache προγραμμάτων)
    
    // Βοηθητικό: ενημέρωση ρολογιού κάθε δευτερόλεπτο
    if (clockEl) {
        const days = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
        const months = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου',
                        'Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];
        function updateClock() {
            const now = new Date();
            const dayName = days[now.getDay()];
            const day = now.getDate();
            const monthName = months[now.getMonth()];
            const year = now.getFullYear();
            const hours = now.getHours().toString().padStart(2,'0');
            const minutes = now.getMinutes().toString().padStart(2,'0');
            const seconds = now.getSeconds().toString().padStart(2,'0');
            // Παράδειγμα μορφής: "Πέμπτη, 10 Απριλίου 2025, 21:29:12"
            const timeStr = `${dayName}, ${day} ${monthName} ${year}, ${hours}:${minutes}:${seconds}`;
            clockEl.textContent = timeStr;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }
    
    // Συνάρτηση: Διακοπή τρέχουσας αναπαραγωγής βίντεο/iframe
    function stopPlayback() {
        currentChannel = null;
        // Τερματισμός αναπαραγωγής βίντεο
        if (hlsPlayer) {
            hlsPlayer.destroy();
            hlsPlayer = null;
        }
        if (dashPlayer) {
            try { dashPlayer.reset(); } catch (e) {}
            dashPlayer = null;
        }
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.removeAttribute('src');
            // Αφαίρεση τυχόν υπαρχόντων υποτίτλων
            const tracks = videoPlayer.querySelectorAll('track');
            tracks.forEach(tr => tr.remove());
            // Εξασφάλιση ότι το video σταμάτησε να φορτώνει
            if (videoPlayer.load) {
                videoPlayer.load();
            }
        }
        // Διακοπή iframe
        if (iframePlayer) {
            iframePlayer.src = 'about:blank';
            iframePlayer.style.display = 'none';
        }
    }
    
    // Συνάρτηση: Αναπαραγωγή ενός καναλιού (από λίστα channels ή απευθείας URL)
    async function playChannel(channel) {
        // Το 'channel' μπορεί να είναι αντικείμενο από τον πίνακα channels ή απλό αντικείμενο {name, url} για απευθείας URL
        stopPlayback(); // σταμάτημα τυχόν προηγούμενης αναπαραγωγής
        let streamUrl = channel.url;
        currentChannel = channel;
        // Εμφάνιση ονόματος και λογότυπου καναλιού στο header αν είναι διαθέσιμα
        const channelName = channel.name || 'Stream';
        const channelLogo = channel.tvgLogo;
        // Ενημέρωση του πεδίου URL τρέχοντος καναλιού (αν υπάρχει)
        if (currentUrlInput) {
            currentUrlInput.value = streamUrl;
        }
        // Ενημέρωση header player (λογότυπο & όνομα)
        const logoImgEl = document.getElementById('channelLogo');
        const nameEl = document.getElementById('channelName');
        if (logoImgEl) {
            if (channelLogo) {
                logoImgEl.src = channelLogo;
                logoImgEl.style.display = '';
            } else {
                logoImgEl.style.display = 'none';
            }
        }
        if (nameEl) {
            nameEl.textContent = channelName;
        }
        // Προσδιορισμός τρόπου αναπαραγωγής βάσει τύπου URL
        let useIframe = false;
        if (streamUrl.match(/\.(php|html)$/i) || streamUrl.toLowerCase().includes('embed')) {
            useIframe = true;
        }
        if (useIframe) {
            // Χρήση iframe fallback
            if (iframePlayer) {
                iframePlayer.src = streamUrl;
                iframePlayer.style.display = 'block';
            }
            if (videoPlayer) {
                videoPlayer.style.display = 'none';
            }
        } else {
            if (iframePlayer) {
                iframePlayer.style.display = 'none';
                iframePlayer.src = 'about:blank';
            }
            if (!videoPlayer) {
                console.warn("Video player element not found!");
                return;
            }
            videoPlayer.style.display = 'block';
            // Έλεγχος τύπου ροής από την επέκταση URL
            if (streamUrl.endsWith('.m3u8')) {
                // Ροή HLS
                if (window.Hls && window.Hls.isSupported()) {
                    hlsPlayer = new Hls();
                    // Αν το CORS είναι θέμα, δοκιμή με proxy για HLS (πρώτα απευθείας ούτως ή άλλως)
                    hlsPlayer.loadSource(streamUrl);
                    hlsPlayer.attachMedia(videoPlayer);
                    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
                        videoPlayer.play().catch(err => console.warn("Autoplay failed:", err));
                    });
                    hlsPlayer.on(Hls.Events.ERROR, function(event, data) {
                        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !data.fatal) {
                            console.warn("HLS network error, trying to recover...");
                            hlsPlayer.startLoad();
                        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.fatal) {
                            console.warn("HLS fatal network error, retrying with proxy...");
                            // Αν η απευθείας φόρτωση απέτυχε λόγω CORS, δοκιμή με proxy
                            stopPlayback();
                            // Try each proxy URL for the .m3u8:
                            for (let i = 1; i < CORS_PROXIES.length; i++) {
                                let proxyUrl = CORS_PROXIES[i] + streamUrl;
                                try {
                                    hlsPlayer = new Hls();
                                    hlsPlayer.loadSource(proxyUrl);
                                    hlsPlayer.attachMedia(videoPlayer);
                                    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
                                        videoPlayer.play().catch(err=>{});
                                    });
                                    console.log("Retried with proxy:", CORS_PROXIES[i]);
                                    break;
                                } catch (e) {
                                    console.error("Proxy attempt failed:", CORS_PROXIES[i], e);
                                    stopPlayback();
                                }
                            }
                        }
                    });
                } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                    // Ορισμένοι browsers (π.χ. Safari) υποστηρίζουν HLS εγγενώς
                    videoPlayer.src = streamUrl;
                    videoPlayer.play().catch(err => console.warn("Autoplay failed:", err));
                } else {
                    console.error("HLS not supported in this browser");
                }
            } else if (streamUrl.endsWith('.mpd')) {
                // Ροή DASH
                if (window.dashjs) {
                    dashPlayer = dashjs.MediaPlayer().create();
                    dashPlayer.initialize(videoPlayer, streamUrl, true);
                } else {
                    console.error("dash.js library not loaded, cannot play .mpd stream");
                    videoPlayer.src = streamUrl;
                }
            } else if (streamUrl.endsWith('.mp4') || streamUrl.endsWith('.webm') || streamUrl.endsWith('.ogv')) {
                // Αναπαραγωγή αρχείου βίντεο (MP4/WebM/OGV)
                videoPlayer.src = streamUrl;
                videoPlayer.play().catch(err => console.warn("Autoplay failed:", err));
            } else {
                // Άγνωστη μορφή, προσπάθεια αναπαραγωγής στο video element ούτως ή άλλως
                videoPlayer.src = streamUrl;
                videoPlayer.play().catch(err => console.warn("Autoplay failed for unknown format:", err));
            }
        }
        // Μετά την έναρξη αναπαραγωγής (video), ενημέρωση πληροφοριών EPG για το κανάλι
        updateEpgInfo(channel);
    }
    
    // Ενημέρωση εμφάνισης EPG για ένα συγκεκριμένο κανάλι
    function updateEpgInfo(channel) {
        if (!epgData || !channel) {
            // Το EPG δεν φορτώθηκε ή το κανάλι δεν είναι γνωστό
            if (epgContainer) {
                epgContainer.innerHTML = channel ? '<em>Χωρίς διαθέσιμες πληροφορίες EPG</em>' : '';
            }
            return;
        }
        const chanId = channel.tvgId || channel.tvgName || (channel.name ? channel.name.replace(/\s+/g,'').toLowerCase() : '');
        if (!chanId) return;
        let progList = epgByChannel[chanId];
        if (!progList) {
            // Αν δεν υπάρχει ήδη αποθηκευμένο, αναζήτηση προγραμμάτων στο epgData XML
            const allPrograms = epgData.querySelectorAll(`programme[channel="${chanId}"]`);
            progList = [];
            allPrograms.forEach(progNode => {
                const titleNode = progNode.querySelector('title');
                const descNode = progNode.querySelector('desc');
                const startAttr = progNode.getAttribute('start');
                const stopAttr = progNode.getAttribute('stop');
                let title = titleNode ? titleNode.textContent : '';
                let desc = descNode ? descNode.textContent : '';
                // Μετατροπή start/stop σε αντικείμενα Date
                const parseTime = (timeStr) => {
                    const year = timeStr.substring(0,4);
                    const month = timeStr.substring(4,6);
                    const day = timeStr.substring(6,8);
                    const hour = timeStr.substring(8,10);
                    const min = timeStr.substring(10,12);
                    const sec = timeStr.substring(12,14);
                    let offset = '+0000';
                    if (timeStr.length > 14) {
                        offset = timeStr.substring(15);
                    }
                    if (offset && offset.length === 5) {
                        offset = offset.substring(0,3) + ':' + offset.substring(3);
                    }
                    const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}${offset}`;
                    const dateObj = new Date(isoStr);
                    return isNaN(dateObj) ? null : dateObj;
                };
                const startTime = startAttr ? parseTime(startAttr) : null;
                const stopTime = stopAttr ? parseTime(stopAttr) : null;
                progList.push({ start: startTime, stop: stopTime, title: title, desc: desc });
            });
            progList.sort((a,b) => (a.start && b.start ? a.start - b.start : 0));
            epgByChannel[chanId] = progList;
        }
        // Εύρεση τρέχοντος προγράμματος και επόμενων 4
        const now = new Date();
        let currentProg = null;
        let upcoming = [];
        if (progList && progList.length) {
            for (let i = 0; i < progList.length; i++) {
                const prog = progList[i];
                if (prog.start && prog.stop) {
                    if (prog.start <= now && now < prog.stop) {
                        currentProg = prog;
                        upcoming = progList.slice(i+1, i+5);
                        break;
                    }
                }
            }
            if (!currentProg) {
                if (now < progList[0].start) {
                    upcoming = progList.slice(0, 4);
                } else {
                    currentProg = progList[progList.length - 1];
                    if (currentProg && currentProg.stop && currentProg.stop <= now) {
                        currentProg = null;
                    }
                    upcoming = [];
                }
            }
        }
        // Δημιουργία προβολής πληροφοριών EPG
        if (epgContainer) {
            epgContainer.innerHTML = '';
            if (!currentProg && !upcoming.length) {
                epgContainer.innerHTML = '<em>Χωρίς διαθέσιμες πληροφορίες EPG</em>';
                return;
            }
            if (currentProg) {
                const startH = currentProg.start ? currentProg.start.getHours().toString().padStart(2,'0') : '';
                const startM = currentProg.start ? currentProg.start.getMinutes().toString().padStart(2,'0') : '';
                const endH = currentProg.stop ? currentProg.stop.getHours().toString().padStart(2,'0') : '';
                const endM = currentProg.stop ? currentProg.stop.getMinutes().toString().padStart(2,'0') : '';
                const timeRange = (startH && endH) ? `${startH}:${startM} - ${endH}:${endM}` : '';
                // Πληροφορίες τρέχοντος προγράμματος
                const nowDiv = document.createElement('div');
                nowDiv.innerHTML = `<strong>Τώρα:</strong> ${currentProg.title} ${timeRange ? '('+timeRange+')' : ''}`;
                const nowDescDiv = document.createElement('div');
                nowDescDiv.textContent = currentProg.desc || '';
                nowDescDiv.style.marginBottom = '8px';
                epgContainer.appendChild(nowDiv);
                epgContainer.appendChild(nowDescDiv);
            } else {
                // Δεν υπάρχει τρέχον πρόγραμμα (εκτός αέρα αυτήν τη στιγμή)
                const offDiv = document.createElement('div');
                offDiv.innerHTML = `<strong>Τώρα:</strong> Δεν υπάρχει τρέχον πρόγραμμα.`;
                epgContainer.appendChild(offDiv);
            }
            if (upcoming.length) {
                const upHeader = document.createElement('div');
                upHeader.innerHTML = '<strong>Επόμενα:</strong>';
                epgContainer.appendChild(upHeader);
                upcoming.forEach(prog => {
                    const startH = prog.start ? prog.start.getHours().toString().padStart(2,'0') : '';
                    const startM = prog.start ? prog.start.getMinutes().toString().padStart(2,'0') : '';
                    const endH = prog.stop ? prog.stop.getHours().toString().padStart(2,'0') : '';
                    const endM = prog.stop ? prog.stop.getMinutes().toString().padStart(2,'0') : '';
                    const timeRange = (startH && endH) ? `${startH}:${startM} - ${endH}:${endM}` : '';
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'epg-program';
                    // Γραμμή τίτλου
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'epg-title';
                    titleDiv.textContent = `${timeRange} ${prog.title}`;
                    titleDiv.style.cursor = prog.desc ? 'pointer' : 'default';
                    // Περιγραφή (κρυφή αρχικά)
                    const descDiv = document.createElement('div');
                    descDiv.className = 'epg-desc';
                    descDiv.textContent = prog.desc || '';
                    descDiv.style.display = 'none';
                    descDiv.style.marginBottom = '8px';
                    // Εναλλαγή εμφάνισης περιγραφής με κλικ στον τίτλο
                    if (prog.desc) {
                        titleDiv.addEventListener('click', () => {
                            const isVisible = descDiv.style.display === 'block';
                            descDiv.style.display = isVisible ? 'none' : 'block';
                        });
                    }
                    itemDiv.appendChild(titleDiv);
                    itemDiv.appendChild(descDiv);
                    epgContainer.appendChild(itemDiv);
                });
            }
        }
    }
    
    // Ανάλυση περιεχομένου playlist M3U/M3U8 σε πίνακα καναλιών
    function parsePlaylist(text) {
        const lines = text.split(/\r?\n/);
        channels = [];
        let currentChannel = null;
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#EXTM3U')) {
                // παράλειψη header ή κενών γραμμών
                continue;
            }
            if (line.startsWith('#EXTINF:')) {
                // Γραμμή μεταδεδομένων (EXTINF)
                const info = line;
                // Ανάλυση γνωρισμάτων στη γραμμή EXTINF
                const attrs = {};
                const commaIndex = info.indexOf(',');
                let name = '';
                if (commaIndex !== -1) {
                    name = info.substring(commaIndex + 1).trim();
                }
                let attrString = info.substring(0, commaIndex);
                attrString = attrString.replace(/^#EXTINF:-?\d+ ?/, '');
                const attrRegex = /([\w-]+)="([^"]*)"/g;
                let match;
                while ((match = attrRegex.exec(attrString)) !== null) {
                    attrs[match[1]] = match[2];
                }
                currentChannel = {
                    name: name || attrs['tvg-name'] || '',
                    url: null,
                    tvgId: attrs['tvg-id'] || attrs['epg-id'] || '',
                    tvgName: attrs['tvg-name'] || '',
                    tvgLogo: attrs['tvg-logo'] || '',
                    group: attrs['group-title'] || ''
                };
                if (!currentChannel.tvgId && currentChannel.tvgName) {
                    if (!currentChannel.tvgName.match(/\s/)) {
                        currentChannel.tvgId = currentChannel.tvgName;
                    }
                }
            } else if (line.startsWith('#')) {
                // Άλλα metadata ή σχόλιο - παράλειψη
                continue;
            } else {
                // Αυτή η γραμμή θα είναι το URL της ροής του καναλιού
                const url = line;
                if (!currentChannel) {
                    // Βασική εγγραφή για URL χωρίς EXTINF
                    currentChannel = { name: url, url: url, tvgId: '', tvgName: '', tvgLogo: '', group: '' };
                }
                currentChannel.url = url;
                channels.push(currentChannel);
                currentChannel = null;
            }
        }
    }
    
    // Ανάλυση απλής μορφής λίστας (π.χ. από playlist-urls.txt) σε κανάλια
    function parseSimpleList(text) {
        const lines = text.split(/\r?\n/);
        channels = [];
        lines.forEach((line, idx) => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            let name = '';
            let url = '';
            const httpIndex = line.indexOf('http');
            if (httpIndex > 0) {
                name = line.substring(0, httpIndex).trim().replace(/[-\|,]$/, '').trim();
                url = line.substring(httpIndex).trim();
            } else if (httpIndex === 0) {
                url = line.trim();
                name = "Channel " + (idx+1);
            }
            if (url) {
                channels.push({ name: name, url: url, tvgId: '', tvgName: '', tvgLogo: '', group: '' });
            }
        });
    }
    
    // Φόρτωση αρχικού playlist (τοπικό ή εξωτερικό)
    async function loadInitialPlaylist() {
        try {
            let data = await fetchTextWithCors('playlist.m3u');
            if (data) {
                if (data.indexOf('#EXTINF') !== -1) {
                    parsePlaylist(data);
                } else {
                    parseSimpleList(data);
                }
                return;
            }
        } catch (e) {
            console.warn("Δεν βρέθηκε ή δεν φορτώθηκε το playlist.m3u.", e);
        }
        try {
            let data2 = await fetchTextWithCors('playlist-urls.txt');
            if (data2) {
                if (data2.indexOf('#EXTINF') !== -1) {
                    parsePlaylist(data2);
                } else {
                    parseSimpleList(data2);
                }
                return;
            }
        } catch (e) {
            console.warn("Δεν βρέθηκε ή δεν φορτώθηκε το playlist-urls.txt.", e);
        }
        channels = [];
    }
    
    // Απόδοση της λίστας καναλιών από τον πίνακα channels
    function renderChannelList() {
        if (!channelListEl) return;
        channelListEl.innerHTML = '';
        channels.forEach((ch, index) => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            item.dataset.index = index;
            // Προαιρετική προσθήκη λογότυπου και ονόματος καναλιού
            if (ch.tvgLogo) {
                const logoImg = document.createElement('img');
                logoImg.src = ch.tvgLogo;
                logoImg.alt = ch.name;
                logoImg.className = 'channel-logo';
                logoImg.onerror = () => { logoImg.style.display='none'; };
                item.appendChild(logoImg);
            }
            const nameSpan = document.createElement('span');
            nameSpan.className = 'channel-name';
            nameSpan.textContent = ch.name || 'Unknown';
            item.appendChild(nameSpan);
            // Προσθήκη μπάρας προόδου EPG
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.width = '0%';
            progressContainer.appendChild(progressBar);
            item.appendChild(progressContainer);
            // Συμβάν κλικ για αναπαραγωγή αυτού του καναλιού
            item.addEventListener('click', () => {
                playChannel(ch);
            });
            channelListEl.appendChild(item);
        });
    }
    
    // Ενημέρωση των μπαρών προόδου EPG για όλα τα κανάλια (τρέχον πρόγραμμα)
    function updateAllProgressBars() {
        if (!epgData || !channels.length || !channelListEl) return;
        const now = new Date();
        channels.forEach(ch => {
            const chanId = ch.tvgId || ch.tvgName || (ch.name ? ch.name.replace(/\s+/g,'').toLowerCase() : '');
            if (!chanId) return;
            const itemElem = channelListEl.querySelector(`.channel-item[data-index="${channels.indexOf(ch)}"]`);
            if (!itemElem) return;
            const progList = epgByChannel[chanId];
            let currentProg = null;
            if (progList) {
                for (let prog of progList) {
                    if (prog.start && prog.stop && prog.start <= now && now < prog.stop) {
                        currentProg = prog;
                        break;
                    }
                }
            }
            const bar = itemElem.querySelector('.progress-bar');
            if (currentProg && currentProg.start && currentProg.stop) {
                const total = currentProg.stop - currentProg.start;
                const elapsed = now - currentProg.start;
                const percent = Math.floor((elapsed / total) * 100);
                bar.style.width = percent + '%';
            } else {
                bar.style.width = '0%';
            }
        });
    }
    
    // Φιλτράρισμα λίστας καναλιών βάσει αναζήτησης και κατάστασης online
    function filterChannelList() {
        if (!channelListEl) return;
        const query = (searchInput && searchInput.value || '').trim().toLowerCase();
        const showOnlineOnly = filterOnlineOnly;
        channels.forEach((ch, index) => {
            const item = channelListEl.querySelector(`.channel-item[data-index="${index}"]`);
            if (!item) return;
            let textMatch = true;
            if (query) {
                const combinedText = (ch.name + ' ' + (ch.group || '') + ' ' + (ch.tvgId || '')).toLowerCase();
                textMatch = combinedText.indexOf(query) !== -1;
            }
            let onlineMatch = true;
            if (showOnlineOnly) {
                // Εμφάνιση μόνο αν το isOnline είναι true (undefined θεωρείται false για ασφάλεια)
                onlineMatch = !!ch.isOnline;
            }
            if (textMatch && onlineMatch) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    // Συμβάν: Πλαίσιο αναζήτησης για δυναμικό φιλτράρισμα
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterChannelList();
        });
        // Πάτημα Enter στο πεδίο αναζήτησης ξεκινά την αναπαραγωγή του πρώτου ορατού αποτελέσματος
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (!channelListEl) return;
                const firstVisibleItem = channelListEl.querySelector('.channel-item:not([style*="display: none"])');
                if (firstVisibleItem) {
                    const idx = firstVisibleItem.dataset.index;
                    if (idx != null) {
                        playChannel(channels[idx]);
                        searchInput.blur();
                    }
                }
            }
        });
    }
    
    // Συμβάν: Κουμπί φίλτρο "Online"
    if (filterOnlineBtn) {
        filterOnlineBtn.addEventListener('click', () => {
            filterOnlineOnly = true;
            filterOnlineBtn.classList.add('active');
            if (filterAllBtn) filterAllBtn.classList.remove('active');
            filterChannelList();
        });
    }
    // Συμβάν: Κουμπί φίλτρο "Όλα"
    if (filterAllBtn) {
        filterAllBtn.addEventListener('click', () => {
            filterOnlineOnly = false;
            filterAllBtn.classList.add('active');
            if (filterOnlineBtn) filterOnlineBtn.classList.remove('active');
            filterChannelList();
        });
    }
    
    // Συμβάν: Φόρτωση playlist από URL χρήστη
    if (loadPlaylistBtn && playlistUrlInput) {
        loadPlaylistBtn.addEventListener('click', async () => {
            const url = playlistUrlInput.value.trim();
            if (!url) return;
            try {
                const data = await fetchTextWithCors(url);
                if (data.indexOf('#EXTINF') !== -1) {
                    parsePlaylist(data);
                } else {
                    parseSimpleList(data);
                }
                renderChannelList();
                await checkChannelsOnline();
                filterChannelList();
            } catch (err) {
                alert("Αποτυχία φόρτωσης playlist από το URL.");
                console.error("Failed to load playlist from URL:", err);
            }
        });
    }
    
    // Συμβάν: Αντιγραφή τρέχοντος URL στο clipboard
    if (copyUrlBtn && currentUrlInput) {
        copyUrlBtn.addEventListener('click', () => {
            currentUrlInput.select();
            try {
                document.execCommand('copy');
                // Εναλλακτικά (αν υποστηρίζεται το navigator.clipboard):
                // navigator.clipboard.writeText(currentUrlInput.value);
            } catch (err) {
                console.warn("Copy failed", err);
            }
            // Προαιρετικά, αποεπιλογή κειμένου ή εμφάνιση μηνύματος
        });
    }
    
    // Συμβάν: Καθαρισμός τρέχοντος URL (και διακοπή αναπαραγωγής)
    if (clearUrlBtn && currentUrlInput) {
        clearUrlBtn.addEventListener('click', () => {
            currentUrlInput.value = '';
            stopPlayback();
        });
    }
    
    // Συμβάν: Πίεση Enter στο πεδίο URL -> προσπάθεια άμεσης αναπαραγωγής αυτού του URL
    if (currentUrlInput) {
        currentUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const url = currentUrlInput.value.trim();
                if (url) {
                    const tempChannel = { name: 'Custom Stream', url: url, tvgLogo: '' };
                    playChannel(tempChannel);
                }
            }
        });
    }
    
    // Συμβάν: Φόρτωση υποτίτλων από επιλεγμένο αρχείο .srt
    if (subtitleFileInput && videoPlayer) {
        subtitleFileInput.addEventListener('change', () => {
            const file = subtitleFileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const srtText = reader.result;
                if (typeof srtText === 'string') {
                    const vttText = srtToVtt(srtText);
                    // Αφαίρεση προηγούμενων tracks υποτίτλων
                    const oldTracks = videoPlayer.querySelectorAll('track');
                    oldTracks.forEach(tr => tr.remove());
                    // Δημιουργία blob για το VTT
                    const vttBlob = new Blob([vttText], { type: 'text/vtt' });
                    const vttUrl = URL.createObjectURL(vttBlob);
                    // Δημιουργία στοιχείου track
                    const track = document.createElement('track');
                    track.kind = 'subtitles';
                    track.label = 'Υπότιτλοι';
                    track.srclang = 'el';
                    track.src = vttUrl;
                    track.default = true;
                    videoPlayer.appendChild(track);
                    // Βεβαιώσου ότι εμφανίζονται οι υπότιτλοι
                    if (track.track) {
                        track.track.mode = 'showing';
                    }
                }
            };
            reader.readAsText(file);
        });
    }
    
    // Έλεγχος ποια κανάλια είναι online κάνοντας προσπάθεια fetch στο URL τους (με χειρισμό CORS)
    async function checkChannelsOnline() {
        const checkPromises = channels.map(async (ch, index) => {
            if (!ch.url) {
                ch.isOnline = false;
                return;
            }
            try {
                // Πρώτα HEAD αίτημα
                let response = await fetch(ch.url, { method: 'HEAD' });
                if (!response.ok) {
                    // Αν το HEAD δεν είναι επιτυχές, δοκιμή με GET
                    response = await fetch(ch.url, { method: 'GET' });
                }
                ch.isOnline = response.ok;
            } catch (err) {
                // Δοκιμή μέσω proxy ως έσχατη λύση
                try {
                    const proxyResp = await fetch(CORS_PROXIES[1] + ch.url);
                    ch.isOnline = proxyResp.ok;
                } catch (err2) {
                    ch.isOnline = false;
                }
            }
        });
        await Promise.all(checkPromises);
    }
    
    // Αρχική εκκίνηση: φόρτωση playlist, μετά EPG, μετά απόδοση λίστας και περιοδικές ενημερώσεις
    (async function init() {
        await loadInitialPlaylist();
        if (!channels.length) {
            console.error("Δεν φορτώθηκαν κανάλια από κανένα playlist.");
        }
        renderChannelList();
        // Φόρτωση EPG XML
        try {
            const epgText = await fetchTextWithCors('https://ext.greektv.app/epg/epg.xml');
            const parser = new DOMParser();
            epgData = parser.parseFromString(epgText, "text/xml");
        } catch (err) {
            console.error("Αποτυχία φόρτωσης δεδομένων EPG:", err);
        }
        // Αποθήκευση προγραμμάτων EPG ανά κανάλι
        if (epgData) {
            channels.forEach(ch => {
                const chanId = ch.tvgId || ch.tvgName || (ch.name ? ch.name.replace(/\s+/g,'').toLowerCase() : '');
                if (!chanId) return;
                const progNodes = epgData.querySelectorAll(`programme[channel="${chanId}"]`);
                if (progNodes.length > 0) {
                    epgByChannel[chanId] = [];
                    progNodes.forEach(node => {
                        const titleNode = node.querySelector('title');
                        const descNode = node.querySelector('desc');
                        const start = node.getAttribute('start');
                        const stop = node.getAttribute('stop');
                        const title = titleNode ? titleNode.textContent : '';
                        const desc = descNode ? descNode.textContent : '';
                        const parseTime = (ts) => {
                            if (!ts) return null;
                            const year = ts.slice(0,4), month=ts.slice(4,6), day=ts.slice(6,8);
                            const hour=ts.slice(8,10), min=ts.slice(10,12), sec=ts.slice(12,14);
                            let offset = ts.length > 14 ? ts.slice(15) : '+0000';
                            if (offset.length === 5) {
                                offset = offset.slice(0,3)+':'+offset.slice(3);
                            }
                            return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}${offset}`);
                        };
                        epgByChannel[chanId].push({ 
                            start: parseTime(start),
                            stop: parseTime(stop),
                            title: title,
                            desc: desc
                        });
                    });
                }
            });
        }
        // Σήμανση καναλιών ως online/offline
        await checkChannelsOnline();
        // Ενεργοποίηση φίλτρου "Όλα" ως προεπιλογή
        if (filterAllBtn) {
            filterAllBtn.classList.add('active');
        }
        // Εφαρμογή αρχικού φίλτρου (πιθανώς εμφάνιση όλων)
        filterChannelList();
        // Ενημέρωση μπάρας προόδου αρχικά και ανά λεπτό
        updateAllProgressBars();
        setInterval(updateAllProgressBars, 60 * 1000);
    })();
});
