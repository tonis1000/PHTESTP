import { normalizeUrl } from "./url-normalizer.js";
import { resolveChannel } from "./channel-mapper.js";
import { validateManifest } from "./manifest-validator.js";

const SOURCE_SEEDS = [
  {
    source: "toni-main",
    channel: "ant1",
    url: "https://anacon.org/app/chans/gr/ant1image.php",
    type: "iframe",
    score: 45
  },
  {
    source: "toni-main",
    channel: "mega",
    url: "https://www.lakatamia.tv/app/chans/gr/megaimage.php",
    type: "iframe",
    score: 44
  },
  {
    source: "toni-main",
    channel: "ert1",
    url: "https://spark3.smart-tv-data.com/ert1HD/ert1HD/playlist.m3u8",
    type: "hls",
    score: 80
  }
];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/find") {
      const query = (url.searchParams.get("query") || "").trim();
      const resolved = resolveChannel(query);

      const results = SOURCE_SEEDS
        .filter(x =>
          x.channel.includes((resolved || "").toLowerCase()) ||
          x.url.toLowerCase().includes(query.toLowerCase())
        )
        .map(x => ({
          ...x,
          url: normalizeUrl(x.url),
          valid: x.type === "hls"
        }));

      return json({
        ok: true,
        query,
        resolved,
        results
      });
    }

    if (url.pathname === "/validate") {
      const target = url.searchParams.get("url");
      if (!target) return json({ ok: false, error: "Missing url" }, 400);

      const result = await validateManifest(target);
      return json(result, 200);
    }

    if (url.pathname === "/normalize") {
      const input = url.searchParams.get("url");
      return json({ ok: true, normalized: normalizeUrl(input) });
    }

    if (url.pathname === "/resolve-channel") {
      const input = url.searchParams.get("name");
      return json({ ok: true, resolved: resolveChannel(input) });
    }

    return json({ ok: true, service: "StreamRadar Worker" });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*"
    }
  });
}
