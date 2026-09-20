# WebTV V2 Architecture

## Design goal

Keep channel identity independent from stream URLs. A channel is a logical entity; stream URLs are replaceable sources attached to it.

## Runtime layers

### Catalog
Provides channel metadata (`id`, name, logo, group) from M3U.

### Source registry
Combines catalog metadata with the remote `channel-streams.json` map. It expands each source into playback routes such as direct and Cloudflare Worker.

### Health store
Scores original source URLs based on historical success ratio, recency and startup speed. Successful routing information is reused as a fast-path hint.

### Player
Owns all media resources. Before every attempt it tears down HLS.js, dash.js, native video and iframe state. A monotonic token invalidates stale asynchronous playback work.

### EPG
Parses XMLTV timestamps with explicit timezone handling and maintains a channel resolver based on IDs, display names and configured aliases.

### UI coordinator
`main.js` orchestrates state and rendering but does not implement transport, parsing or playback algorithms.

## Important invariant

No UI component decides which stream is best. It asks SourceRegistry for ranked playback routes and asks PlayerController to execute them.

## Server-side boundary

Browser code should not scrape embedded pages or depend on rotating public CORS proxies. Discovery that requires fetching third-party HTML belongs in a controlled Worker/service that returns normalized candidate sources to the browser.
