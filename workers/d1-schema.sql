PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'saved',
  source_url TEXT NOT NULL DEFAULT '',
  raw_m3u TEXT NOT NULL DEFAULT '',
  channel_count INTEGER NOT NULL DEFAULT 0,
  group_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tvg_id TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT 'Other',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  url TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'manual',
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_success TEXT,
  last_failure TEXT,
  startup_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, url),
  FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS my_playlist (
  channel_id TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_channel_sources_channel ON channel_sources(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_sources_enabled ON channel_sources(enabled, priority);
CREATE INDEX IF NOT EXISTS idx_my_playlist_position ON my_playlist(position);
