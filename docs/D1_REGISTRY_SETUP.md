# WebTV V2 · Cloudflare D1 Central Library

This adds a central writable library for **My Playlist**, saved external playlists, and a generated public `playlist.m3u`.

## Files

- `workers/registry-worker.js` — D1-backed API Worker
- `workers/d1-schema.sql` — database schema
- `workers/wrangler.registry.example.toml` — optional Wrangler example

## Cloudflare Dashboard setup

1. Create a D1 database named `webtv-registry`.
2. Open its SQL console and run the full contents of `workers/d1-schema.sql`.
3. Create a new Worker, for example `webtv-registry`.
4. Replace its code with the full contents of `workers/registry-worker.js` and deploy it.
5. In Worker **Bindings**, add the D1 database with variable name exactly `DB`.
6. In Worker **Variables and Secrets**, add a secret named exactly `ADMIN_TOKEN`. Use a long random value. Never commit this token to GitHub.
7. Optional: add a normal variable `ALLOWED_ORIGIN` with value `https://tonis1000.github.io`.
8. Deploy once more after bindings/secrets are configured.

## Verify

Open:

`https://YOUR-REGISTRY-WORKER.workers.dev/api/status`

Expected shape:

```json
{
  "ok": true,
  "service": "WebTV Registry",
  "version": "1.2",
  "d1": true
}
```

The generated curated playlist is:

`https://YOUR-REGISTRY-WORKER.workers.dev/playlist.m3u`

## Connect WebTV

Open **Playlists → My Playlist → Cloudflare D1 Library**.

Enter:

- Registry URL: `https://YOUR-REGISTRY-WORKER.workers.dev`
- Admin token: the same value stored as the Worker secret `ADMIN_TOKEN`

Then use:

- **Test connection** — checks the D1 Worker
- **Push local → D1** — uploads My Playlist + Saved Playlists
- **Pull from D1** — restores them on another browser/device
- **Open /playlist.m3u** — opens the centrally generated My Playlist

The admin token is stored only in that browser's local storage. It is not written to the repository.

## API summary

Public reads:

- `GET /api/status`
- `GET /api/playlists` — saved-playlist metadata only
- `GET /api/my-playlist`
- `GET /playlist.m3u`

Admin-token protected:

- `POST /api/playlists`
- `GET /api/playlists/:id` — includes raw M3U
- `DELETE /api/playlists/:id`
- `PUT /api/my-playlist/channel`
- `DELETE /api/my-playlist/channel/:id`
- `POST /api/my-playlist/replace`

## Behavior

- External playlists remain independent libraries.
- **My Playlist** is the editable curated list.
- Selecting a channel from any loaded playlist shows **Add to My Playlist** in the channel header.
- Channels already in My Playlist can be removed from the same button.
- Inside Playlist Manager, My Playlist channels support **Edit**, **Sources**, and **Remove**.
- A verified Source Hunt result saved with **Save Source** is also added to that channel inside My Playlist.
- When D1 is configured, My Playlist edits and verified saved sources can sync centrally.
