import { CONFIG } from '../config.js';
import { isHls, isDash, isVideoFile } from './utils.js';

export class PlayerController {
  constructor({ video, iframe, emptyState, health, onState, onDiagnostics }) {
    this.video = video;
    this.iframe = iframe;
    this.emptyState = emptyState;
    this.health = health;
    this.onState = onState || (() => {});
    this.onDiagnostics = onDiagnostics || (() => {});
    this.hls = null;
    this.dash = null;
    this.token = 0;
  }

  async play(channel, routes) {
    const token = ++this.token;
    this.#resetMedia();
    this.onState('loading', 'Connecting');
    if (!routes.length) {
      this.onState('error', 'No active routes');
      throw new Error(`No active playback routes for ${channel.name}`);
    }
    let lastError = null;
    for (const route of routes) {
      if (token !== this.token) return;
      const startedAt = performance.now();
      try {
        const player = await this.#attempt(route, token);
        const startupMs = Math.round(performance.now() - startedAt);
        this.health.recordSuccess(route.playbackUrl, { startupMs, player, route: route.route });
        this.onDiagnostics({ source: route.originalUrl, route: route.route, player, startupMs });
        this.onState('live', 'Live');
        return;
      } catch (error) {
        if (token !== this.token) return;
        lastError = error;
        const entry = this.health.recordFailure(route.playbackUrl);
        const cooling = (entry.cooldownUntil || 0) > Date.now();
        this.onDiagnostics({ source: route.originalUrl, route: route.route, player: 'failed', startupMs: 0, error: cooling ? `${error.message} · cooldown` : error.message });
        this.#resetMedia();
      }
    }
    this.onState('error', 'Playback failed');
    throw lastError || new Error('All playback routes failed');
  }

  stop() {
    this.token += 1;
    this.#resetMedia();
    this.onState('idle', 'Idle');
  }

  #resetMedia() {
    if (this.hls) { try { this.hls.destroy(); } catch {} this.hls = null; }
    if (this.dash) { try { this.dash.reset(); } catch {} this.dash = null; }
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.hidden = true;
    this.iframe.onload = null;
    this.iframe.onerror = null;
    this.iframe.src = 'about:blank';
    this.iframe.hidden = true;
    this.emptyState.hidden = false;
  }

  async #attempt(route, token) {
    const url = route.playbackUrl;
    if (isHls(url)) return this.#playHls(url, token);
    if (isDash(url)) return this.#playDash(url, token);
    if (isVideoFile(url)) return this.#playNative(url, token, 'native-video');
    throw new Error('Unsupported non-media source');
  }

  #showVideo() {
    this.emptyState.hidden = true;
    this.iframe.hidden = true;
    this.video.hidden = false;
  }

  #waitForVideo(token, playerName) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        this.video.removeEventListener('playing', onPlaying);
        this.video.removeEventListener('error', onError);
      };
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const onPlaying = () => token === this.token ? done(resolve, playerName) : done(reject, new Error('Superseded'));
      const onError = () => done(reject, new Error(`${playerName} media error`));
      const timeout = setTimeout(() => done(reject, new Error(`${playerName} startup timeout`)), CONFIG.startupTimeoutMs);
      this.video.addEventListener('playing', onPlaying, { once: true });
      this.video.addEventListener('error', onError, { once: true });
    });
  }

  async #playHls(url, token) {
    this.#showVideo();
    if (window.Hls?.isSupported()) {
      this.hls = new window.Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 10,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        manifestLoadingTimeOut: CONFIG.requestTimeoutMs,
        levelLoadingTimeOut: CONFIG.requestTimeoutMs,
        fragLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 3,
      });
      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);
      this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (token === this.token) this.video.play().catch(() => {});
      });
      return this.#waitForVideo(token, 'hls.js');
    }
    if (this.video.canPlayType('application/vnd.apple.mpegurl')) return this.#playNative(url, token, 'native-hls');
    throw new Error('HLS is not supported');
  }

  async #playDash(url, token) {
    if (!window.dashjs?.MediaPlayer) throw new Error('dash.js unavailable');
    this.#showVideo();
    this.dash = window.dashjs.MediaPlayer().create();
    this.dash.initialize(this.video, url, true);
    return this.#waitForVideo(token, 'dash.js');
  }

  async #playNative(url, token, name) {
    this.#showVideo();
    this.video.src = url;
    this.video.load();
    this.video.play().catch(() => {});
    return this.#waitForVideo(token, name);
  }
}
