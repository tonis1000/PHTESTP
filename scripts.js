// Function to load the playlist.m3u and update the sidebar
function loadMyPlaylist() {
    fetch('playlist.m3u')
        .then(response => response.text())
        .then(data => updateSidebarFromM3U(data))
        .catch(error => console.error('Error loading playlist:', error));
}

// Function to load the external playlist and update the sidebar
function loadExternalPlaylist() {
    fetch('https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR')
        .then(response => response.text())
        .then(data => updateSidebarFromM3U(data))
        .catch(error => console.error('Error loading external playlist:', error));
}

// Function to load the sport playlist and update the sidebar (currently just an alert)
function loadSportPlaylist() {
    alert("Functionality for sport playlist is being implemented...");
}

// Playlist Button
document.getElementById('playlist-button').addEventListener('click', function() {
    const playlistURL = document.getElementById('stream-url').value;
    if (playlistURL) {
        fetchResource(playlistURL);
    }
});

// Function to fetch the resource
async function fetchResource(url) {
    let finalUrl = url;

    try {
        // Attempt using CORS proxy
        console.log('Trying with CORS proxy...');
        let response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);

        // If response is not OK, try changing URL to HTTPS
        if (!response.ok) {
            console.log('CORS proxy request failed, trying HTTPS...');
            finalUrl = finalUrl.replace('http:', 'https:');
            response = await fetch('https://cors-anywhere.herokuapp.com/' + finalUrl);
        }

        // If still not OK, throw an error
        if (!response.ok) {
            throw new Error('Network response was not okay');
        }

        const data = await response.text();
        updateSidebarFromM3U(data);
    } catch (error) {
        console.error('Error loading playlist with CORS proxy:', error);
    }

    try {
        // Attempt without CORS proxy
        console.log('Trying without CORS proxy...');
        let response = await fetch(finalUrl);

        // If response is not OK, try changing URL to HTTPS
        if (!response.ok) {
            console.log('Direct request failed, trying HTTPS...');
            finalUrl = finalUrl.replace('http:', 'https:');
            response = await fetch(finalUrl);
        }

        // If still not OK, throw an error
        if (!response.ok) {
            throw new Error('Network response was not okay');
        }

        const data = await response.text();
        updateSidebarFromM3U(data);
    } catch (error) {
        console.error('Error loading playlist without CORS proxy:', error);
    }
}

// Clear Button
document.getElementById('clear-button').addEventListener('click', () => {
    document.getElementById('stream-url').value = ''; // Clear input field
});

// Copy Button
document.getElementById('copy-button').addEventListener('click', () => {
    const streamUrlInput = document.getElementById('stream-url');
    streamUrlInput.select(); // Select text in the input field
    document.execCommand('copy'); // Copy selected text to clipboard
});

// Global object for EPG data
let epgData = {};

// Function to load and parse EPG data
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
                    const desc = descElement ? descElement.textContent : 'No description available';

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
        .catch(error => console.error('Error loading EPG data:', error));
}

// Helper function to convert EPG time into Date objects
function parseDateTime(epgTime) {
    if (!epgTime || epgTime.length < 19) {
        console.error('Invalid EPG time format:', epgTime);
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
        console.error('Invalid EPG time format:', epgTime);
        return null;
    }

    const date = new Date(Date.UTC(year, month, day, hour - tzHour, minute - tzMin, second));
    return date;
}

// Function to find the current program based on time
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
            const description = currentProgram.desc || 'No description available';
            const start = currentProgram.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const end = currentProgram.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const title = currentProgram.title.replace(/\s*\[.*?\]\s*/g, '').replace(/\[\[.*?\]\]/g, ''); // Title without brackets

            return {
                title: `${title} (${start} - ${end})`, // Clean title
                description: description,
                pastPercentage: pastPercentage,
                futurePercentage: futurePercentage
            };
        } else {
            return {
                title: 'No current program available',
                description: 'No description available',
                pastPercentage: 0,
                futurePercentage: 0
            };
        }
    }
    return {
        title: 'No EPG data available',
        description: 'No description available',
        pastPercentage: 0,
        futurePercentage: 0
    };
}

// Function to update player with program description
function updatePlayerDescription(title, description) {
    console.log('Updating player description:', title, description);
    document.getElementById('program-title').textContent = title;
    document.getElementById('program-desc').textContent = description;
}

// Function to update the next programs
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
            const title = program.title.replace(/\s*\[.*?\]\s*/g, '').replace(/\[\[.*?\]\]/g, '');
            nextProgramTitle.textContent = `${title} (${start} - ${end})`;

            const nextProgramDesc = document.createElement('p');
            nextProgramDesc.classList.add('next-program-desc');
            nextProgramDesc.textContent = program.desc || 'No description available';
            nextProgramDesc.style.display = 'none'; // Hidden by default

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

// Click event handler for selecting a channel
const sidebarList = document.getElementById('sidebar-list');
sidebarList.addEventListener('click', function(event) {
    const channelInfo = event.target.closest('.channel-info');
    if (channelInfo) {
        const channelId = channelInfo.dataset.channelId;
        const programInfo = getCurrentProgram(channelId);

        // Update player with current broadcast
        setCurrentChannel(channelInfo.querySelector('.sender-name').textContent, channelInfo.dataset.stream);
        playStream(channelInfo.dataset.stream);

        // Update program description
        updatePlayerDescription(programInfo.title, programInfo.description);

        // Update next programs
        updateNextPrograms(channelId);

        // Display the selected channel's logo
        const logoContainer = document.getElementById('current-channel-logo');
        const logoImg = channelInfo.querySelector('.logo-container img').src;
        logoContainer.src = logoImg;
    }
});

// Function to update the sidebar from an M3U file
async function updateSidebarFromM3U(data) {
    const sidebarList = document.getElementById('sidebar-list');
    const groupDropdown = document.getElementById('group-dropdown');
    sidebarList.innerHTML = '';

    // Function to extract stream URLs, group information and TVG id or TVG name
    const extractStreamURLs = (data) => {
        const urls = {};
        const groupTitles = new Set(); // Set for group titles
        const lines = data.split('\n');
        let currentChannelId = null;
        let currentGroupTitle = null;

        lines.forEach(line => {
            if (line.startsWith('#EXTINF')) {
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                const nameMatch = line.match(/,(.*)$/);
                const groupMatch = line.match(/group-title="([^"]+)"/);

                // Use tvg-id if present, otherwise tvg-name
                currentChannelId = idMatch ? idMatch[1] : nameMatch ? nameMatch[1] : null;
                currentGroupTitle = groupMatch ? groupMatch[1] : 'Unknown';

                if (currentChannelId && !urls[currentChannelId]) {
                    urls[currentChannelId] = { streamURLs: [], groupTitle: currentGroupTitle };
                    groupTitles.add(currentGroupTitle); // Add group title to the set
                }
            } else if (currentChannelId && line.startsWith('http')) {
                urls[currentChannelId].streamURLs.push(line);
                currentChannelId = null;
            }
        });

        return { urls, groupTitles };
    };

    const { urls, groupTitles } = extractStreamURLs(data);

    // Add groups to the dropdown
    groupDropdown.innerHTML = '<option value="all">All Groups</option>';
    groupTitles.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupDropdown.appendChild(option);
    });

    const lines = data.split('\n');
    const addStreamToSidebar = async (channelId, streamURL, name, imgURL, groupTitle) => {
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
            console.error(`Error retrieving EPG data for channel ID ${channelId}:`, error);
        }
    };

    // Iterate through each line and add channels to the sidebar
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF')) {
            const idMatch = lines[i].match(/tvg-id="([^"]+)"/);
            const nameMatch = lines[i].match(/,(.*)$/);
            const name = nameMatch ? nameMatch[1].trim() : 'Unknown';

            const imgMatch = lines[i].match(/tvg-logo="([^"]+)"/);
            const imgURL = imgMatch ? imgMatch[1] : 'default_logo.png';

            const streamURL = lines[i + 1].startsWith('http') ? lines[i + 1].trim() : null;
            const groupTitle = urls[idMatch ? idMatch[1] : nameMatch ? nameMatch[1] : '']?.groupTitle || 'Unknown';

            if (streamURL) {
                await addStreamToSidebar(idMatch ? idMatch[1] : nameMatch ? nameMatch[1] : '', streamURL, name, imgURL, groupTitle);
            }
        }
    }

    // Check the online status of streams
    checkStreamStatus();

    // Add event listener to the dropdown to filter the sidebar accordingly
    groupDropdown.addEventListener('change', () => {
        const selectedGroup = groupDropdown.value;
        sidebarList.innerHTML = '';

        for (let channelId in urls) {
            const { streamURLs, groupTitle } = urls[channelId];
            if (selectedGroup === 'all' || groupTitle === selectedGroup) {
                const name = lines.find(line => line.includes(`tvg-id="${channelId}"`))?.split(',')[1]?.trim() || 'Unknown';
                const imgURL = lines.find(line => line.includes(`tvg-id="${channelId}"`))?.match(/tvg-logo="([^"]+)"/)?.[1] || 'default_logo.png';
                const streamURL = streamURLs[0]; // Take the first stream (if multiple are present)

                addStreamToSidebar(channelId, streamURL, name, imgURL, groupTitle);
            }
        }
    });
}

// Function to check the status of streams and mark the entire sidebar entries
function checkStreamStatus() {
    const sidebarChannels = document.querySelectorAll('.channel-info');
    sidebarChannels.forEach(channel => {
        const streamURL = channel.dataset.stream;
        if (streamURL) {
            fetch(streamURL)
                .then(response => {
                    if (response.ok) {
                        channel.classList.add('online'); // Mark entire sidebar entry
                        channel.querySelector('.sender-name').style.color = 'lightgreen'; // Change sender name text color
                        channel.querySelector('.sender-name').style.fontWeight = 'bold'; // Change sender name font weight
                    } else {
                        channel.classList.remove('online'); // Remove mark
                        channel.querySelector('.sender-name').style.color = ''; // Reset sender name text color
                        channel.querySelector('.sender-name').style.fontWeight = ''; // Reset sender name font weight
                    }
                })
                .catch(error => {
                    console.error('Error checking stream status:', error);
                    channel.classList.remove('online'); // Remove mark on error
                    channel.querySelector('.sender-name').style.color = ''; // Reset sender name text color
                    channel.querySelector('.sender-name').style.fontWeight = ''; // Reset sender name font weight
                });
        }
    });
}

// Event handler for clicking senders
document.addEventListener('DOMContentLoaded', function () {
    const sidebarList = document.getElementById('sidebar-list');

    sidebarList.addEventListener('click', function (event) {
        const channelInfo = event.target.closest('.channel-info');
        if (channelInfo) {
            const channelId = channelInfo.dataset.channelId;
            const programInfo = getCurrentProgram(channelId);
            const streamURL = channelInfo.dataset.stream;

            // Update player with current show
            setCurrentChannel(channelInfo.querySelector('.sender-name').textContent, streamURL);
            playStream(streamURL);
            updatePlayerDescription(programInfo.title, programInfo.description); // Update program description
            updateNextPrograms(channelId); // Update next programs

            const logoContainer = document.getElementById('current-channel-logo');
            const logoImg = channelInfo.querySelector('.logo-container img').src;
            logoContainer.src = logoImg; // Show selected channel logo
        }
    });

    loadEPGData();
    setInterval(updateClock, 1000);
    setInterval(checkStreamStatus, 60000); // Check stream statuses every minute
});

// Function to set the current channel name and URL
function setCurrentChannel(channelName, streamUrl) {
    document.getElementById('current-channel-name').textContent = channelName; // Set channel name
    document.getElementById('stream-url').value = streamUrl; // Set stream URL
}

// Clock update function
function updateClock() {
    const now = new Date();
    document.getElementById('tag').textContent = now.toLocaleDateString('de-DE', { weekday: 'long' });
    document.getElementById('datum').textContent = now.toLocaleDateString('de-DE');
    document.getElementById('uhrzeit').textContent = now.toLocaleTimeString('de-DE', { hour12: false });
}

// Stream playing function
function playStream(streamURL) {
    console.log(`Attempting to play stream: ${streamURL}`);
    const videoPlayer = document.getElementById('video-player');

    // Unload previous stream
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.load();

    // Play HLS if supported
    if (Hls.isSupported() && streamURL.endsWith('.m3u8')) {
        const hls = new Hls();
        hls.loadSource(streamURL);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            console.log('HLS stream successfully loaded.');
            videoPlayer.play();
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS.js error:', data);
        });
        return;
    }

    // Direct HLS play for Safari
    if (videoPlayer.canPlayType('application/vnd.apple.mpegurl') && streamURL.endsWith('.m3u8')) {
        videoPlayer.src = streamURL;
        const onLoadedMetadata = () => {
            console.log('HLS stream (Safari) successfully loaded.');
            videoPlayer.play();
            videoPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
        videoPlayer.addEventListener('loadedmetadata', onLoadedMetadata);
        return;
    }

    // Play MPEG-DASH
    if (streamURL.endsWith('.mpd')) {
        const dashPlayer = dashjs.MediaPlayer().create();
        dashPlayer.initialize(videoPlayer, streamURL, true);
        dashPlayer.on('error', (e) => {
            console.error('DASH.js error:', e);
        });
        console.log('MPEG-DASH stream successfully loaded.');
        return;
    }

    // Play MP4 or WebM
    if (videoPlayer.canPlayType('video/mp4') || videoPlayer.canPlayType('video/webm')) {
        videoPlayer.src = streamURL;
        videoPlayer.load();
        videoPlayer.play();
        console.log('MP4/WebM stream successfully loaded.');
        return;
    }

    // Fallback for unsupported formats
    alert('This format is not supported by your browser.');
    console.error('Stream format is not supported by the current browser.');
}

// Function for handling subtitle files
function handleSubtitleFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const srtContent = event.target.result;
        const vttContent = convertSrtToVtt(srtContent);
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        const track = document.getElementById('subtitle-track');
        track.src = url;
        track.label = 'Greek';
        track.srclang = 'el';
        track.default = true;
    };
    reader.readAsText(file);
}

// Function for converting SRT to VTT
function convertSrtToVtt(srtContent) {
    // Convert SRT subtitle lines to VTT format
    const vttContent = 'WEBVTT\n\n' + srtContent
        .replace(/\r\n|\r|\n/g, '\n') // Replace line breaks
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4'); // Replace time formats from SRT to VTT

    return vttContent;
}

// Event-Listener for the Play-Button and file input
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

// Toggle content function
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

// Function to load playlist URLs from playlist-urls.txt and update sidebar
function loadPlaylistUrls() {
    fetch('playlist-urls.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            return response.text();
        })
        .then(data => {
            const playlistList = document.getElementById('playlist-url-list');
            playlistList.innerHTML = ''; // Clear the list for new entries

            const lines = data.split('\n');
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const [label, url] = trimmedLine.split(',').map(part => part.trim());
                    if (label && url) {
                        const li = document.createElement('li');
                        const link = document.createElement('a');
                        link.textContent = label;
                        link.href = '#'; // Prevent link from reloading the page
                        link.addEventListener('click', function(event) {
                            event.preventDefault(); // Prevent link from reloading the page
                            document.getElementById('stream-url').value = url; // Set URL in stream-url input

                            // Fetch the URL and update the sidebar
                            console.log('Attempting URL retrieval:', url); // Debugging log
                            fetch(url)
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Network response was not ok.');
                                    }
                                    return response.text();
                                })
                                .then(data => {
                                    console.log('Data successfully loaded. Processing M3U data.'); // Debugging log
                                    updateSidebarFromM3U(data);
                                })
                                .catch(error => {
                                    console.error('Error loading playlist:', error);
                                    alert('Error loading playlist. See console for details.'); // Optional: Inform user
                                });
                        });

                        li.appendChild(link);
                        playlistList.appendChild(li);
                    } else {
                        console.warn('Line has no label or URL:', trimmedLine); // Debug log for empty lines
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error loading playlist URLs:', error);
            alert('Error loading playlist URLs. See console for details.'); // Optional: Inform user
        });
}

// Event listener for click on playlist URL title
document.addEventListener('DOMContentLoaded', function() {
    const playlistUrlsTitle = document.querySelector('.content-title[onclick="toggleContent(\'playlist-urls\')"]');
    if (playlistUrlsTitle) {
        playlistUrlsTitle.addEventListener('click', loadPlaylistUrls);
    } else {
        console.error('Element for click event listener not found.');
    }
});
