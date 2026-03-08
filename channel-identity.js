/* channel-identity.js
   =========================================================
   Channel Identity Map for Stream Finder / WebTV Tools
   - channel matching
   - canonical keys
   - GitHub search profiles
   ========================================================= */

const channelIdentityMap = {
  ert1: {
    canonicalKey: "ert1",
    displayName: "ERT1",
    tvgIds: ["ert1", "ert-1"],
    aliases: ["ert1", "ert 1", "ert1 hd", "ert 1 hd", "ερτ1", "ερτ 1"],
    keywords: ["ert1", "ert 1", "ερτ1", "ερτ 1"],
    pathHints: ["ert1"],
    negativeHints: [],
    githubSearchTerms: ["ert1", "\"ert 1\"", "ερτ1", "\"ερτ 1\""],
    githubAvoidTerms: []
  },

  ert2: {
    canonicalKey: "ert2",
    displayName: "ERT2",
    tvgIds: ["ert2", "ert-2"],
    aliases: ["ert2", "ert 2", "ert2 hd", "ert 2 hd", "ερτ2", "ερτ 2"],
    keywords: ["ert2", "ert 2", "ερτ2", "ερτ 2"],
    pathHints: ["ert2"],
    negativeHints: [],
    githubSearchTerms: ["ert2", "\"ert 2\"", "ερτ2", "\"ερτ 2\""],
    githubAvoidTerms: []
  },

  ert3: {
    canonicalKey: "ert3",
    displayName: "ERT3",
    tvgIds: ["ert3", "ert-3"],
    aliases: ["ert3", "ert 3", "ert3 hd", "ert 3 hd", "ερτ3", "ερτ 3"],
    keywords: ["ert3", "ert 3", "ερτ3", "ερτ 3"],
    pathHints: ["ert3"],
    negativeHints: [],
    githubSearchTerms: ["ert3", "\"ert 3\"", "ερτ3", "\"ερτ 3\""],
    githubAvoidTerms: []
  },

  ertnews: {
    canonicalKey: "ertnews",
    displayName: "ERT News",
    tvgIds: ["ertnews", "ert-news"],
    aliases: ["ertnews", "ert news", "ert-news", "ερτ news", "ερτnews"],
    keywords: ["ertnews", "ert news", "ερτ news"],
    pathHints: ["ertnews", "ert-news"],
    negativeHints: [],
    githubSearchTerms: ["ertnews", "\"ert news\"", "\"ert-news\"", "\"ερτ news\""],
    githubAvoidTerms: []
  },

  ant1: {
    canonicalKey: "ant1",
    displayName: "ANT1",
    tvgIds: ["ant1", "ant-1"],
    aliases: ["ant1", "ant 1", "ant1 hd", "ant 1 hd", "antenna", "antenna tv"],
    keywords: ["ant1", "ant 1", "antenna", "antenna tv"],
    pathHints: ["ant1", "antenna"],
    negativeHints: ["f1", "formula 1", "plus", "plus1", "sport", "sports"],
    githubSearchTerms: ["ant1", "\"ant 1\"", "\"antenna tv\"", "antenna"],
    githubAvoidTerms: ["f1", "\"formula 1\"", "plus", "sport", "sports"]
  },

  alpha: {
    canonicalKey: "alpha",
    displayName: "Alpha TV",
    tvgIds: ["alpha"],
    aliases: ["alpha", "alpha tv", "alpha hd", "αλφα", "άλφα"],
    keywords: ["alpha", "alpha tv", "αλφα", "άλφα"],
    pathHints: ["alpha"],
    negativeHints: [],
    githubSearchTerms: ["alpha", "\"alpha tv\"", "αλφα", "άλφα"],
    githubAvoidTerms: []
  },

  skai: {
    canonicalKey: "skai",
    displayName: "SKAI",
    tvgIds: ["skai"],
    aliases: ["skai", "skai tv", "skai hd", "σκαι", "σκάι"],
    keywords: ["skai", "skai tv", "σκαι", "σκάι"],
    pathHints: ["skai"],
    negativeHints: [],
    githubSearchTerms: ["skai", "\"skai tv\"", "σκαι", "σκάι"],
    githubAvoidTerms: []
  },

  open: {
    canonicalKey: "open",
    displayName: "Open TV",
    tvgIds: ["open"],
    aliases: ["open", "open tv", "open beyond", "open hd"],
    keywords: ["open", "open tv", "open beyond"],
    pathHints: ["open"],
    negativeHints: ["vpn", "port", "openwrt", "openvpn", "opensource"],
    githubSearchTerms: ["\"open tv\"", "\"open beyond\"", "opentv"],
    githubAvoidTerms: ["openvpn", "openwrt", "opensource", "port", "api"]
  },

  mega: {
    canonicalKey: "mega",
    displayName: "MEGA",
    tvgIds: ["mega"],
    aliases: ["mega", "mega tv", "mega hd", "μεγκα", "μέγκα"],
    keywords: ["mega", "mega tv", "μεγκα", "μέγκα"],
    pathHints: ["mega"],
    negativeHints: ["mega.nz", "megasync", "megadrive"],
    githubSearchTerms: ["\"mega tv\"", "mega", "μεγκα", "μέγκα"],
    githubAvoidTerms: ["mega.nz", "megasync", "megadrive", "storage"]
  },

  star: {
    canonicalKey: "star",
    displayName: "Star",
    tvgIds: ["star"],
    aliases: ["star", "star tv", "star hd", "σταρ"],
    keywords: ["star", "star tv", "σταρ"],
    pathHints: ["star"],
    negativeHints: ["star plus", "star+", "starlink", "star wars"],
    githubSearchTerms: ["\"star tv\"", "star", "σταρ"],
    githubAvoidTerms: ["starlink", "\"star wars\"", "\"star plus\"", "star+"]
  },

  maktv: {
    canonicalKey: "maktv",
    displayName: "MAK TV",
    tvgIds: ["maktv", "maktv.gr", "mtv"],
    aliases: ["mak tv", "maktv", "mak tv hd", "maktv.gr"],
    keywords: ["mak tv", "maktv", "maktv.gr"],
    pathHints: ["maktv", "maktv.gr", "mak"],
    negativeHints: ["mtv", "music television", "spotify", "api", "kubectl", "django"],
    githubSearchTerms: ["maktv", "\"mak tv\"", "\"maktv.gr\""],
    githubAvoidTerms: ["mtv", "spotify", "api", "kubectl", "django", "music"]
  },

  action24: {
    canonicalKey: "action24",
    displayName: "Action 24",
    tvgIds: ["action24", "action-24"],
    aliases: ["action24", "action 24", "action 24 hd"],
    keywords: ["action24", "action 24"],
    pathHints: ["action24", "action-24"],
    negativeHints: [],
    githubSearchTerms: ["action24", "\"action 24\""],
    githubAvoidTerms: []
  },

  kontra: {
    canonicalKey: "kontra",
    displayName: "Kontra",
    tvgIds: ["kontra"],
    aliases: ["kontra", "kontra tv", "kontra channel"],
    keywords: ["kontra", "kontra tv", "kontra channel"],
    pathHints: ["kontra"],
    negativeHints: [],
    githubSearchTerms: ["kontra", "\"kontra tv\"", "\"kontra channel\""],
    githubAvoidTerms: []
  },

  tv100: {
    canonicalKey: "tv100",
    displayName: "TV100",
    tvgIds: ["tv100"],
    aliases: ["tv100", "tv 100"],
    keywords: ["tv100", "tv 100"],
    pathHints: ["tv100"],
    negativeHints: [],
    githubSearchTerms: ["tv100", "\"tv 100\""],
    githubAvoidTerms: []
  },

  pronews: {
    canonicalKey: "pronews",
    displayName: "ProNews",
    tvgIds: ["pronews"],
    aliases: ["pronews", "pro news"],
    keywords: ["pronews", "pro news"],
    pathHints: ["pronews"],
    negativeHints: ["newsapi", "newsletter", "project", "profile"],
    githubSearchTerms: ["pronews", "\"pro news\""],
    githubAvoidTerms: ["newsapi", "newsletter", "profile", "project"]
  }
};


/* =========================
   ===== Normalization =====
   ========================= */

function normalizeChannelText(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\b(hd|fhd|uhd|4k|backup|bup|web|live|tv|channel|greece|gr)\b/g, " ")
    .replace(/[_|/\\()[\]{}.,:+]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactChannelText(value) {
  return normalizeChannelText(value).replace(/\s+/g, "");
}

function normalizeTvgId(value) {
  return compactChannelText(value);
}


/* =========================
   ===== Data Helpers ======
   ========================= */

function getChannelIdentity(canonicalKey) {
  return channelIdentityMap[canonicalKey] || null;
}

function getAllChannelCanonicalKeys() {
  return Object.keys(channelIdentityMap);
}

function getChannelAliases(canonicalKey) {
  const item = getChannelIdentity(canonicalKey);
  return item ? item.aliases || [] : [];
}

function getChannelTvgIds(canonicalKey) {
  const item = getChannelIdentity(canonicalKey);
  return item ? item.tvgIds || [] : [];
}

function getGithubSearchProfile(canonicalKey) {
  const item = getChannelIdentity(canonicalKey);
  if (!item) {
    return {
      searchTerms: [],
      avoidTerms: []
    };
  }

  return {
    searchTerms: item.githubSearchTerms || [],
    avoidTerms: item.githubAvoidTerms || []
  };
}


/* =========================
   ===== Match Helpers =====
   ========================= */

function scoreIdentityMatch(identity, input) {
  let score = 0;

  const rawTvgId = input.tvgId || "";
  const rawTvgName = input.tvgName || "";
  const rawDisplayName = input.displayName || "";
  const rawUrl = input.url || "";
  const rawLogo = input.logo || "";

  const tvgId = normalizeTvgId(rawTvgId);
  const tvgName = compactChannelText(rawTvgName);
  const displayName = compactChannelText(rawDisplayName);
  const url = compactChannelText(rawUrl);
  const logo = compactChannelText(rawLogo);

  const tvgIds = (identity.tvgIds || []).map(normalizeTvgId);
  const aliases = (identity.aliases || []).map(compactChannelText);
  const keywords = (identity.keywords || []).map(compactChannelText);
  const pathHints = (identity.pathHints || []).map(compactChannelText);
  const negativeHints = (identity.negativeHints || []).map(compactChannelText);

  // Strongest signal
  if (tvgId && tvgIds.includes(tvgId)) {
    score += 100;
  }

  // Exact alias hits
  if (tvgName && aliases.includes(tvgName)) {
    score += 70;
  }

  if (displayName && aliases.includes(displayName)) {
    score += 60;
  }

  // Partial alias hits
  aliases.forEach(alias => {
    if (!alias) return;
    if (tvgName && tvgName.includes(alias)) score += 20;
    if (displayName && displayName.includes(alias)) score += 20;
  });

  // Keywords
  keywords.forEach(keyword => {
    if (!keyword) return;
    if (tvgName && tvgName.includes(keyword)) score += 10;
    if (displayName && displayName.includes(keyword)) score += 10;
    if (url && url.includes(keyword)) score += 6;
    if (logo && logo.includes(keyword)) score += 4;
  });

  // URL/path hints
  pathHints.forEach(hint => {
    if (!hint) return;
    if (url && url.includes(hint)) score += 8;
  });

  // Negative hints
  negativeHints.forEach(hint => {
    if (!hint) return;
    if (tvgName && tvgName.includes(hint)) score -= 35;
    if (displayName && displayName.includes(hint)) score -= 35;
    if (url && url.includes(hint)) score -= 20;
  });

  return score;
}

function detectChannelIdentity(input = {}) {
  let bestKey = null;
  let bestScore = -9999;

  for (const canonicalKey of getAllChannelCanonicalKeys()) {
    const identity = getChannelIdentity(canonicalKey);
    const score = scoreIdentityMatch(identity, input);

    if (score > bestScore) {
      bestScore = score;
      bestKey = canonicalKey;
    }
  }

  return {
    canonicalKey: bestKey,
    score: bestScore,
    matched: bestScore >= 40,
    identity: bestKey ? getChannelIdentity(bestKey) : null
  };
}

function resolveChannelCanonicalKey(input = {}) {
  const result = detectChannelIdentity(input);
  return result.matched ? result.canonicalKey : null;
}

function isLikelySameChannel(input = {}, canonicalKey) {
  if (!canonicalKey) return false;
  const identity = getChannelIdentity(canonicalKey);
  if (!identity) return false;

  const score = scoreIdentityMatch(identity, input);
  return score >= 40;
}
