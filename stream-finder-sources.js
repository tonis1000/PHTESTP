/* stream-finder-sources.js
   =========================================================
   Structured source store for Stream Finder
   ========================================================= */

const streamFinderSources = {
  ert1: [
    {
      url: "https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT1/default/index.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary ERT1 source"
    },
    {
      url: "https://cdn4.smart-tv-data.com/vid/ert1/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    },
    {
      url: "http://www.anacon.org/app/chans/gr/ert1s2image.php",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Web image/player source"
    },
    {
      url: "http://195.226.218.163/vid/ert1/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Legacy backup"
    }
  ],

  ert2: [
    {
      url: "https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT2/default/index.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary ERT2 source"
    },
    {
      url: "http://www.anacon.org/app/chans/gr/ert2s2image.php",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Web image/player source"
    },
    {
      url: "https://wow.anixa.tv/live/ert2/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    }
  ],

  ert3: [
    {
      url: "https://ert-live.ascdn.broadpeak.io/bpk-tv/ERT3/default/index.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary ERT3 source"
    },
    {
      url: "https://ertflix.akamaized.net/ertlive/ert3/clrdef24828n/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    },
    {
      url: "http://www.anacon.org/app/chans/gr/ert3s2image.php",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Web image/player source"
    }
  ],

  ertnews: [
    {
      url: "https://ertflix.akamaized.net/ertlive/ertnews/default/playlist.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary ERT News source"
    }
  ],

  ant1: [
    {
      url: "https://spark3.smart-tv-data.com/ant1HD/ant1HD/playlist.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary ANT1 source"
    },
    {
      url: "https://cdn1.smart-tv-data.com/live/ant1_srt/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    },
    {
      url: "https://anacon.org/app/chans/gr/ant1image.php",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Web image/player source"
    }
  ],

  alpha: [
    {
      url: "https://alphatvlive2.siliconweb.com/alphatvlive/live_abr/playlist.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary Alpha source"
    },
    {
      url: "https://alphatvlive.siliconweb.com/1/Y2Rsd1lUcUVoajcv/UVdCN25h/hls/live/playlist.m3u",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    },
    {
      url: "https://spark3.smart-tv-data.com/alphaHD/alphaHD/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    },
    {
      url: "https://cdn1.smart-tv-data.com/live/alpha/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    },
    {
      url: "http://www.anacon.org/app/chans/gr/alphaimage.php",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Web image/player source"
    }
  ],

  skai: [
    {
      url: "http://skai-live.siliconweb.com/media/cambria4/index.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary SKAI source"
    },
    {
      url: "https://skai-live-back.siliconweb.com/media/cambria4/index.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    }
  ],

  open: [
    {
      url: "https://liveopencloud.siliconweb.com/1/ZlRza2R6L2tFRnFJ/eWVLSlQx/hls/live/playlist.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary OPEN source"
    },
    {
      url: "https://liveopen.siliconweb.com/openTvLive/liveopen/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    }
  ],

  mega: [
    {
      url: "https://www.lakatamia.tv/app/chans/gr/megaimage.php",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Web image/player source"
    },
    {
      url: "https://embed.vindral.com/?core.channelId=alteregomedia_megatv1_ci_6cc490c7-e5c6-486b-acf0-9bb9c20fa670&core.minBufferTime=2000&player.aspectRatio=16:9",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Embed source"
    }
  ],

  star: [
    {
      url: "https://livestar.siliconweb.com/media/star4/star4newhd.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary Star source"
    },
    {
      url: "https://spark3.smart-tv-data.com/starHD/starHD/playlist.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Backup"
    },
    {
      url: "https://livestar.siliconweb.com/media/star1/star1.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Alternative feed"
    },
    {
      url: "https://s2.cystream.net/galanos/star/chunks.m3u8?nimblesessiontvg-id=783489&wmsAuthSign=c2VydmVyX3RpbWU9MTEvMjAvMjAyMyAxMDoyNTozOCBQTSZoYXNoX3ZhbHVlPWNrMUg2TjRVWlZGR0t4V1k2QXVhWFE9PSZ2YWxpZG1pbnV0ZXM9MjA=",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Alternative feed"
    },
    {
      url: "https://www.lakatamia.tv/app/chans/gr/stargreece.php",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Web image/player source"
    }
  ],

  maktv: [
    {
      url: "http://dlm34ll53zqql.cloudfront.net/out/v1/d4177931deff4c7ba994b8126d153d9f/maktv.m3u8",
      status: "unknown",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Cloudfront source"
    },
    {
      url: "https://spark3.smart-tv-data.com/makHD/makHD/playlist.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary MAK TV source"
    }
  ],

  action24: [
    {
      url: "https://actionlive.siliconweb.com/actionabr/actiontv/playlist.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary Action24 source"
    }
  ],

  pronews: [
    {
      url: "https://pro.free.hr:3887/live/pronewslive.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary ProNews source"
    }
  ],

  kontra: [
    {
      url: "https://kontralive.siliconweb.com/live/kontratv/playlist.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary Kontra source"
    }
  ],

  tv100: [
    {
      url: "https://live.fm100.gr/hls/tv100/1_2/index.m3u8",
      status: "online",
      sourceType: "saved",
      lastChecked: null,
      lastFound: null,
      notes: "Primary TV100 source"
    }
  ]
};

function getStreamFinderSources(channelKey) {
  return streamFinderSources[channelKey] || [];
}

function setStreamFinderSources(channelKey, newSources) {
  streamFinderSources[channelKey] = newSources;
}

function addStreamFinderSource(channelKey, sourceObj) {
  if (!streamFinderSources[channelKey]) {
    streamFinderSources[channelKey] = [];
  }

  const exists = streamFinderSources[channelKey].some(
    item => item.url === sourceObj.url
  );

  if (!exists) {
    streamFinderSources[channelKey].push(sourceObj);
  }
}

function sortStreamFinderSources(channelKey) {
  if (!streamFinderSources[channelKey]) return;

  const statusPriority = {
    online: 0,
    unknown: 1,
    dead: 2
  };

  const typePriority = {
    saved: 0,
    found: 1
  };

  streamFinderSources[channelKey].sort((a, b) => {
    const statusA = statusPriority[a.status] ?? 9;
    const statusB = statusPriority[b.status] ?? 9;

    if (statusA !== statusB) return statusA - statusB;

    const typeA = typePriority[a.sourceType] ?? 9;
    const typeB = typePriority[b.sourceType] ?? 9;

    return typeA - typeB;
  });
}
