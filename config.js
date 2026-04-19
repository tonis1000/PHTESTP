const config = {
  apiUrls: {
    tvCache: 'http://example.com/tv-cache',
    epgProxy: 'http://example.com/epg-proxy',
    playlistSources: 'http://example.com/playlist-sources'
  },
  timeouts: {
    epgFetch: 3000,
    streamProbe: 2000,
    nestedProbe: 1500,
    tsRange: 500,
    m3u8Discovery: 2500,
    generalFetch: 1000
  },
  cacheSettings: {
    epgKey: 'your_epg_key',
    sidebarOrderKey: 'your_sidebar_order_key',
    epgTtlMs: 3600000 // 1 hour
  },
  uiRefreshIntervals: {
    clock: 60000,       // 1 minute
    epgTimelines: 30000, // 30 seconds
    streamStatus: 10000  // 10 seconds
  },
  hlsConfig: {
    buffer: {
      min: 0.3,
      max: 1.5
    },
    live: true,
    behavior: 'playback',
    loadingTimeout: 30000,
    retries: 3,
    prefetch: {
      enabled: true,
      interval: 5000
    }
  },
  debugMode: false,
  proxyList: ['', 'http://proxy1.com', 'http://proxy2.com'] // public proxies
};

export default config;