const WORKER_BASE = "https://YOUR-WORKER.workers.dev";

const queryInput = document.getElementById("finder-query");
const modeSelect = document.getElementById("finder-mode");
const searchBtn = document.getElementById("finder-search-btn");
const statusEl = document.getElementById("finder-status");
const resultsEl = document.getElementById("finder-results");

searchBtn.addEventListener("click", runFinder);
queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runFinder();
});

async function runFinder() {
  const query = queryInput.value.trim();
  const mode = modeSelect.value;

  if (!query) {
    setStatus("Βάλε όνομα καναλιού ή query.", false);
    return;
  }

  setStatus(`⏳ Ψάχνω για: ${query}`, true);
  resultsEl.innerHTML = "";

  try {
    const result = await fetch(`${WORKER_BASE}/find?query=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}`);
    const data = await result.json();

    if (!data.ok) {
      setStatus(`❌ ${data.error || "Αποτυχία αναζήτησης"}`, false);
      return;
    }

    renderResults(data.results || []);
    setStatus(`✅ Βρέθηκαν ${data.results?.length || 0} αποτελέσματα`, true);
  } catch (err) {
    console.error(err);
    setStatus(`❌ Σφάλμα: ${err.message}`, false);
  }
}

function renderResults(results) {
  resultsEl.innerHTML = "";

  if (!results.length) {
    resultsEl.innerHTML = `<div class="result-card">Δεν βρέθηκαν αποτελέσματα.</div>`;
    return;
  }

  for (const item of results) {
    const card = document.createElement("div");
    card.className = "result-card";

    const validClass = item.valid ? "status-ok" : "status-bad";
    const validText = item.valid ? "VALID" : "UNVERIFIED";

    card.innerHTML = `
      <div class="result-top">
        <strong>${escapeHtml(item.channel || "Unknown channel")}</strong>
        <span class="${validClass}">${validText}</span>
      </div>

      <div class="result-url">${escapeHtml(item.url || "")}</div>

      <div class="result-meta">
        source: ${escapeHtml(item.source || "-")} |
        type: ${escapeHtml(item.type || "-")} |
        score: ${escapeHtml(String(item.score ?? "-"))}
      </div>

      <div class="result-actions">
        <button data-url="${encodeURIComponent(item.url)}" class="validate-btn">Validate</button>
        <button data-url="${encodeURIComponent(item.url)}" class="copy-btn">Copy URL</button>
        <button data-url="${encodeURIComponent(item.url)}" class="use-btn">Use in Player</button>
      </div>
    `;

    resultsEl.appendChild(card);
  }

  bindResultButtons();
}

function bindResultButtons() {
  document.querySelectorAll(".validate-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const url = decodeURIComponent(btn.dataset.url);
      await validateOne(url, btn);
    });
  });

  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const url = decodeURIComponent(btn.dataset.url);
      await navigator.clipboard.writeText(url);
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy URL", 1200);
    });
  });

  document.querySelectorAll(".use-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = decodeURIComponent(btn.dataset.url);
      localStorage.setItem("streamFinderSelectedUrl", url);
      window.location.href = "index.html";
    });
  });
}

async function validateOne(url, btn) {
  const old = btn.textContent;
  btn.textContent = "Checking...";

  try {
    const res = await fetch(`${WORKER_BASE}/validate?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    btn.textContent = data.valid ? "VALID ✅" : "BAD ❌";
  } catch (err) {
    btn.textContent = "ERROR";
  }

  setTimeout(() => {
    btn.textContent = old;
  }, 2000);
}

function setStatus(text, ok = true) {
  statusEl.innerHTML = `<p class="${ok ? "status-ok" : "status-bad"}">${escapeHtml(text)}</p>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[s]));
}
