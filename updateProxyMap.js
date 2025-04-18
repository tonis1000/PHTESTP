// updateProxyMap.js – Εκτελείται από το GitHub Action κάθε 15 λεπτά
// Διαβάζει proxy-cache.json ➜ βρίσκει working proxy ➜ ενημερώνει proxy-map.json

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const proxyList = [
  'https://cors-anywhere-production-d9b6.up.railway.app/',
  'https://tonis-proxy.onrender.com/',
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

const CACHE_FILE = path.resolve(__dirname, 'proxy-cache.json');
const MAP_FILE = path.resolve(__dirname, 'proxy-map.json');

async function testProxiesForUrl(url) {
  for (let proxy of proxyList) {
    const testUrl = proxy.endsWith('=') ? proxy + encodeURIComponent(url) : proxy + url;
    try {
      const res = await fetch(testUrl, { method: 'HEAD', timeout: 7000 });
      if (res.ok) return proxy;
    } catch (err) {
      continue;
    }
  }
  return null;
}

(async () => {
  if (!fs.existsSync(CACHE_FILE)) return;

  const proxyCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const proxyMap = fs.existsSync(MAP_FILE)
    ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
    : {};

  let updated = false;

  for (const url of proxyCache) {
    if (!proxyMap[url]) {
      console.log(`Testing: ${url}`);
      const workingProxy = await testProxiesForUrl(url);
      if (workingProxy) {
        proxyMap[url] = workingProxy;
        updated = true;
        console.log(`✔ Found working proxy for ${url}: ${workingProxy}`);
      } else {
        console.log(`✘ No proxy worked for ${url}`);
      }
    }
  }

  if (updated) {
    fs.writeFileSync(MAP_FILE, JSON.stringify(proxyMap, null, 2));
    console.log('✅ proxy-map.json updated.');
  } else {
    console.log('ℹ️ No new entries. proxy-map.json unchanged.');
  }
})();
