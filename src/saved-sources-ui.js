import { cleanUrl, normalizeId } from './core/utils.js?v=20260920-1021';

const STORAGE_KEY = 'webtv_v2_saved_sources';
const BUILD_ID = '20260920-1025';
const $ = id => document.getElementById(id);

const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const channelName = $('channel-name');
const diagSource = $('diag-source');
const diagRoute = $('diag-route');
const diagPlayer = $('diag-player');
const diagStartup = $('diag-startup');
const diagLog = $('diagnostic-log');

if (candidateInput && testButton && channelName) {
  const saveButton = document.createElement('button');
  saveButton.id = 'save-candidate';
  saveButton.type = 'button';
  saveButton.className = 'button';
  saveButton.textContent = 'Save Source';
  saveButton.hidden = true;
  testButton.insertAdjacentElement('afterend', saveButton);

  const status = document.createElement('p');
  status.className = 'muted small';
  status.style.margin = '8px 0 0';
  testButton.closest('.candidate-tester')?.appendChild(status);

  let pending = null;
  let verified = null;

  function log(message) {
    if (!diagLog) return;
    const stamp = new Date().toLocaleTimeString();
    diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function resetVerification(message = '') {
    pending = null;
    verified = null;
    saveButton.hidden = true;
    saveButton.disabled = false;
    saveButton.textContent = 'Save Source';
    status.textContent = message;
  }

  function beginCandidateTracking() {
    const url = cleanUrl(candidateInput.value.trim());
    const name = channelName.textContent.trim();
    if (!url || !/^https?:\/\//i.test(url) || !name || name === 'Επίλεξε κανάλι') {
      resetVerification();
      return;
    }
    pending = {
      url,
      channelName: name,
      channelKey: normalizeId(name),
      startedAt: Date.now(),
    };
    verified = null;
    saveButton.hidden = true;
    status.textContent = 'Testing… Save θα ενεργοποιηθεί μόνο αν ξεκινήσει πραγματικό playback.';
  }

  function inspectDiagnostics() {
    if (!pending || verified) return;
    const player = diagPlayer?.textContent?.trim() || '-';
    const source = cleanUrl(diagSource?.textContent?.trim() || '');
    if (player === '-' || !source || source !== pending.url) return;

    const startupText = diagStartup?.textContent || '';
    const startupMs = Number.parseInt(startupText, 10) || 0;
    const route = diagRoute?.textContent?.trim() || '';
    verified = { ...pending, route, player, startupMs, verifiedAt: new Date().toISOString() };
    saveButton.hidden = false;
    status.textContent = `Verified ✓ ${route || player}${startupMs ? ` · ${startupMs} ms` : ''}. Μπορείς τώρα να τη σώσεις.`;
  }

  testButton.addEventListener('click', beginCandidateTracking, true);
  candidateInput.addEventListener('input', () => resetVerification());

  const observer = new MutationObserver(inspectDiagnostics);
  if (diagPlayer) observer.observe(diagPlayer, { childList: true, characterData: true, subtree: true });
  if (diagSource) observer.observe(diagSource, { childList: true, characterData: true, subtree: true });

  saveButton.addEventListener('click', () => {
    if (!verified) return;
    const store = readStore();
    const key = verified.channelKey;
    const existing = Array.isArray(store[key]) ? store[key] : [];
    const withoutSame = existing.filter(item => cleanUrl(item?.url || item) !== verified.url);
    store[key] = [{
      url: verified.url,
      channelName: verified.channelName,
      verifiedAt: verified.verifiedAt,
      route: verified.route,
      player: verified.player,
      startupMs: verified.startupMs,
    }, ...withoutSame].slice(0, 12);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    saveButton.textContent = 'Saved ✓';
    saveButton.disabled = true;
    status.textContent = 'Αποθηκεύτηκε μόνιμα σε αυτόν τον browser. Στο επόμενο click του καναλιού θα μπει πρώτη στο source pool.';
    log(`SAVED ${verified.channelName} · ${verified.url} · ${verified.route || verified.player}${verified.startupMs ? ` · ${verified.startupMs} ms` : ''}`);
  });

  log(`Saved Sources UI loaded · build ${BUILD_ID}`);
}
