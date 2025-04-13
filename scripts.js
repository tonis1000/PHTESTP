async function playStream(streamURL, subtitleURL) {
    const videoPlayer = document.getElementById('video-player');
    const iframePlayer = document.getElementById('iframe-player');
    const clapprDiv = document.getElementById('clappr-player');
    const subtitleTrack = document.getElementById('subtitle-track');

    // Reset όλα
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    iframePlayer.src = '';
    if (clapprPlayer) clapprPlayer.destroy();
    subtitleTrack.src = '';
    subtitleTrack.track.mode = 'hidden';
    videoPlayer.style.display = 'none';
    iframePlayer.style.display = 'none';
    clapprDiv.style.display = 'none';

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
            iframePlayer.src = streamURL.includes('?') ? streamURL + '&autoplay=1' : streamURL + '?autoplay=1';
            iframePlayer.style.display = 'block';
            return;
        }
    }

    const playable = isPlayableFormat(streamURL);
    const workingURL = playable ? await autoProxyFetch(streamURL) : streamURL;

    // Αν δεν βρούμε λειτουργική, πάμε Clappr
    if (!workingURL) {
        clapprDiv.style.display = 'block';
        clapprPlayer = new Clappr.Player({
            source: streamURL,
            parentId: '#clappr-player',
            autoPlay: true,
            width: '100%',
            height: '100%',
        });
        return;
    }

    // Αν έχει υπότιτλους
    if (subtitleURL) {
        subtitleTrack.src = subtitleURL;
        subtitleTrack.track.mode = 'showing';
    }

    // --- Επιλογή player ---
    if (Hls.isSupported() && workingURL.endsWith('.m3u8')) {
        const hls = new Hls();
        hls.loadSource(workingURL);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play());
        videoPlayer.style.display = 'block';
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = workingURL;
        videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
        videoPlayer.style.display = 'block';
    } else if (workingURL.endsWith('.mpd')) {
        const dashPlayer = dashjs.MediaPlayer().create();
        dashPlayer.initialize(videoPlayer, workingURL, true);
        videoPlayer.style.display = 'block';
    } else if (videoPlayer.canPlayType('video/mp4') || videoPlayer.canPlayType('video/webm')) {
        videoPlayer.src = workingURL;
        videoPlayer.play();
        videoPlayer.style.display = 'block';
    } else {
        // Clappr fallback
        clapprDiv.style.display = 'block';
        clapprPlayer = new Clappr.Player({
            source: streamURL,
            parentId: '#clappr-player',
            autoPlay: true,
            width: '100%',
            height: '100%',
        });
    }
}
