/* stream-finder-sources.js
   =========================================================
   Known source map for Stream Finder
   - sources grouped by canonical channel key
   ========================================================= */

const streamFinderSources = {
  ert1: [
    "https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT1/default/index.m3u8",
    "https://cdn4.smart-tv-data.com/vid/ert1/playlist.m3u8",
    "http://www.anacon.org/app/chans/gr/ert1s2image.php",
    "http://195.226.218.163/vid/ert1/playlist.m3u8"
  ],

  ert2: [
    "https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT2/default/index.m3u8",
    "http://www.anacon.org/app/chans/gr/ert2s2image.php",
    "https://wow.anixa.tv/live/ert2/playlist.m3u8"
  ],

  ert3: [
    "https://ert-live.ascdn.broadpeak.io/bpk-tv/ERT3/default/index.m3u8",
    "https://ertflix.akamaized.net/ertlive/ert3/clrdef24828n/playlist.m3u8",
    "http://www.anacon.org/app/chans/gr/ert3s2image.php"
  ],

  ertnews: [
    "https://ertflix.akamaized.net/ertlive/ertnews/default/playlist.m3u8"
  ],

  ant1: [
    "https://spark3.smart-tv-data.com/ant1HD/ant1HD/playlist.m3u8",
    "https://cdn1.smart-tv-data.com/live/ant1_srt/playlist.m3u8",
    "https://anacon.org/app/chans/gr/ant1image.php"
  ],

  alpha: [
    "https://alphatvlive2.siliconweb.com/alphatvlive/live_abr/playlist.m3u8",
    "https://alphatvlive.siliconweb.com/1/Y2Rsd1lUcUVoajcv/UVdCN25h/hls/live/playlist.m3u",
    "https://spark3.smart-tv-data.com/alphaHD/alphaHD/playlist.m3u8",
    "https://cdn1.smart-tv-data.com/live/alpha/playlist.m3u8",
    "http://www.anacon.org/app/chans/gr/alphaimage.php"
  ],

  skai: [
    "http://skai-live.siliconweb.com/media/cambria4/index.m3u8",
    "https://skai-live-back.siliconweb.com/media/cambria4/index.m3u8"
  ],

  open: [
    "https://liveopencloud.siliconweb.com/1/ZlRza2R6L2tFRnFJ/eWVLSlQx/hls/live/playlist.m3u8",
    "https://liveopen.siliconweb.com/openTvLive/liveopen/playlist.m3u8"
  ],

  mega: [
    "https://www.lakatamia.tv/app/chans/gr/megaimage.php",
    "https://embed.vindral.com/?core.channelId=alteregomedia_megatv1_ci_6cc490c7-e5c6-486b-acf0-9bb9c20fa670&core.minBufferTime=2000&player.aspectRatio=16:9"
  ],

  star: [
    "https://livestar.siliconweb.com/media/star4/star4newhd.m3u8",
    "https://spark3.smart-tv-data.com/starHD/starHD/playlist.m3u8",
    "https://livestar.siliconweb.com/media/star1/star1.m3u8",
    "https://s2.cystream.net/galanos/star/chunks.m3u8?nimblesessiontvg-id=783489&wmsAuthSign=c2VydmVyX3RpbWU9MTEvMjAvMjAyMyAxMDoyNTozOCBQTSZoYXNoX3ZhbHVlPWNrMUg2TjRVWlZGR0t4V1k2QXVhWFE9PSZ2YWxpZG1pbnV0ZXM9MjA=",
    "https://www.lakatamia.tv/app/chans/gr/stargreece.php"
  ],

  maktv: [
    "http://dlm34ll53zqql.cloudfront.net/out/v1/d4177931deff4c7ba994b8126d153d9f/maktv.m3u8",
    "https://spark3.smart-tv-data.com/makHD/makHD/playlist.m3u8"
  ],

  action24: [
    "https://actionlive.siliconweb.com/actionabr/actiontv/playlist.m3u8"
  ],

  pronews: [
    "https://pro.free.hr:3887/live/pronewslive.m3u8"
  ],

  kontra: [
    "https://kontralive.siliconweb.com/live/kontratv/playlist.m3u8"
  ],

  tv100: [
    "https://live.fm100.gr/hls/tv100/1_2/index.m3u8"
  ]
};

function getStreamFinderSources(channelKey) {
  return streamFinderSources[channelKey] || [];
}
