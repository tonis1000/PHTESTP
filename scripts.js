
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

// Funktion zum Laden der Sport-Playlist und Aktualisieren der Sidebar
function loadSportPlaylist() {
    alert("Funktionalität für Sport-Playlist wird implementiert...");
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
    const groupDropdown = document.getElementById('group-dropdown'); // Dropdown für Sendergruppen
    sidebarList.innerHTML = '';
    groupDropdown.innerHTML = '<option value="">Alle Gruppen</option>'; // Leere Auswahloption

    const extractStreamURLs = (data) => {
        const urls = {};
        const lines = data.split('\n');
        let currentChannelId = null;
        let currentChannelName = null;
        let currentGroupTitle = null;

        lines.forEach(line => {
            if (line.startsWith('#EXTINF')) {
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                const nameMatch = line.match(/tvg-name="([^"]+)"/);
                currentChannelId = idMatch ? idMatch[1] : null;
                currentChannelName = nameMatch ? nameMatch[1] : currentChannelId;

                const groupMatch = line.match(/group-title="([^"]+)"/);
                currentGroupTitle = groupMatch ? groupMatch[1] : 'Unbekannt';

                if (currentChannelName && !urls[currentChannelName]) {
                    urls[currentChannelName] = { streamURLs: [], groupTitle: currentGroupTitle };
                }
            } else if (currentChannelName && line.startsWith('http')) {
                urls[currentChannelName].streamURLs.push(line.trim());
                currentChannelName = null;
            }
        });

        return urls;
    };

    const streamURLs = extractStreamURLs(data);
    const lines = data.split('\n');

    const groups = new Set();

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF')) {
            const idMatch = lines[i].match(/tvg-id="([^"]+)"/);
            const nameMatch = lines[i].match(/tvg-name="([^"]+)"/);
            const channelId = idMatch ? idMatch[1] : null;
            const channelName = nameMatch ? nameMatch[1] : channelId || 'Unbekannt';

            const imgMatch = lines[i].match(/tvg-logo="([^"]+)"/);
            const imgURL = imgMatch ? imgMatch[1] : 'default_logo.png';

            const groupMatch = lines[i].match(/group-title="([^"]+)"/);
            const groupTitle = groupMatch ? groupMatch[1] : 'Unbekannt';
            groups.add(groupTitle);

            const streamURL = lines[i + 1]?.startsWith('http') ? lines[i + 1].trim() : null;

            if (streamURL) {
                const listItem = document.createElement('li');
                listItem.classList.add(groupTitle); // CSS-Klasse für Gruppe
                listItem.innerHTML = `
                    <div class="channel-info" data-stream="${streamURL}" data-channel-id="${channelId}">
                        <div class="logo-container">
                            <img src="${imgURL}" alt="${channelName} Logo">
                        </div>
                        <span class="sender-name">${channelName}</span>
                        <span class="status-indicator">Prüfen...</span>
                    </div>
                `;
                sidebarList.appendChild(listItem);

                // Online-Check durchführen
                checkStreamStatus(streamURL, listItem);
            }
        }
    }

    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupDropdown.appendChild(option);
    });

    groupDropdown.addEventListener('change', (e) => {
        const selectedGroup = e.target.value;
        const items = sidebarList.getElementsByTagName('li');
        for (let i = 0; i < items.length; i++) {
            if (selectedGroup === '' || items[i].classList.contains(selectedGroup)) {
                items[i].style.display = ''; // Zeige Element
            } else {
                items[i].style.display = 'none'; // Verberge Element
            }
        }
    });
}

// Funktion zum Prüfen des Stream-Status
async function checkStreamStatus(url, listItem) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const statusElement = listItem.querySelector('.status-indicator');
        if (response.ok) {
            statusElement.textContent = 'Online';
            statusElement.style.color = 'green';
        } else {
            statusElement.textContent = 'Offline';
            statusElement.style.color = 'red';
        }
    } catch (error) {
        const statusElement = listItem.querySelector('.status-indicator');
        statusElement.textContent = 'Offline';
        statusElement.style.color = 'red';
    }
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





function playStream(streamURL) {
    console.log(`Versuche Stream abzuspielen: ${streamURL}`);

    // Video-Player initialisieren
    const videoPlayer = document.getElementById('video-player');

    // Vorherigen Stream entladen
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.load();

    // HLS mit HLS.js abspielen
    if (Hls.isSupported() && streamURL.endsWith('.m3u8')) {
        const hls = new Hls();
        hls.loadSource(streamURL);
        hls.attachMedia(videoPlayer);

        // Event: Stream erfolgreich geladen
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            console.log('HLS Stream erfolgreich geladen.');
            videoPlayer.play();
        });

        // Event: Fehlerbehandlung
        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS.js Fehler:', data);
        });
        return;
    }

    // HLS direkt für Safari
    if (videoPlayer.canPlayType('application/vnd.apple.mpegurl') && streamURL.endsWith('.m3u8')) {
        videoPlayer.src = streamURL;

        const onLoadedMetadata = () => {
            console.log('HLS Stream (Safari) erfolgreich geladen.');
            videoPlayer.play();
            videoPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
        };

        videoPlayer.addEventListener('loadedmetadata', onLoadedMetadata);
        return;
    }

    // MPEG-DASH abspielen
    if (streamURL.endsWith('.mpd')) {
        const dashPlayer = dashjs.MediaPlayer().create();
        dashPlayer.initialize(videoPlayer, streamURL, true);

        // Event: Fehlerbehandlung
        dashPlayer.on('error', (e) => {
            console.error('DASH.js Fehler:', e);
        });

        console.log('MPEG-DASH Stream erfolgreich geladen.');
        return;
    }

    // MP4 oder WebM abspielen
    if (videoPlayer.canPlayType('video/mp4') || videoPlayer.canPlayType('video/webm')) {
        videoPlayer.src = streamURL;
        videoPlayer.load();
        videoPlayer.play();
        console.log('MP4/WebM Stream erfolgreich geladen.');
        return;
    }

    // Fallback für nicht unterstützte Formate
    alert('Dieses Format wird von Ihrem Browser nicht unterstützt.');
    console.error('Stream-Format wird vom aktuellen Browser nicht unterstützt.');
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
