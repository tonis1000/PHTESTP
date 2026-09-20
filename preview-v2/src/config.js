export const CONFIG = Object.freeze({
  appName: 'WebTV V2',
  cacheBaseUrl: 'https://tv-cache.atonis.workers.dev',
  epgUrl: 'https://epg-proxy-gr.atonis.workers.dev/epg.xml',
  channelCatalogUrl: './data/channels.m3u',
  healthStorageKey: 'webtv_v2_health',
  requestTimeoutMs: 9000,
  startupTimeoutMs: 12000,
  epgRefreshMs: 30 * 60 * 1000,
  healthMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  failureCooldownThreshold: 2,
  failureCooldownBaseMs: 15 * 60 * 1000,
  failureCooldownMaxMs: 6 * 60 * 60 * 1000,
  workerForHls: true,
  maxNextPrograms: 3,
});

export const OFFICIAL_LIVE = Object.freeze({
  ant1: 'https://www.antenna.gr/live',
});

export const CHANNEL_ALIASES = Object.freeze({
  ert1: ['ERT1.gr', 'ERT1.HD.gr', 'EPT1.gr', 'ΕΡΤ1'],
  ert2: ['ERT2.gr', 'ERT2.HD.gr', 'EPT2.gr', 'ΕΡΤ2'],
  ert3: ['ERT3.gr', 'ERT3.HD.gr', 'EPT3.gr', 'ΕΡΤ3'],
  ertnews: ['ERTNEWS.gr', 'ERT.NEWS.gr', 'ΕΡΤNEWS'],
  ant1: ['ANT1.gr', 'ANT1.HD.gr', 'Antenna1.gr'],
  alpha: ['ALPHA.gr', 'ALPHA.HD.gr', 'Alpha.gr', 'Alpha.HD.gr', 'alphatv'],
  skai: ['SKAI.gr', 'SKAI.HD.gr', 'skaitv'],
  open: ['OPEN.gr', 'OPEN.HD.gr', 'OPEN.BEYOND.HD.gr', 'opentv'],
  mega: ['MEGA.gr', 'MEGA.HD.gr', 'MegaChannel.gr', 'megatv'],
  star: ['STAR.gr', 'STAR.HD.gr', 'startv'],
  action24: ['ACTION24.gr', 'ACTION24.HD.gr'],
  kontra: ['KONTRA.gr', 'KONTRA.HD.gr'],
});
