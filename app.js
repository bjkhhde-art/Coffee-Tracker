/* ============================================================
   Coffee Tracker – GitHub Pages + Supabase
   Trägt Mahlgrad, Extraktionszeit, Druck und Geschmack ein.
   ============================================================ */


/* ============================================================
   1. SUPABASE EINSTELLUNGEN
   ============================================================ */

const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";

// WICHTIG:
// Hier muss dein kompletter Publishable Key / anon public key rein.
// Nicht nur "sb_publishable_..." eintragen.
const SUPABASE_ANON_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";


/* ============================================================
   2. TABELLENNAMEN
   ============================================================ */

const SETTINGS_TABLE = "coffee_grinder_settings";
const SHOTS_TABLE = "coffee_shots";
const FAVORITES_TABLE = "coffee_favorites";


/* ============================================================
   3. SUPABASE CLIENT
   ============================================================ */

let supabaseClient = null;

if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error("Supabase Library wurde nicht geladen. Prüfe den Script-Tag in index.html.");
}


/* ============================================================
   4. APP STATE
   ============================================================ */

const state = {
  settings: [],
  shots: [],
  favorites: [],
  settingsSearch: "",
  historySearch: "",
};


/* ============================================================
   5. DOM HELPER
   ============================================================ */

const $ = (id) => document.getElementById(id);

const el = {
  todayLabel: $("todayLabel"),

  bestRating: $("bestRating"),
  bestRatingSub: $("bestRatingSub"),
  avgTime: $("avgTime"),
  avgPressure: $("avgPressure"),
  lastGrind: $("lastGrind"),
  lastShotSub: $("lastShotSub"),
  recommendation: $("recommendation"),
  timeChart: $("timeChart"),
  pressureChart: $("pressureChart"),

  settingSelect: $("settingSelect"),
  favoriteSelect: $("favoriteSelect"),

  shotDate: $("shotDate"),
  shotTime: $("shotTime"),
  marke: $("marke"),
  bohne: $("bohne"),
  roestgrad: $("roestgrad"),
  zusammensetzung: $("zusammensetzung"),
  dose: $("dose"),
  yield: $("yield"),
  mahlgrad: $("mahlgrad"),
  extractionTime: $("extractionTime"),
  pressure: $("pressure"),
  temperature: $("temperature"),
  rating: $("rating"),
  tasteNotes: $("tasteNotes"),
  formMessage: $("formMessage"),

  settingsSearch: $("settingsSearch"),
  settingsTable: $("settingsTable"),
  settingsCount: $("settingsCount"),

  historySearch: $("historySearch"),
  shotsList: $("shotsList"),
  shotsCount: $("shotsCount"),
};


/* ============================================================
   6. ALLGEMEINE HELFER
   ============================================================ */

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .trim();
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value, decimals = 1) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "–";
  }

  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function setMessage(text, type = "info") {
  if (!el.formMessage) return;

  el.formMessage.textContent = text;
  el.formMessage.style.color = type === "error" ? "var(--danger)" : "var(--accent-2)";
}

function showGlobalError(message) {
  console.error(message);

  if (el.settingsTable) {
    el.settingsTable.innerHTML = `
      <tr>
        <td colspan="8">${escapeHTML(message)}</td>
      </tr>
    `;
  }

  if (el.shotsList) {
    el.shotsList.innerHTML = `
      <div class="empty">${escapeHTML(message)}</div>
    `;
  }

  setMessage(message, "error");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ============================================================
   7. STARTDATUM / UHRZEIT
   ============================================================ */

function setToday() {
  const now = new Date();

  if (el.todayLabel) {
    el.todayLabel.textContent = now.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  }

  if (el.shotDate) {
    el.shotDate.value = todayISO();
  }

  if (el.shotTime) {
    el.shotTime.value = nowTime();
  }
}


/* ============================================================
   8. TABS
   ============================================================ */

function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => {
        b.classList.remove("active");
      });

      document.querySelectorAll(".view").forEach((v) => {
        v.classList.remove("active");
      });

      btn.classList.add("active");

      const view = $(`view-${btn.dataset.view}`);
      if (view) {
        view.classList.add("active");
      }

      if (btn.dataset.view === "dashboard") {
        setTimeout(renderDashboard, 30);
      }
    });
  });
}

function openView(viewName) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });

  const target = $(`view-${viewName}`);
  if (target) {
    target.classList.add("active");
  }

  if (viewName === "dashboard") {
    setTimeout(renderDashboard, 30);
  }
}


/* ============================================================
   9. SUPABASE LADEN
   ============================================================ */

async function loadSettings() {
  const { data, error } = await supabaseClient
    .from(SETTINGS_TABLE)
    .select("*")
    .order("marke", { ascending: true })
    .order("bohne", { ascending: true })
    .order("mahlgrad", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Mahlgrade:", error);
    showGlobalError("Mahlgrad-Daten konnten nicht geladen werden. Prüfe Supabase-Key, Tabelle und Policies.");
    return;
  }

  state.settings = data || [];

  renderSettings();
  renderSettingSelect();
}

async function loadShots() {
  const { data, error } = await supabaseClient
    .from(SHOTS_TABLE)
    .select("*")
    .order("shot_date", { ascending: false })
    .order("shot_time", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Shots:", error);
    showGlobalError("Shots konnten nicht geladen werden. Prüfe Supabase-Key, Tabelle und Policies.");
    return;
  }

  state.shots = data || [];

  renderDashboard();
  renderShots();
}

async function loadFavorites() {
  const { data, error } = await supabaseClient
    .from(FAVORITES_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Favoriten:", error);
    return;
  }

  state.favorites = data || [];

  renderFavorites();
}

async function reloadAllData() {
  await Promise.all([
    loadSettings(),
    loadShots(),
    loadFavorites(),
  ]);
}


/* ============================================================
   10. MAHLGRAD-DATENBANK
   ============================================================ */

function renderSettingSelect() {
  if (!el.settingSelect) return;

  el.settingSelect.innerHTML = `<option value="">Manuell eintragen</option>`;

  state.settings.forEach((item) => {
    const opt = document.createElement("option");

    opt.value = item.id;
    opt.textContent = `${item.marke || "?"} – ${item.bohne || "?"} | Mahlgrad ${formatNumber(item.mahlgrad)}`;

    el.settingSelect.appendChild(opt);
  });
}

function settingMatches(item) {
  const q = normalize(state.settingsSearch);

  if (!q) {
    return true;
  }

  const haystack = normalize([
    item.marke,
    item.bohne,
    item.roestgrad,
    item.zusammensetzung,
    item.mahlgrad,
    item.extraktionszeit_36g_s,
    item.druck_bar,
    item.geschmack,
  ].join(" "));

  return q.split(/\s+/).every((term) => haystack.includes(term));
}

function renderSettings() {
  if (!el.settingsTable || !el.settingsCount) return;

  const items = state.settings.filter(settingMatches);

  el.settingsCount.textContent = `${items.length} Einträge`;
  el.settingsTable.innerHTML = "";

  if (!items.length) {
    el.settingsTable.innerHTML = `
      <tr>
        <td colspan="8">Keine passenden Mahlgrad-Einträge gefunden.</td>
      </tr>
    `;
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><strong>${escapeHTML(item.marke || "–")}</strong></td>
      <td>${escapeHTML(item.bohne || "–")}</td>
      <td>${escapeHTML(item.roestgrad || "–")}</td>
      <td>${formatNumber(item.mahlgrad)}</td>
      <td>${formatNumber(item.extraktionszeit_36g_s)} s</td>
      <td>${formatNumber(item.druck_bar)} Bar</td>
      <td>${escapeHTML(item.geschmack || "–")}</td>
      <td>
        <button class="row-btn" data-setting-id="${item.id}">
          Nutzen
        </button>
      </td>
    `;

    el.settingsTable.appendChild(tr);
  });

  el.settingsTable.querySelectorAll("[data-setting-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = state.settings.find((s) => String(s.id) === String(btn.dataset.settingId));

      fillFormFromSetting(item);
      openView("shot");
      setMessage("Vorlage übernommen. Du kannst den Shot jetzt speichern.");
    });
  });
}


/* ============================================================
   11. FAVORITEN
   ============================================================ */

function renderFavorites() {
  if (!el.favoriteSelect) return;

  el.favoriteSelect.innerHTML = `<option value="">Kein Favorit</option>`;

  state.favorites.forEach((item) => {
    const opt = document.createElement("option");

    opt.value = item.id;
    opt.textContent = item.name || `${item.marke || ""} ${item.bohne || ""}`.trim() || "Favorit";

    el.favoriteSelect.appendChild(opt);
  });
}

function fillFormFromSetting(item) {
  if (!item) return;

  el.marke.value = item.marke || "";
  el.bohne.value = item.bohne || "";
  el.roestgrad.value = item.roestgrad || "";
  el.zusammensetzung.value = item.zusammensetzung || "";
  el.mahlgrad.value = item.mahlgrad ?? "";
  el.extractionTime.value = item.extraktionszeit_36g_s ?? "";
  el.pressure.value = item.druck_bar ?? "";
  el.tasteNotes.value = item.geschmack || "";

  if (!el.dose.value) {
    el.dose.value = "18";
  }

  if (!el.yield.value) {
    el.yield.value = "36";
  }
}

function fillFormFromFavorite(item) {
  if (!item) return;

  el.marke.value = item.marke || "";
  el.bohne.value = item.bohne || "";
  el.roestgrad.value = item.roestgrad || "";
  el.zusammensetzung.value = item.zusammensetzung || "";
  el.dose.value = item.dose_g ?? "18";
  el.yield.value = item.yield_g ?? "36";
  el.mahlgrad.value = item.mahlgrad ?? "";
  el.extractionTime.value = item.extraction_time_s ?? "";
  el.pressure.value = item.pressure_bar ?? "";
  el.temperature.value = item.temperature_c ?? "";
  el.tasteNotes.value = item.taste_notes || "";
}


/* ============================================================
   12. FORMULAR LESEN / SPEICHERN
   ============================================================ */

function readForm() {
  const rawTime = el.shotTime.value || nowTime();
  const shotTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;

  return {
    shot_date: el.shotDate.value || todayISO(),
    shot_time: shotTime,

    marke: el.marke.value.trim() || null,
    bohne: el.bohne.value.trim() || null,
    roestgrad: el.roestgrad.value.trim() || null,
    zusammensetzung: el.zusammensetzung.value.trim() || null,

    dose_g: toNumber(el.dose.value),
    yield_g: toNumber(el.yield.value),

    mahlgrad: toNumber(el.mahlgrad.value),
    extraction_time_s: toNumber(el.extractionTime.value),
    pressure_bar: toNumber(el.pressure.value),
    temperature_c: toNumber(el.temperature.value),

    rating: toNumber(el.rating.value),

    taste_notes: el.tasteNotes.value.trim() || null,
  };
}

async function saveShot() {
  const payload = readForm();

  if (payload.mahlgrad === null) {
    setMessage("Bitte mindestens den Mahlgrad eintragen.", "error");
    return;
  }

  const { data, error } = await supabaseClient
    .from(SHOTS_TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Speichern des Shots:", error);
    setMessage(`Speichern fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  console.log("Shot gespeichert:", data);

  setMessage("Shot gespeichert ✅");

  await loadShots();

  openView("history");
}

async function saveFavorite() {
  const shot = readForm();

  const defaultName = `${shot.marke || ""} ${shot.bohne || ""} MG ${formatNumber(shot.mahlgrad)}`.trim();

  const name = prompt("Name für den Favoriten?", defaultName || "Mein Espresso-Favorit");

  if (!name) {
    return;
  }

  const payload = {
    name,
    marke: shot.marke,
    bohne: shot.bohne,
    roestgrad: shot.roestgrad,
    zusammensetzung: shot.zusammensetzung,
    dose_g: shot.dose_g,
    yield_g: shot.yield_g,
    mahlgrad: shot.mahlgrad,
    extraction_time_s: shot.extraction_time_s,
    pressure_bar: shot.pressure_bar,
    temperature_c: shot.temperature_c,
    taste_notes: shot.taste_notes,
  };

  const { data, error } = await supabaseClient
    .from(FAVORITES_TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Speichern des Favoriten:", error);
    setMessage(`Favorit konnte nicht gespeichert werden: ${error.message}`, "error");
    return;
  }

  console.log("Favorit gespeichert:", data);

  setMessage("Favorit gespeichert ⭐");

  await loadFavorites();
}

function resetForm() {
  el.settingSelect.value = "";
  el.favoriteSelect.value = "";

  el.marke.value = "";
  el.bohne.value = "";
  el.roestgrad.value = "";
  el.zusammensetzung.value = "";

  el.dose.value = "18";
  el.yield.value = "36";

  el.mahlgrad.value = "";
  el.extractionTime.value = "";
  el.pressure.value = "";
  el.temperature.value = "";
  el.rating.value = "";
  el.tasteNotes.value = "";

  setToday();
  setMessage("");
}


/* ============================================================
   13. SHOT VERLAUF
   ============================================================ */

function shotMatches(item) {
  const q = normalize(state.historySearch);

  if (!q) {
    return true;
  }

  const haystack = normalize([
    item.shot_date,
    item.shot_time,
    item.marke,
    item.bohne,
    item.roestgrad,
    item.zusammensetzung,
    item.dose_g,
    item.yield_g,
    item.mahlgrad,
    item.extraction_time_s,
    item.pressure_bar,
    item.temperature_c,
    item.rating,
    item.taste_notes,
  ].join(" "));

  return q.split(/\s+/).every((term) => haystack.includes(term));
}

function renderShots() {
  if (!el.shotsList || !el.shotsCount) return;

  const shots = state.shots.filter(shotMatches);

  el.shotsCount.textContent = `${shots.length} Shots`;
  el.shotsList.innerHTML = "";

  if (!shots.length) {
    el.shotsList.innerHTML = `
      <div class="empty">Noch keine passenden Shots gespeichert.</div>
    `;
    return;
  }

  shots.forEach((shot) => {
    const item = document.createElement("article");
    item.className = "shot-item";

    const dateText = formatShotDate(shot.shot_date, shot.shot_time);
    const title = `${shot.marke || "Unbekannte Rösterei"} – ${shot.bohne || "Unbekannte Bohne"}`;

    item.innerHTML = `
      <div class="shot-top">
        <div class="shot-title">${escapeHTML(title)}</div>
        <div class="shot-date">${escapeHTML(dateText)}</div>
      </div>

      <div class="shot-meta">
        <span class="pill">⚙️ Mahlgrad ${formatNumber(shot.mahlgrad)}</span>
        <span class="pill">⏱️ ${formatNumber(shot.extraction_time_s)} s</span>
        <span class="pill">🧭 ${formatNumber(shot.pressure_bar)} Bar</span>
        <span class="pill">⚖️ ${formatNumber(shot.dose_g)}g → ${formatNumber(shot.yield_g)}g</span>
        <span class="pill">🌡️ ${formatNumber(shot.temperature_c)} °C</span>
        <span class="pill">⭐ ${shot.rating || "–"}/5</span>
      </div>

      ${shot.taste_notes ? `<p class="shot-notes">${escapeHTML(shot.taste_notes)}</p>` : ""}
    `;

    el.shotsList.appendChild(item);
  });
}

function formatShotDate(date, time) {
  if (!date) {
    return "–";
  }

  const d = new Date(`${date}T${time || "00:00:00"}`);

  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(date) {
  if (!date) {
    return "";
  }

  const d = new Date(`${date}T00:00:00`);

  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
}


/* ============================================================
   14. DASHBOARD
   ============================================================ */

function renderDashboard() {
  const shots = [...state.shots].sort((a, b) => {
    const aa = `${a.shot_date || ""} ${a.shot_time || ""}`;
    const bb = `${b.shot_date || ""} ${b.shot_time || ""}`;

    return aa.localeCompare(bb);
  });

  if (!shots.length) {
    el.bestRating.textContent = "–";
    el.bestRatingSub.textContent = "Noch keine Shots";

    el.avgTime.textContent = "–";
    el.avgPressure.textContent = "–";

    el.lastGrind.textContent = "–";
    el.lastShotSub.textContent = "Noch kein Verlauf";

    el.recommendation.textContent = "Trage ein paar Shots ein, dann kann die App erkennen, welcher Mahlgrad bei welcher Bohne am besten funktioniert.";

    drawLineChart(el.timeChart, [], "s");
    drawLineChart(el.pressureChart, [], "Bar");

    return;
  }

  const rated = shots.filter((s) => Number.isFinite(Number(s.rating)));
  const best = rated.sort((a, b) => Number(b.rating) - Number(a.rating))[0];

  if (best) {
    el.bestRating.textContent = `${best.rating}/5`;
    el.bestRatingSub.textContent = `${best.marke || "–"} · ${best.bohne || "–"} · MG ${formatNumber(best.mahlgrad)}`;
  } else {
    el.bestRating.textContent = "–";
    el.bestRatingSub.textContent = "Noch keine Bewertung";
  }

  const times = shots
    .map((s) => Number(s.extraction_time_s))
    .filter(Number.isFinite);

  const pressures = shots
    .map((s) => Number(s.pressure_bar))
    .filter(Number.isFinite);

  const avg = (arr) => {
    if (!arr.length) return null;

    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  const avgExtractionTime = avg(times);
  const avgPressureValue = avg(pressures);

  el.avgTime.textContent = avgExtractionTime === null ? "–" : `${formatNumber(avgExtractionTime)} s`;
  el.avgPressure.textContent = avgPressureValue === null ? "–" : `${formatNumber(avgPressureValue)} Bar`;

  const last = shots[shots.length - 1];

  el.lastGrind.textContent = formatNumber(last.mahlgrad);
  el.lastShotSub.textContent = `${last.marke || "–"} · ${last.bohne || "–"}`;

  el.recommendation.textContent = buildRecommendation(shots);

  drawLineChart(
    el.timeChart,
    shots
      .filter((s) => Number.isFinite(Number(s.extraction_time_s)))
      .map((s) => ({
        label: formatShortDate(s.shot_date),
        value: Number(s.extraction_time_s),
      })),
    "s"
  );

  drawLineChart(
    el.pressureChart,
    shots
      .filter((s) => Number.isFinite(Number(s.pressure_bar)))
      .map((s) => ({
        label: formatShortDate(s.shot_date),
        value: Number(s.pressure_bar),
      })),
    "Bar"
  );
}

function buildRecommendation(shots) {
  const rated = shots
    .filter((s) => Number(s.rating) >= 4 && Number.isFinite(Number(s.mahlgrad)))
    .sort((a, b) => Number(b.rating) - Number(a.rating));

  if (!rated.length) {
    return "Noch keine klare Empfehlung. Bewerte deine Shots, dann wird der beste Mahlgrad pro Bohne sichtbar.";
  }

  const best = rated[0];
  const taste = best.taste_notes ? ` Geschmack: ${best.taste_notes}` : "";

  return `Aktuell sieht ${best.marke || "diese Rösterei"} – ${best.bohne || "diese Bohne"} mit Mahlgrad ${formatNumber(best.mahlgrad)}, ${formatNumber(best.extraction_time_s)} s und ${formatNumber(best.pressure_bar)} Bar am besten aus.${taste}`;
}


/* ============================================================
   15. CANVAS CHARTS
   ============================================================ */

function drawLineChart(canvas, points, unit) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 400;
  const height = Number(canvas.getAttribute("height")) || 220;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = 34;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  ctx.strokeStyle = "rgba(255,247,236,0.14)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH / 4) * i;

    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,247,236,0.68)";
  ctx.font = "12px system-ui";

  if (!points.length) {
    ctx.fillText("Noch keine Daten", pad, height / 2);
    return;
  }

  if (points.length === 1) {
    const p = points[0];

    ctx.fillText(`${formatNumber(p.value)} ${unit}`, pad, height / 2);
    return;
  }

  const values = points.map((p) => p.value);

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const xFor = (i) => pad + (chartW * i) / (points.length - 1);
  const yFor = (v) => pad + chartH - ((v - min) / (max - min)) * chartH;

  ctx.strokeStyle = "rgba(255,207,138,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();

  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  ctx.fillStyle = "rgba(216,154,85,1)";

  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255,247,236,0.7)";
  ctx.fillText(`${formatNumber(max)} ${unit}`, pad, 18);
  ctx.fillText(`${formatNumber(min)} ${unit}`, pad, height - 10);
}


/* ============================================================
   16. EVENTS
   ============================================================ */

function initEvents() {
  if (el.settingSelect) {
    el.settingSelect.addEventListener("change", () => {
      const item = state.settings.find((s) => String(s.id) === String(el.settingSelect.value));
      fillFormFromSetting(item);
    });
  }

  if (el.favoriteSelect) {
    el.favoriteSelect.addEventListener("change", () => {
      const item = state.favorites.find((s) => String(s.id) === String(el.favoriteSelect.value));
      fillFormFromFavorite(item);
    });
  }

  const saveShotBtn = $("saveShotBtn");
  if (saveShotBtn) {
    saveShotBtn.addEventListener("click", saveShot);
  }

  const saveFavoriteBtn = $("saveFavoriteBtn");
  if (saveFavoriteBtn) {
    saveFavoriteBtn.addEventListener("click", saveFavorite);
  }

  const resetFormBtn = $("resetFormBtn");
  if (resetFormBtn) {
    resetFormBtn.addEventListener("click", resetForm);
  }

  const reloadBtn = $("reloadBtn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", reloadAllData);
  }

  if (el.settingsSearch) {
    el.settingsSearch.addEventListener("input", () => {
      state.settingsSearch = el.settingsSearch.value;
      renderSettings();
    });
  }

  if (el.historySearch) {
    el.historySearch.addEventListener("input", () => {
      state.historySearch = el.historySearch.value;
      renderShots();
    });
  }

  const deleteAllLocalFiltersBtn = $("deleteAllLocalFiltersBtn");
  if (deleteAllLocalFiltersBtn) {
    deleteAllLocalFiltersBtn.addEventListener("click", () => {
      state.historySearch = "";
      el.historySearch.value = "";
      renderShots();
    });
  }

  window.addEventListener("resize", () => {
    renderDashboard();
  });
}


/* ============================================================
   17. INITIALISIERUNG
   ============================================================ */

async function init() {
  initTabs();
  initEvents();
  setToday();

  if (!supabaseClient) {
    showGlobalError("Supabase konnte nicht initialisiert werden. Prüfe index.html und die Supabase Library.");
    return;
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_URL.includes("DEINE_") ||
    SUPABASE_ANON_KEY.includes("DEINE_") ||
    SUPABASE_ANON_KEY.includes("HIER_") ||
    SUPABASE_ANON_KEY.includes("...")
  ) {
    showGlobalError("Bitte zuerst den kompletten Supabase-Key in app.js eintragen.");
    return;
  }

  await reloadAllData();
}

init();
