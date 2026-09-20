# WebTV V2

A clean, browser-first WebTV application focused on resilient playback, channel identity, XMLTV EPG integration and source-health learning.

## Architecture

The application is split by responsibility:

- `src/core/channel-catalog.js` parses M3U channel metadata.
- `src/core/source-registry.js` resolves logical channels to stream sources and playback routes.
- `src/core/health-store.js` learns which sources/routes work best in this browser.
- `src/core/player.js` owns playback lifecycle, cancellation and HLS/DASH/native/iframe fallbacks.
- `src/core/epg.js` parses XMLTV and resolves channel aliases.
- `src/main.js` coordinates UI state only.

Playback flow:

`Channel → Sources → Health ranking → Direct/Worker routes → Player → Metrics`

## Running locally

The app uses native ES modules, so serve it through HTTP instead of opening `index.html` directly.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Backend dependencies

Centralized in `src/config.js`:

- `https://tv-cache.atonis.workers.dev/channel-streams.json`
- `https://tv-cache.atonis.workers.dev/?url=...`
- `https://epg-proxy-gr.atonis.workers.dev/epg.xml`

## Source health model

Successful playback records success/failure counts, last success, average startup latency, player and successful route (`direct`/`worker`). Data is stored only in browser `localStorage` and is used to rank future playback attempts.

## Engineering choices

- Version-pinned player libraries.
- No rotating public CORS-proxy chain in normal playback.
- Playback cancellation token prevents stale async work taking over after channel changes.
- UI and player logic are separate.
- External playlist data is rendered with DOM `textContent` rather than injected HTML.
- Third-party iframe/media discovery that needs scraping is intentionally kept out of browser code and belongs in a controlled Worker/service.

## Roadmap

1. Automated smoke tests and linting.
2. Optional Worker-side synchronization of source-health metrics.
3. Separate Viewer/Admin routes.
4. Favorites and persistent channel ordering.
5. Server-side controlled discovery for embedded streams.

## Disclaimer

This application does not host or redistribute media. Stream availability, rights and legality remain the responsibility of the respective source/content provider. Use only sources you are authorized to access.
