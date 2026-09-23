/* ============================================================
   Coffee Tracker
   Vanilla JS + Supabase + Shelly Plug S Gen 3
   ============================================================ */

const SUPABASE_URL      = "https://befguyryszybbmkycaco.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_u-yi1kW04_JC3Emlt5KCsw_1zTedbXO";

const TABLE_ENTRIES     = "coffee_entries";
const TABLE_EQUIPMENT   = "coffee_equipment";
const TABLE_SETTINGS    = "coffee_user_settings";
const TABLE_CLEANING    = "coffee_cleaning_logs";
const TABLE_SHELLY_LOGS = "coffee_shelly_logs";
const TABLE_EXTRACTIONS = "coffee_shelly_extractions";

/* Tuning */
const EXTRACTION_LOOKBACK_MIN = 15;     // so lange wird eine erkannte Extraktion vorgeschlagen
const EXTRACTION_POLL_MS      = 10000;  // Shot-Tab: alle 10 s nach neuen Extraktionen schauen
const SHELLY_POLL_MS          = 30000;  // Stats-Tab: Shelly-Panel alle 30 s aktualisieren
const SHELLY_STALE_MIN        = 7;      // Shelly pusht alle 5 min, danach gilt der Wert als veraltet
const RELOAD_AFTER_MS         = 120000; // beim Zurückkehren in die App nach 2 min neu laden
const HISTORY_PAGE            = 30;
const STATS_WINDOW            = 20;     // Ø Extraktion & Trefferquote über die letzten N Shots

const CLEANING_THRESHOLDS = {
  klein: { ok: 3,  warn: 7  },
  gross: { ok: 14, warn: 30 },
};

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const state = {
  currentView: "add",
  entries: [],
  equipment: [],
  cleaningLogs: [],
  recommendations: [],
  editingId: null,
  editingEquipmentId: null,
  filters: { date: "", coffee: "" },
  historyLimit: HISTORY_PAGE,
  settings: {
    caffeine_limit_mg: 400,
    target_time_min_s: 25,
    target_time_max_s: 30,
    target_pressure_min_bar: 8,
    target_pressure_max_bar: 10,
  },
  shelly: { price: 0.35, baseline: null },
  usedExtractions: new Set(),
  shownExtraction: null,
  extractionErrors: 0,
  lastLoadedAt: 0,
};

const timers = { shelly: null, extraction: null, resize: null };

const $ = (id) => document.getElementById(id);

const el = {
  tabs: $("tabs"),
  refreshBtn: $("refreshBtn"),
  toast: $("toast"),

  /* Shot */
  addTitle: $("addTitle"),
  editBadge: $("editBadge"),
  extractionSuggestion: $("extractionSuggestion"),
  quickCoffeeButtons: $("quickCoffeeButtons"),
  recommendationBox: $("recommendationBox"),
  recommendationTitle: $("recommendationTitle"),
  recommendationText: $("recommendationText"),
  applyRecommendationBtn: $("applyRecommendationBtn"),
  entryForm: $("entryForm"),
  entryDetails: $("entryDetails"),
  coffeeName: $("coffeeName"),
  coffeeSuggestions: $("coffeeSuggestions"),
  mahlgrad: $("mahlgrad"),
  extractionTime: $("extractionTime"),
  doseG: $("doseG"),
  yieldG: $("yieldG"),
  ratioHint: $("ratioHint"),
  ratingPicker: $("ratingPicker"),
  ratingText: $("ratingText"),
  rating: $("rating"),
  brewMethod: $("brewMethod"),
  caffeineMg: $("caffeineMg"),
  grinderSelect: $("grinderSelect"),
  machineSelect: $("machineSelect"),
  entryDate: $("entryDate"),
  entryTime: $("entryTime"),
  pressureBar: $("pressureBar"),
  temperatureC: $("temperatureC"),
  note: $("note"),
  coffeeError: $("coffeeError"),
  mahlgradError: $("mahlgradError"),
  formError: $("formError"),
  formMessage: $("formMessage"),
  saveEntryBtn: $("saveEntryBtn"),
  duplicateLastBtn: $("duplicateLastBtn"),
  resetFormBtn: $("resetFormBtn"),
  cancelEditBtn: $("cancelEditBtn"),
  deleteEntryBtn: $("deleteEntryBtn"),

  /* Tipps */
  recommendationsList: $("recommendationsList"),
  recommendationsCount: $("recommendationsCount"),

  /* Verlauf */
  filterDate: $("filterDate"),
  filterCoffee: $("filterCoffee"),
  clearFiltersBtn: $("clearFiltersBtn"),
  entriesList: $("entriesList"),
  entriesCount: $("entriesCount"),
  loadMoreBtn: $("loadMoreBtn"),

  /* Stats */
  todayCount: $("todayCount"),
  todayCountSub: $("todayCountSub"),
  todayCaffeine: $("todayCaffeine"),
  limitText: $("limitText"),
  avgTime: $("avgTime"),
  avgTimeSub: $("avgTimeSub"),
  hitRate: $("hitRate"),
  overLimitHint: $("overLimitHint"),
  shellyContent: $("shellyContent"),
  shellyStatusBadge: $("shellyStatusBadge"),
  shellyUpdateTime: $("shellyUpdateTime"),
  weekCanvas: $("weekCanvas"),
  weekCompare: $("weekCompare"),
  trendCanvas: $("trendCanvas"),
  trendBadge: $("trendBadge"),
  coffeeRanking: $("coffeeRanking"),
  topShots: $("topShots"),
  methodCanvas: $("methodCanvas"),
  methodBars: $("methodBars"),
  heatmap: $("heatmap"),
  peakHour: $("peakHour"),

  /* Geräte */
  cleaningCount: $("cleaningCount"),
  cleaningStatus: $("cleaningStatus"),
  cleaningFormDetails: $("cleaningFormDetails"),
  cleaningForm: $("cleaningForm"),
  cleaningEquipment: $("cleaningEquipment"),
  cleaningType: $("cleaningType"),
  cleaningDate: $("cleaningDate"),
  cleaningNotes: $("cleaningNotes"),
  cleaningMessage: $("cleaningMessage"),
  saveCleaningBtn: $("saveCleaningBtn"),
  resetCleaningBtn: $("resetCleaningBtn"),
  cleaningHistorySummary: $("cleaningHistorySummary"),
  cleaningList: $("cleaningList"),
  equipmentCount: $("equipmentCount"),
  equipmentList: $("equipmentList"),
  equipmentFormDetails: $("equipmentFormDetails"),
  equipmentFormSummary: $("equipmentFormSummary"),
  equipmentForm: $("equipmentForm"),
  equipmentCategory: $("equipmentCategory"),
  equipmentName: $("equipmentName"),
  equipmentBrand: $("equipmentBrand"),
  equipmentModel: $("equipmentModel"),
  equipmentPurchaseDate: $("equipmentPurchaseDate"),
  equipmentPrice: $("equipmentPrice"),
  equipmentFacts: $("equipmentFacts"),
  equipmentNotes: $("equipmentNotes"),
  equipmentActive: $("equipmentActive"),
  equipmentMessage: $("equipmentMessage"),
  saveEquipmentBtn: $("saveEquipmentBtn"),
  cancelEquipmentEditBtn: $("cancelEquipmentEditBtn"),
  deleteEquipmentBtn: $("deleteEquipmentBtn"),

  /* Mehr */
  targetTimeMin: $("targetTimeMin"),
  targetTimeMax: $("targetTimeMax"),
  targetPressureMin: $("targetPressureMin"),
  targetPressureMax: $("targetPressureMax"),
  limitInput: $("limitInput"),
  saveSettingsBtn: $("saveSettingsBtn"),
  settingsMessage: $("settingsMessage"),
  shellyPrice: $("shellyPrice"),
  saveShellyBtn: $("saveShellyBtn"),
  shellySettingsMessage: $("shellySettingsMessage"),
  deleteAllBtn: $("deleteAllBtn"),
};


/* ============================================================
   Helper
   ============================================================ */

const pad = (n) => String(n).padStart(2, "0");

/* Lokales Datum (nicht UTC!) – sonst ist zwischen 0 und 2 Uhr der falsche Tag „heute" */
function localISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO() { return localISO(); }
function nowTime(d = new Date()) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function startOfTodayISO() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value, decimals = 0) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatFixed(value, decimals) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .trim();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEntryTime(time) { return time ? String(time).slice(0, 5) : "–"; }

function formatDateShort(date) {
  if (!date) return "–";
  return new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDateHeader(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === todayISO()) return "Heute";
  if (date === localISO(yesterday)) return "Gestern";
  return new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function relativeAge(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `vor ${sec} s`;
  if (sec < 3600) return `vor ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `vor ${Math.floor(sec / 3600)} h`;
  return `vor ${Math.floor(sec / 86400)} T`;
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const start = new Date(`${dateStr}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.round((today - start) / 86400000);
}

function daysText(days) {
  if (!Number.isFinite(days)) return "noch nie";
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
}

function showToast(message, type = "info") {
  el.toast.textContent = message;
  el.toast.classList.toggle("error", type === "error");
  el.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("show"), type === "error" ? 4000 : 2600);
}

function setMsg(node, message, type) {
  if (!node) return;
  node.textContent = message || "";
  node.style.color = type === "error" ? "var(--danger)" : "";
}

function setButtonLoading(btn, loading, loadText, defaultText) {
  btn.disabled = loading;
  btn.textContent = loading ? loadText : defaultText;
}

function getLastNDays(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i) - offset);
    return localISO(d);
  });
}

function getMethodIcon(method) {
  const t = normalize(method);
  if (t.includes("espresso")) return "☕";
  if (t.includes("v60") || t.includes("filter")) return "🔻";
  if (t.includes("french")) return "🫙";
  if (t.includes("cold")) return "🧊";
  return "☕";
}

function getEquipmentIcon(category) {
  const t = normalize(category);
  if (t.includes("maschine")) return "☕";
  if (t.includes("muhle")) return "⚙️";
  if (t.includes("sieb")) return "🧺";
  if (t.includes("waage")) return "⚖️";
  if (t.includes("tamper")) return "⬇️";
  if (t.includes("zubehor")) return "🧰";
  return "🔧";
}

const isMachine = (item) => normalize(item.category).includes("maschine");
const isGrinder = (item) => normalize(item.category).includes("muhle");

function getEquipmentById(id) {
  if (!id) return null;
  return state.equipment.find((i) => String(i.id) === String(id)) || null;
}

function equipmentLabel(item) {
  return [item.brand, item.model || item.name].filter(Boolean).join(" ") || item.name || "Gerät";
}

function equipmentName(id) {
  const item = getEquipmentById(id);
  return item ? equipmentLabel(item) : "Keine Mühle";
}

function sumCaffeine(entries) {
  return entries.reduce((s, e) => s + (Number(e.caffeine_mg) || 0), 0);
}

function entryMoment(entry) {
  return new Date(`${entry.entry_date}T${entry.entry_time || "00:00:00"}`);
}

function isViewActive(name) { return state.currentView === name; }

function sortedByTime(entries) {
  return [...entries].sort((a, b) => entryMoment(a) - entryMoment(b));
}


/* ============================================================
   Init & Navigation
   ============================================================ */

async function init() {
  loadShellySettings();
  loadUsedExtractions();
  bindEvents();
  initFormDefaults();
  renderSkeletons();

  if (!supabaseClient) {
    showToast("Supabase konnte nicht geladen werden. Internetverbindung prüfen.", "error");
    return;
  }

  await reloadAll();
  openView("add");
}

function initFormDefaults() {
  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();
  el.doseG.value = "18";
  el.yieldG.value = "36";
  el.caffeineMg.value = "80";
  el.cleaningDate.value = todayISO();
  setRating("");
  updateRatio();
}

function openView(viewName, { scroll = true } = {}) {
  state.currentView = viewName;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.view === viewName;
    t.classList.toggle("active", active);
    t.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${viewName}`));
  if (scroll) window.scrollTo({ top: 0, behavior: "auto" });

  stopTimers();

  if (viewName === "add") {
    checkExtractionSuggestion();
    startExtractionPolling();
  }
  if (viewName === "recommendations") renderRecommendations();
  if (viewName === "history") renderEntries();
  if (viewName === "equipment") { renderCleaning(); renderEquipment(); }
  if (viewName === "dashboard") {
    renderDashboard();
    renderShellyPanel();
    timers.shelly = setInterval(renderShellyPanel, SHELLY_POLL_MS);
  }
}

function stopTimers() {
  clearInterval(timers.shelly);
  clearInterval(timers.extraction);
  timers.shelly = null;
  timers.extraction = null;
}

function startExtractionPolling() {
  clearInterval(timers.extraction);
  timers.extraction = setInterval(checkExtractionSuggestion, EXTRACTION_POLL_MS);
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => openView(tab.dataset.view));
  });

  el.refreshBtn.addEventListener("click", manualRefresh);

  /* Shot */
  el.entryForm.addEventListener("submit", saveEntry);
  el.resetFormBtn.addEventListener("click", () => { resetForm(); showToast("Formular geleert"); });
  el.cancelEditBtn.addEventListener("click", () => { resetForm(); openView("history"); });
  el.deleteEntryBtn.addEventListener("click", deleteEditedEntry);
  el.duplicateLastBtn.addEventListener("click", duplicateLastShot);
  el.applyRecommendationBtn.addEventListener("click", applyCurrentRecommendation);

  el.coffeeName.addEventListener("input", () => { updateCurrentRecommendation(); renderQuickCoffeeButtons(); });
  el.grinderSelect.addEventListener("change", updateCurrentRecommendation);
  el.brewMethod.addEventListener("change", () => {
    el.caffeineMg.value = methodDefaultCaffeine(el.brewMethod.value);
    updateCurrentRecommendation();
    renderQuickCoffeeButtons();
  });
  el.doseG.addEventListener("input", updateRatio);
  el.yieldG.addEventListener("input", updateRatio);

  el.ratingPicker.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    const v = btn.dataset.value;
    setRating(el.rating.value === v ? "" : v);
  });

  el.extractionSuggestion.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ex]");
    if (!btn || !state.shownExtraction) return;
    if (btn.dataset.ex === "apply") applyExtraction(state.shownExtraction);
    else dismissExtraction(state.shownExtraction);
  });

  el.quickCoffeeButtons.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-coffee]");
    if (chip) selectQuickCoffee(chip.dataset.coffee);
  });

  /* Verlauf */
  el.filterDate.addEventListener("change", () => { state.filters.date = el.filterDate.value; state.historyLimit = HISTORY_PAGE; renderEntries(); });
  el.filterCoffee.addEventListener("change", () => { state.filters.coffee = el.filterCoffee.value; state.historyLimit = HISTORY_PAGE; renderEntries(); });
  el.clearFiltersBtn.addEventListener("click", () => {
    state.filters = { date: "", coffee: "" };
    el.filterDate.value = "";
    el.filterCoffee.value = "";
    renderEntries();
  });
  el.loadMoreBtn.addEventListener("click", () => { state.historyLimit += HISTORY_PAGE; renderEntries(); });

  /* Geräte */
  el.cleaningStatus.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clean]");
    if (btn) quickClean(btn.dataset.id, btn.dataset.clean);
  });
  el.cleaningForm.addEventListener("submit", saveCleaning);
  el.resetCleaningBtn.addEventListener("click", resetCleaningForm);
  el.equipmentForm.addEventListener("submit", saveEquipment);
  el.cancelEquipmentEditBtn.addEventListener("click", () => { resetEquipmentForm(); el.equipmentFormDetails.open = false; });
  el.deleteEquipmentBtn.addEventListener("click", deleteEditedEquipment);

  /* Mehr */
  el.saveSettingsBtn.addEventListener("click", saveSettings);
  el.saveShellyBtn.addEventListener("click", saveShellySettings);
  el.deleteAllBtn.addEventListener("click", deleteAllEntries);

  /* App kommt aus dem Hintergrund zurück */
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) { stopTimers(); return; }
    if (Date.now() - state.lastLoadedAt > RELOAD_AFTER_MS) await reloadAll();
    openView(state.currentView, { scroll: false });
  });

  window.addEventListener("resize", () => {
    clearTimeout(timers.resize);
    timers.resize = setTimeout(() => { if (isViewActive("dashboard")) renderDashboard(); }, 200);
  });
}

async function manualRefresh() {
  el.refreshBtn.classList.add("spinning");
  el.refreshBtn.disabled = true;
  state.shelly.baseline = null;
  await reloadAll();
  openView(state.currentView, { scroll: false });
  el.refreshBtn.classList.remove("spinning");
  el.refreshBtn.disabled = false;
  showToast("Aktualisiert");
}


/* ============================================================
   Laden
   ============================================================ */

async function reloadAll() {
  await Promise.all([loadSettings(), loadEntries(), loadEquipment(), loadCleaningLogs()]);
  state.lastLoadedAt = Date.now();
  renderAll();
}

async function loadSettings() {
  const { data, error } = await supabaseClient.from(TABLE_SETTINGS).select("*").eq("id", 1).maybeSingle();
  if (error) { console.error("Settings:", error); return; }
  if (data) {
    state.settings = {
      caffeine_limit_mg:       Number(data.caffeine_limit_mg)       || 400,
      target_time_min_s:       Number(data.target_time_min_s)       || 25,
      target_time_max_s:       Number(data.target_time_max_s)       || 30,
      target_pressure_min_bar: Number(data.target_pressure_min_bar) || 8,
      target_pressure_max_bar: Number(data.target_pressure_max_bar) || 10,
    };
  }
  el.limitInput.value        = state.settings.caffeine_limit_mg;
  el.targetTimeMin.value     = state.settings.target_time_min_s;
  el.targetTimeMax.value     = state.settings.target_time_max_s;
  el.targetPressureMin.value = state.settings.target_pressure_min_bar;
  el.targetPressureMax.value = state.settings.target_pressure_max_bar;
}

async function loadEntries() {
  const { data, error } = await supabaseClient
    .from(TABLE_ENTRIES).select("*")
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false });
  if (error) { console.error("Entries:", error); showToast("Shots konnten nicht geladen werden.", "error"); return; }
  state.entries = data || [];
}

async function loadEquipment() {
  const { data, error } = await supabaseClient
    .from(TABLE_EQUIPMENT).select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) { console.error("Equipment:", error); return; }
  state.equipment = data || [];
}

async function loadCleaningLogs() {
  const { data, error } = await supabaseClient
    .from(TABLE_CLEANING).select("*")
    .order("cleaned_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) { console.error("Cleaning:", error); return; }
  state.cleaningLogs = data || [];
}


/* ============================================================
   Rendern (global)
   ============================================================ */

function renderAll() {
  state.recommendations = buildRecommendations(state.entries);
  renderEquipmentSelects();
  renderCleaningEquipmentSelect();
  renderCoffeeSuggestions();
  renderQuickCoffeeButtons();
  updateCurrentRecommendation();
  renderRecommendations();
  renderEntries();
  renderEquipment();
  renderCleaning();
  if (isViewActive("dashboard")) renderDashboard();
}

function renderSkeletons() {
  const sk = `<div class="skeleton"></div><div class="skeleton"></div>`;
  el.entriesList.innerHTML = sk;
  el.recommendationsList.innerHTML = sk;
  el.equipmentList.innerHTML = sk;
}

function renderEquipmentSelects() {
  const curM = el.machineSelect.value;
  const curG = el.grinderSelect.value;
  const machines = state.equipment.filter((i) => i.is_active && isMachine(i));
  const grinders = state.equipment.filter((i) => i.is_active && isGrinder(i));

  el.machineSelect.innerHTML = `<option value="">Keine Maschine</option>` +
    machines.map((i) => `<option value="${i.id}">${escapeHTML(equipmentLabel(i))}</option>`).join("");
  el.grinderSelect.innerHTML = `<option value="">Keine Mühle</option>` +
    grinders.map((i) => `<option value="${i.id}">${escapeHTML(equipmentLabel(i))}</option>`).join("");

  el.machineSelect.value = curM;
  el.grinderSelect.value = curG;
  if (!el.machineSelect.value && machines.length === 1) el.machineSelect.value = machines[0].id;
  if (!el.grinderSelect.value && grinders.length === 1) el.grinderSelect.value = grinders[0].id;
}

function renderCoffeeSuggestions() {
  const coffees = Array.from(new Set(state.entries.map((e) => e.drink_name).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "de"));
  el.coffeeSuggestions.innerHTML = coffees.map((c) => `<option value="${escapeHTML(c)}"></option>`).join("");
  el.filterCoffee.innerHTML = `<option value="">Alle Kaffees</option>` +
    coffees.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  el.filterCoffee.value = state.filters.coffee;
}

function getTopCoffeeNames() {
  const map = new Map();
  state.entries.forEach((e) => { if (e.drink_name) map.set(e.drink_name, (map.get(e.drink_name) || 0) + 1); });
  return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}


/* ============================================================
   Shelly: erkannte Extraktion vorschlagen
   ============================================================ */

function loadUsedExtractions() {
  try {
    const raw = JSON.parse(localStorage.getItem("ct_used_extractions") || "[]");
    state.usedExtractions = new Set(raw.map(String));
  } catch { state.usedExtractions = new Set(); }
}

function markExtractionUsed(id) {
  state.usedExtractions.add(String(id));
  const list = Array.from(state.usedExtractions).slice(-60);
  state.usedExtractions = new Set(list);
  try { localStorage.setItem("ct_used_extractions", JSON.stringify(list)); } catch { /* ignore */ }
}

function hideExtraction() {
  state.shownExtraction = null;
  el.extractionSuggestion.classList.add("hidden");
  el.extractionSuggestion.innerHTML = "";
}

async function checkExtractionSuggestion() {
  if (!supabaseClient || state.extractionErrors >= 3) return;
  if (state.editingId || !isViewActive("add") || document.hidden) { if (state.editingId) hideExtraction(); return; }

  const since = new Date(Date.now() - EXTRACTION_LOOKBACK_MIN * 60000).toISOString();
  const { data, error } = await supabaseClient
    .from(TABLE_EXTRACTIONS)
    .select("id, started_at, duration_s, avg_power_w, peak_power_w")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(5);

  if (error) {
    state.extractionErrors++;
    console.warn("Extraktionen:", error.message);
    hideExtraction();
    return;
  }
  state.extractionErrors = 0;

  const next = (data || []).find((x) => !state.usedExtractions.has(String(x.id)));
  if (!next) { hideExtraction(); return; }
  renderExtractionSuggestion(next);
}

function renderExtractionSuggestion(x) {
  state.shownExtraction = x;
  const started = new Date(x.started_at);
  const duration = Math.round(Number(x.duration_s) * 10) / 10;
  el.extractionSuggestion.innerHTML = `
    <div class="ex-body">
      <span class="ex-time">${formatNumber(duration, 1)} s</span>
      <p>Extraktion erkannt, ${nowTime(started)} Uhr (${relativeAge(Date.now() - started.getTime())})</p>
    </div>
    <div class="extraction-actions">
      <button class="primary" type="button" data-ex="apply">Übernehmen</button>
      <button class="ghost" type="button" data-ex="dismiss" aria-label="Vorschlag verwerfen">×</button>
    </div>`;
  el.extractionSuggestion.classList.remove("hidden");
}

function applyExtraction(x) {
  const started = new Date(x.started_at);
  el.extractionTime.value = String(Math.round(Number(x.duration_s) * 10) / 10);
  el.entryDate.value = localISO(started);
  el.entryTime.value = nowTime(started);
  markExtractionUsed(x.id);
  hideExtraction();
  flashField(el.extractionTime);
  showToast(`Extraktionszeit übernommen: ${formatNumber(x.duration_s, 1)} s`);
}

function dismissExtraction(x) {
  markExtractionUsed(x.id);
  hideExtraction();
}

function flashField(input) {
  input.classList.remove("flash");
  void input.offsetWidth;
  input.classList.add("flash");
}


/* ============================================================
   Shelly: Energie-Panel
   ============================================================ */

function loadShellySettings() {
  try {
    const s = JSON.parse(localStorage.getItem("ct_shelly") || "{}");
    if (Number(s.price) > 0) state.shelly.price = Number(s.price);
  } catch { /* ignore */ }
  el.shellyPrice.value = state.shelly.price;
}

function saveShellySettings() {
  const price = toNumber(el.shellyPrice.value);
  if (price === null || price <= 0) { setMsg(el.shellySettingsMessage, "Bitte einen Preis größer 0 eintragen.", "error"); return; }
  state.shelly.price = price;
  try { localStorage.setItem("ct_shelly", JSON.stringify({ price })); } catch { /* ignore */ }
  setMsg(el.shellySettingsMessage, "");
  showToast("Strompreis gespeichert");
}

/* Zählerstand zu Tagesbeginn: letzter Wert vor Mitternacht, sonst erster Wert von heute */
async function fetchShellyBaseline(todayStart) {
  const before = await supabaseClient
    .from(TABLE_SHELLY_LOGS).select("aenergy_wh")
    .lt("recorded_at", todayStart).not("aenergy_wh", "is", null)
    .order("recorded_at", { ascending: false }).limit(1).maybeSingle();
  if (before.data) return Number(before.data.aenergy_wh);

  const first = await supabaseClient
    .from(TABLE_SHELLY_LOGS).select("aenergy_wh")
    .gte("recorded_at", todayStart).not("aenergy_wh", "is", null)
    .order("recorded_at", { ascending: true }).limit(1).maybeSingle();
  return first.data ? Number(first.data.aenergy_wh) : null;
}

async function renderShellyPanel() {
  if (!supabaseClient) return;
  const today = todayISO();
  const todayStart = startOfTodayISO();

  if (!el.shellyContent.querySelector(".shelly-stats")) {
    el.shellyContent.innerHTML = `<div class="empty">Lade Shelly-Daten …</div>`;
  }

  const needBaseline = !state.shelly.baseline || state.shelly.baseline.date !== today;

  const [latestRes, extrRes, baselineWh] = await Promise.all([
    supabaseClient.from(TABLE_SHELLY_LOGS)
      .select("recorded_at, output, apower_w, aenergy_wh, temperature_c")
      .order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseClient.from(TABLE_EXTRACTIONS)
      .select("started_at, duration_s")
      .gte("started_at", todayStart)
      .order("started_at", { ascending: false }).limit(100),
    needBaseline ? fetchShellyBaseline(todayStart) : Promise.resolve(state.shelly.baseline.wh),
  ]);

  const latest = latestRes.data;
  if (latestRes.error || !latest) {
    el.shellyContent.innerHTML = `
      <div class="shelly-error">
        Noch keine Daten der Shelly in der Datenbank. Prüfe in der Shelly-App unter Skripte, ob „SyncSupabase“ läuft.
      </div>`;
    setBadge(el.shellyStatusBadge, "Keine Daten", "is-warn");
    el.shellyUpdateTime.textContent = "";
    return;
  }

  if (needBaseline && baselineWh !== null) state.shelly.baseline = { date: today, wh: baselineWh };

  const price    = state.shelly.price;
  const recorded = new Date(latest.recorded_at);
  const ageMs    = Date.now() - recorded.getTime();
  const isOn     = Boolean(latest.output);
  const stale    = isOn && ageMs > SHELLY_STALE_MIN * 60000;
  const totalWh  = Number(latest.aenergy_wh) || 0;
  const tempC    = latest.temperature_c != null ? Number(latest.temperature_c) : null;

  let todayKwh = 0;
  if (state.shelly.baseline && state.shelly.baseline.date === today) {
    if (totalWh < state.shelly.baseline.wh) state.shelly.baseline.wh = totalWh; // Zähler wurde zurückgesetzt
    else todayKwh = (totalWh - state.shelly.baseline.wh) / 1000;
  }
  const totalKwh = totalWh / 1000;

  const extractions = extrRes.error ? [] : (extrRes.data || []);
  const lastExtr = extractions[0];

  let statusText = "Aus", statusClass = "is-off";
  if (isOn && !stale) { statusText = "An"; statusClass = "is-on"; }
  if (stale) { statusText = "Unklar"; statusClass = "is-warn"; }

  setBadge(el.shellyStatusBadge,
    stale ? "Keine aktuellen Daten" : isOn ? "Maschine an" : "Maschine aus",
    stale ? "is-warn" : isOn ? "is-ok" : "is-off");

  const nb = "\u00a0"; // Zahl und Einheit nicht umbrechen
  el.shellyContent.innerHTML = `
    <div class="shelly-stats">
      <div class="shelly-stat shelly-stat-status ${statusClass}">
        <span class="shelly-stat-label">Status</span>
        <span class="shelly-stat-value">${statusText}${isOn && !stale ? `<small>${formatNumber(latest.apower_w, 0)}${nb}W</small>` : ""}</span>
      </div>
      <div class="shelly-stat">
        <span class="shelly-stat-label">Heute</span>
        <span class="shelly-stat-value">${formatFixed(todayKwh, 2)}${nb}kWh</span>
        <span class="shelly-stat-sub">${formatFixed(todayKwh * price, 2)}${nb}€</span>
      </div>
      <div class="shelly-stat">
        <span class="shelly-stat-label">Shots erkannt</span>
        <span class="shelly-stat-value">${extrRes.error ? "–" : extractions.length}</span>
        <span class="shelly-stat-sub">${lastExtr ? `zuletzt ${formatNumber(lastExtr.duration_s, 1)}${nb}s` : "heute"}</span>
      </div>
      <div class="shelly-stat">
        <span class="shelly-stat-label">Zähler gesamt</span>
        <span class="shelly-stat-value">${formatNumber(totalKwh, 1)}${nb}kWh</span>
        <span class="shelly-stat-sub">${formatFixed(totalKwh * price, 2)}${nb}€</span>
      </div>
      <div class="shelly-stat ${tempC !== null && tempC > 60 ? "is-warn" : ""}">
        <span class="shelly-stat-label">Steckdose</span>
        <span class="shelly-stat-value">${tempC !== null ? `${formatNumber(tempC, 1)}${nb}°C` : "–"}</span>
        <span class="shelly-stat-sub">Temperatur</span>
      </div>
    </div>`;

  el.shellyUpdateTime.textContent = isOn
    ? `Letzter Messwert ${nowTime(recorded)} Uhr, ${relativeAge(ageMs)}`
    : `Maschine aus seit ${recorded.toLocaleDateString("de-DE") === new Date().toLocaleDateString("de-DE") ? "" : recorded.toLocaleDateString("de-DE") + ", "}${nowTime(recorded)} Uhr`;
}

function setBadge(node, text, cls) {
  node.textContent = text;
  node.classList.remove("is-ok", "is-off", "is-warn");
  if (cls) node.classList.add(cls);
}


/* ============================================================
   Empfehlungen
   ============================================================ */

function scoreShot(entry) {
  const rating   = toNumber(entry.rating);
  const time     = toNumber(entry.extraction_time_s);
  const pressure = toNumber(entry.pressure_bar);
  const s        = state.settings;
  const tTime    = (Number(s.target_time_min_s) + Number(s.target_time_max_s)) / 2;
  const tPress   = (Number(s.target_pressure_min_bar) + Number(s.target_pressure_max_bar)) / 2;
  let score = 0;
  score += rating !== null ? (rating / 5) * 55 : 18;
  if (time !== null)     score += Math.max(0, 25 - Math.abs(time - tTime) * 3.2);
  if (pressure !== null) score += Math.max(0, 14 - Math.abs(pressure - tPress) * 4);
  if (entry.entry_date)  score += Math.max(0, 6 - daysSince(entry.entry_date) * 0.08);
  return Math.round(score);
}

function isShotInTarget(entry) {
  const s = state.settings;
  const time = toNumber(entry.extraction_time_s);
  const pressure = toNumber(entry.pressure_bar);
  const timeOk  = time !== null && time >= s.target_time_min_s && time <= s.target_time_max_s;
  const pressOk = pressure === null || (pressure >= s.target_pressure_min_bar && pressure <= s.target_pressure_max_bar);
  return timeOk && pressOk;
}

/* Reinigungs-Zeitpunkt: exakt über created_at, wenn am selben Tag angelegt, sonst Tagesbeginn */
function cleaningMoment(log) {
  if (log.created_at) {
    const created = new Date(log.created_at);
    if (localISO(created) === log.cleaned_at) return created;
  }
  return new Date(`${log.cleaned_at}T00:00:00`);
}

function getLastCleaning(equipmentId, type = null) {
  return state.cleaningLogs.find((c) =>
    String(c.equipment_id) === String(equipmentId) && (!type || c.cleaning_type === type)) || null;
}

function isShotAfterLastBigCleaning(entry) {
  if (!entry.grinder_id || !entry.entry_date) return true;
  const log = getLastCleaning(entry.grinder_id, "gross");
  if (!log) return true;
  return entryMoment(entry) >= cleaningMoment(log);
}

/* Reinigung, die zum Zeitpunkt des Shots zuletzt stattgefunden hat */
function getCleaningIdForShot(grinderId, date, time) {
  if (!grinderId) return null;
  const moment = new Date(`${date}T${time || "00:00:00"}`);
  const log = state.cleaningLogs.find((c) =>
    String(c.equipment_id) === String(grinderId) && cleaningMoment(c) <= moment);
  return log ? log.id : null;
}

/* Espresso und Doppelter Espresso teilen sich den Mahlgrad, Filter-Methoden nicht */
function methodGroup(method) {
  const t = normalize(method || "Espresso");
  return t.includes("espresso") ? "espresso" : t;
}

function recommendationKey(e) {
  return `${normalize(e.drink_name)}__${e.grinder_id || "none"}__${methodGroup(e.drink_type)}`;
}

function buildRecommendations(entries) {
  const groups = new Map();
  entries
    .filter((e) => e.drink_name && toNumber(e.mahlgrad) !== null)
    .forEach((e) => {
      const k = recommendationKey(e);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });

  return Array.from(groups.values())
    .map((group) => {
      const fresh = group.filter(isShotAfterLastBigCleaning);
      const stale = fresh.length === 0;
      return buildRecommendationFromGroup(stale ? group : fresh, stale);
    })
    .sort((a, b) => (a.stale - b.stale) || (b.score - a.score));
}

function buildRecommendationFromGroup(group, stale) {
  const sorted    = [...group].sort((a, b) => scoreShot(b) - scoreShot(a));
  const best      = sorted[0];
  const goodShots = group.filter((e) => scoreShot(e) >= 75 || isShotInTarget(e));
  const baseShots = goodShots.length ? goodShots : [best];
  const grinds    = baseShots.map((e) => Number(e.mahlgrad)).filter(Number.isFinite).sort((a, b) => a - b);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const nums = (key) => group.map((e) => toNumber(e[key])).filter((v) => v !== null);

  return {
    coffee_name:   best.drink_name,
    method:        best.drink_type || "Espresso",
    method_group:  methodGroup(best.drink_type),
    grinder_id:    best.grinder_id || null,
    grinder_name:  equipmentName(best.grinder_id),
    best_grind:    Number(best.mahlgrad),
    grind_min:     grinds[0],
    grind_max:     grinds[grinds.length - 1],
    best_entry:    best,
    shots_count:   group.length,
    hit_count:     group.filter(isShotInTarget).length,
    avg_time:      avg(nums("extraction_time_s")),
    avg_pressure:  avg(nums("pressure_bar")),
    avg_rating:    avg(nums("rating")),
    score:         scoreShot(best),
    confidence:    group.length >= 6 ? "stabil" : group.length >= 3 ? "vorläufig" : "erster Richtwert",
    hint:          buildGrindHint(best),
    stale,
    cleaning_info: buildCleaningInfo(best.grinder_id, stale),
  };
}

function buildCleaningInfo(grinderId, stale) {
  const log = grinderId ? getLastCleaning(grinderId, "gross") : null;
  if (!log) return null;
  if (stale) return `Seit der großen Reinigung am ${formatDateShort(log.cleaned_at)} noch kein Shot. Werte stammen von davor – Nullpunkt der Mühle prüfen.`;
  return `Basis: Shots seit der großen Reinigung am ${formatDateShort(log.cleaned_at)}.`;
}

function buildGrindHint(entry) {
  const s = state.settings;
  const time = toNumber(entry.extraction_time_s);
  const pressure = toNumber(entry.pressure_bar);
  if (time === null) return "Beim nächsten Shot die Extraktionszeit eintragen, dann wird die Empfehlung genauer.";
  if (time < s.target_time_min_s) return "Der beste Shot lief eher zu schnell – beim nächsten Mal etwas feiner mahlen.";
  if (time > s.target_time_max_s) return "Der beste Shot lief eher zu langsam – beim nächsten Mal etwas gröber mahlen.";
  if (pressure !== null && pressure < s.target_pressure_min_bar) return "Zeit passt, Druck eher niedrig. Puck-Prep prüfen oder minimal feiner mahlen.";
  if (pressure !== null && pressure > s.target_pressure_max_bar) return "Zeit passt, Druck eher hoch. Puck-Prep prüfen oder minimal gröber mahlen.";
  return "Sehr guter Bereich – Mahlgrad beibehalten.";
}

function findRecommendation(coffeeName, grinderId, method = el.brewMethod.value) {
  const nc = normalize(coffeeName);
  if (!nc) return null;
  const mg = methodGroup(method);
  const same = state.recommendations.filter((r) => normalize(r.coffee_name) === nc && r.method_group === mg);
  return same.find((r) => String(r.grinder_id || "") === String(grinderId || "")) || same[0] || null;
}

function grindRangeText(rec) {
  return rec.grind_min !== rec.grind_max
    ? `${formatNumber(rec.grind_min, 1)}–${formatNumber(rec.grind_max, 1)}`
    : formatNumber(rec.best_grind, 1);
}

function updateCurrentRecommendation() {
  const rec = findRecommendation(el.coffeeName.value.trim(), el.grinderSelect.value);
  if (!el.coffeeName.value.trim()) { el.recommendationBox.classList.add("hidden"); return; }

  el.recommendationBox.classList.remove("hidden");
  if (!rec) {
    el.recommendationBox.classList.remove("is-stale");
    el.recommendationTitle.textContent = "Neuer Kaffee";
    el.recommendationText.textContent = "Noch keine Shots mit Mahlgrad – nach dem ersten Shot gibt es hier eine Empfehlung.";
    el.applyRecommendationBtn.classList.add("hidden");
    return;
  }

  el.recommendationBox.classList.toggle("is-stale", rec.stale);
  el.applyRecommendationBtn.classList.remove("hidden");
  el.recommendationTitle.textContent = `Empfohlener Mahlgrad: ${grindRangeText(rec)}`;
  const parts = [
    `${rec.shots_count} ${rec.shots_count === 1 ? "Shot" : "Shots"} (${rec.confidence})`,
    rec.avg_time !== null ? `Ø ${formatNumber(rec.avg_time, 1)} s` : null,
  ].filter(Boolean).join(", ");
  el.recommendationText.textContent = rec.stale
    ? `${parts}. ⚠️ Mühle wurde seitdem groß gereinigt – Nullpunkt prüfen.`
    : `${parts}. ${rec.hint}`;
}

function applyRecommendation(rec) {
  el.mahlgrad.value     = rec.best_grind ?? "";
  el.doseG.value        = rec.best_entry.dose_g ?? el.doseG.value;
  el.yieldG.value       = rec.best_entry.yield_g ?? el.yieldG.value;
  el.pressureBar.value  = rec.best_entry.pressure_bar ?? "";
  el.temperatureC.value = rec.best_entry.temperature_c ?? "";
  if (rec.grinder_id && !el.grinderSelect.value) el.grinderSelect.value = rec.grinder_id;
  updateRatio();
  flashField(el.mahlgrad);
}

function applyCurrentRecommendation() {
  const rec = findRecommendation(el.coffeeName.value.trim(), el.grinderSelect.value);
  if (!rec) return;
  applyRecommendation(rec);
  showToast(`Mahlgrad ${formatNumber(rec.best_grind, 1)} übernommen`);
}

function renderRecommendations() {
  el.recommendationsCount.textContent = String(state.recommendations.length);

  if (!state.recommendations.length) {
    el.recommendationsList.innerHTML = `<div class="empty">Noch keine Empfehlungen. Speichere ein paar Shots mit Kaffee und Mahlgrad.</div>`;
    return;
  }

  el.recommendationsList.innerHTML = state.recommendations.map((rec, i) => `
    <article class="item-card rec-card ${rec.stale ? "mid" : confidenceClass(rec.confidence)}">
      <div class="rec-top">
        <div>
          <h3>${escapeHTML(rec.coffee_name)}</h3>
          <p>${rec.method_group === "espresso" ? "" : `${escapeHTML(rec.method)}, `}${escapeHTML(rec.grinder_name)}, ${rec.shots_count} ${rec.shots_count === 1 ? "Shot" : "Shots"}, ${rec.confidence}</p>
        </div>
        <div class="grind-badge"><span>Mahlgrad</span><strong>${grindRangeText(rec)}</strong></div>
      </div>
      <div class="meta">
        ${rec.avg_rating !== null ? `<span>⭐ ${formatNumber(rec.avg_rating, 1)}</span>` : ""}
        ${rec.avg_time !== null ? `<span>⏱️ ${formatNumber(rec.avg_time, 1)} s</span>` : ""}
        ${rec.avg_pressure !== null ? `<span>🧭 ${formatNumber(rec.avg_pressure, 1)} bar</span>` : ""}
        <span>🎯 ${rec.hit_count}/${rec.shots_count} im Ziel</span>
      </div>
      <p class="hint">${escapeHTML(rec.hint)}</p>
      ${rec.cleaning_info ? `<p class="info-note ${rec.stale ? "warn" : ""}">${escapeHTML(rec.cleaning_info)}</p>` : ""}
      <button class="primary" type="button" data-rec="${i}">Für neuen Shot nutzen</button>
    </article>`).join("");

  el.recommendationsList.querySelectorAll("[data-rec]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rec = state.recommendations[Number(btn.dataset.rec)];
      resetForm();
      el.coffeeName.value = rec.coffee_name;
      el.brewMethod.value = rec.method;
      el.caffeineMg.value = methodDefaultCaffeine(rec.method);
      if (rec.grinder_id) el.grinderSelect.value = rec.grinder_id;
      applyRecommendation(rec);
      updateCurrentRecommendation();
      renderQuickCoffeeButtons();
      openView("add");
    });
  });
}

function confidenceClass(c) {
  if (c === "stabil") return "good";
  if (c === "vorläufig") return "mid";
  return "bad";
}


/* ============================================================
   Shot-Formular
   ============================================================ */

const RATING_TEXT = { "": "keine", 1: "schlecht", 2: "geht so", 3: "okay", 4: "gut", 5: "sehr gut" };

function setRating(value) {
  const v = value === null || value === undefined ? "" : String(value);
  el.rating.value = v;
  el.ratingPicker.querySelectorAll("button[data-value]").forEach((btn) => {
    const on = v !== "" && Number(btn.dataset.value) <= Number(v);
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", btn.dataset.value === v ? "true" : "false");
  });
  el.ratingText.textContent = RATING_TEXT[v] || "keine";
}

function updateRatio() {
  const dose = toNumber(el.doseG.value);
  const out  = toNumber(el.yieldG.value);
  el.ratioHint.textContent = dose && out ? `Verhältnis 1 : ${formatFixed(out / dose, 1)}` : "";
}

function renderQuickCoffeeButtons() {
  const top = getTopCoffeeNames().slice(0, 8);
  const current = normalize(el.coffeeName.value);
  el.quickCoffeeButtons.innerHTML = top.map(({ name }) => {
    const rec = findRecommendation(name, el.grinderSelect.value);
    return `
      <button type="button" class="quick-chip ${normalize(name) === current ? "selected" : ""}" data-coffee="${escapeHTML(name)}">
        <strong>${escapeHTML(name)}</strong>
        <small>${rec ? `Mahlgrad ${formatNumber(rec.best_grind, 1)}` : "noch keine Empfehlung"}</small>
      </button>`;
  }).join("");
}

function selectQuickCoffee(name) {
  el.coffeeName.value = name;
  el.coffeeError.textContent = "";
  const rec = findRecommendation(name, el.grinderSelect.value);
  if (rec && !el.mahlgrad.value) {
    applyRecommendation(rec);
    setMsg(el.formMessage, `Mahlgrad ${formatNumber(rec.best_grind, 1)} aus der Empfehlung vorausgefüllt.`);
  }
  updateCurrentRecommendation();
  renderQuickCoffeeButtons();
}

function methodDefaultCaffeine(method) {
  const t = normalize(method);
  if (t.includes("doppel")) return 120;
  if (t.includes("espresso")) return 80;
  if (t.includes("v60")) return 120;
  if (t.includes("french")) return 110;
  if (t.includes("cold")) return 150;
  return 95;
}

function readEntryForm() {
  const rawTime = el.entryTime.value || nowTime();
  const entryDate = el.entryDate.value || todayISO();
  const entryTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
  const grinderId = el.grinderSelect.value ? Number(el.grinderSelect.value) : null;
  return {
    entry_date:          entryDate,
    entry_time:          entryTime,
    drink_name:          el.coffeeName.value.trim(),
    drink_type:          el.brewMethod.value,
    emoji:               getMethodIcon(el.brewMethod.value),
    amount_ml:           toNumber(el.yieldG.value),
    caffeine_mg:         toNumber(el.caffeineMg.value),
    dose_g:              toNumber(el.doseG.value),
    yield_g:             toNumber(el.yieldG.value),
    mahlgrad:            toNumber(el.mahlgrad.value),
    extraction_time_s:   toNumber(el.extractionTime.value),
    pressure_bar:        toNumber(el.pressureBar.value),
    temperature_c:       toNumber(el.temperatureC.value),
    rating:              toNumber(el.rating.value),
    note:                el.note.value.trim() || null,
    machine_id:          el.machineSelect.value ? Number(el.machineSelect.value) : null,
    grinder_id:          grinderId,
    grinder_cleaning_id: getCleaningIdForShot(grinderId, entryDate, entryTime),
  };
}

function validateEntryForm(entry) {
  el.coffeeError.textContent = "";
  el.mahlgradError.textContent = "";
  el.formError.textContent = "";
  let firstInvalid = null;
  if (!entry.drink_name) { el.coffeeError.textContent = "Bitte Kaffee oder Bohne eintragen."; firstInvalid = firstInvalid || el.coffeeName; }
  if (entry.mahlgrad === null) { el.mahlgradError.textContent = "Bitte Mahlgrad eintragen."; firstInvalid = firstInvalid || el.mahlgrad; }
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid.focus({ preventScroll: true });
    return false;
  }
  return true;
}

async function saveEntry(event) {
  event.preventDefault();
  const payload = readEntryForm();
  if (!validateEntryForm(payload)) return;

  const isEditing = Boolean(state.editingId);
  const defaultText = isEditing ? "Änderung speichern" : "Shot speichern";
  setButtonLoading(el.saveEntryBtn, true, "Speichere …", defaultText);

  const response = isEditing
    ? await supabaseClient.from(TABLE_ENTRIES).update(payload).eq("id", state.editingId).select().single()
    : await supabaseClient.from(TABLE_ENTRIES).insert(payload).select().single();

  setButtonLoading(el.saveEntryBtn, false, "Speichere …", defaultText);

  if (response.error) {
    console.error("Save:", response.error);
    el.formError.textContent = `Speichern fehlgeschlagen: ${response.error.message}`;
    showToast("Speichern fehlgeschlagen", "error");
    return;
  }

  await loadEntries();
  state.lastLoadedAt = Date.now();

  if (isEditing) {
    resetForm();
    renderAll();
    showToast("Shot aktualisiert");
    openView("history");
    return;
  }

  if (state.shownExtraction) { markExtractionUsed(state.shownExtraction.id); hideExtraction(); }
  prefillNextShot(payload);
  renderAll();
  const rec = findRecommendation(payload.drink_name, payload.grinder_id, payload.drink_type);
  showToast("Shot gespeichert ☕");
  setMsg(el.formMessage, rec ? `Gespeichert. Neue Empfehlung für ${payload.drink_name}: Mahlgrad ${grindRangeText(rec)}.` : "Gespeichert.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Nach dem Speichern: Bohne & Setup bleiben stehen, Shot-spezifisches wird geleert */
function prefillNextShot(saved) {
  state.editingId = null;
  setEditMode(false);
  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();
  el.extractionTime.value = "";
  el.pressureBar.value = "";
  el.note.value = "";
  setRating("");
  el.coffeeName.value = saved.drink_name;
  el.mahlgrad.value = saved.mahlgrad ?? "";
  updateRatio();
}

function setEditMode(on) {
  el.editBadge.classList.toggle("hidden", !on);
  el.addTitle.textContent = on ? "Shot bearbeiten" : "Neuer Shot";
  el.saveEntryBtn.textContent = on ? "Änderung speichern" : "Shot speichern";
  el.cancelEditBtn.classList.toggle("hidden", !on);
  el.deleteEntryBtn.classList.toggle("hidden", !on);
  el.duplicateLastBtn.classList.toggle("hidden", on);
  el.resetFormBtn.classList.toggle("hidden", on);
  if (on) hideExtraction();
}

function resetForm() {
  state.editingId = null;
  setEditMode(false);
  el.entryForm.reset();
  initFormDefaults();
  el.brewMethod.value = "Espresso";
  el.coffeeError.textContent = "";
  el.mahlgradError.textContent = "";
  el.formError.textContent = "";
  setMsg(el.formMessage, "");
  el.entryDetails.open = false;
  renderEquipmentSelects();
  updateCurrentRecommendation();
  renderQuickCoffeeButtons();
}

function fillFormFromEntry(entry, { keepDateTime = false } = {}) {
  el.coffeeName.value     = entry.drink_name || "";
  el.brewMethod.value     = entry.drink_type || "Espresso";
  el.machineSelect.value  = entry.machine_id || "";
  el.grinderSelect.value  = entry.grinder_id || "";
  el.doseG.value          = entry.dose_g ?? "";
  el.yieldG.value         = entry.yield_g ?? "";
  el.mahlgrad.value       = entry.mahlgrad ?? "";
  el.pressureBar.value    = entry.pressure_bar ?? "";
  el.temperatureC.value   = entry.temperature_c ?? "";
  el.caffeineMg.value     = entry.caffeine_mg ?? methodDefaultCaffeine(el.brewMethod.value);
  if (keepDateTime) {
    el.entryDate.value = entry.entry_date || todayISO();
    el.entryTime.value = formatEntryTime(entry.entry_time);
  }
  updateRatio();
}

function startEdit(entry) {
  state.editingId = entry.id;
  fillFormFromEntry(entry, { keepDateTime: true });
  el.extractionTime.value = entry.extraction_time_s ?? "";
  el.note.value = entry.note || "";
  setRating(entry.rating ?? "");
  setEditMode(true);
  el.entryDetails.open = true;
  setMsg(el.formMessage, "");
  updateCurrentRecommendation();
  renderQuickCoffeeButtons();
  openView("add");
}

function duplicateLastShot() {
  const last = state.entries[0];
  if (!last) { showToast("Noch kein Shot vorhanden"); return; }
  state.editingId = null;
  fillFormFromEntry(last);
  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();
  el.extractionTime.value = "";
  el.note.value = "";
  setRating("");
  setMsg(el.formMessage, `Werte vom letzten Shot (${last.drink_name}) übernommen.`);
  updateCurrentRecommendation();
  renderQuickCoffeeButtons();
}

async function deleteEditedEntry() {
  if (!state.editingId) return;
  const ok = await deleteEntry(state.editingId);
  if (ok) { resetForm(); openView("history"); }
}


/* ============================================================
   Verlauf
   ============================================================ */

function getFilteredEntries() {
  return state.entries.filter((e) =>
    (!state.filters.date || e.entry_date === state.filters.date) &&
    (!state.filters.coffee || e.drink_name === state.filters.coffee));
}

function scoreClass(score) { return score >= 80 ? "good" : score >= 60 ? "mid" : "bad"; }

function renderEntries() {
  const all = getFilteredEntries();
  const entries = all.slice(0, state.historyLimit);
  const filtered = Boolean(state.filters.date || state.filters.coffee);

  el.entriesCount.textContent = `${all.length} ${all.length === 1 ? "Shot" : "Shots"}`;
  el.clearFiltersBtn.classList.toggle("hidden", !filtered);
  el.loadMoreBtn.classList.toggle("hidden", all.length <= entries.length);

  if (!entries.length) {
    el.entriesList.innerHTML = `<div class="empty">${filtered ? "Keine Shots für diesen Filter." : "Noch keine Shots. Trag im Shot-Tab deinen ersten ein."}</div>`;
    return;
  }

  const groups = new Map();
  entries.forEach((e) => {
    if (!groups.has(e.entry_date)) groups.set(e.entry_date, []);
    groups.get(e.entry_date).push(e);
  });

  const showGrinderChip = state.equipment.filter(isGrinder).length > 1;
  el.entriesList.innerHTML = "";
  groups.forEach((dayEntries, day) => {
    const group = document.createElement("section");
    group.className = "day-group";
    group.innerHTML = `<div class="day-head"><h3>${escapeHTML(formatDateHeader(day))}</h3><span>${dayEntries.length}</span></div>`;

    dayEntries.forEach((entry) => {
      const score = scoreShot(entry);
      const inTarget = isShotInTarget(entry);
      let cleanFlag = "";
      if (entry.grinder_id && getLastCleaning(entry.grinder_id, "gross")) {
        cleanFlag = isShotAfterLastBigCleaning(entry)
          ? `<span class="fresh">nach Reinigung</span>`
          : `<span class="old">vor Reinigung</span>`;
      }

      const card = document.createElement("article");
      card.className = `item-card ${scoreClass(score)}`;
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="swipe-hint">Löschen</div>
        <div class="swipe-inner">
          <div class="item-main">
            <div class="item-icon">${getMethodIcon(entry.drink_type)}</div>
            <div class="item-content">
              <div class="item-title">
                <strong>${escapeHTML(entry.drink_name)}</strong>
                <span>${escapeHTML(formatEntryTime(entry.entry_time))}</span>
              </div>
              <div class="meta">
                <span class="strong">MG ${formatNumber(entry.mahlgrad, 1)}</span>
                ${toNumber(entry.extraction_time_s) !== null ? `<span class="${inTarget ? "fresh" : ""}">⏱️ ${formatNumber(entry.extraction_time_s, 1)} s</span>` : ""}
                ${entry.dose_g || entry.yield_g ? `<span>${formatNumber(entry.dose_g, 1)} → ${formatNumber(entry.yield_g, 1)} g</span>` : ""}
                ${entry.rating ? `<span>${"★".repeat(Number(entry.rating))}</span>` : ""}
              </div>
              <div class="meta">
                ${entry.grinder_id && showGrinderChip ? `<span>${escapeHTML(equipmentName(entry.grinder_id))}</span>` : ""}
                ${methodGroup(entry.drink_type) !== "espresso" ? `<span>${escapeHTML(entry.drink_type)}</span>` : ""}
                ${entry.pressure_bar !== null && entry.pressure_bar !== undefined ? `<span>${formatNumber(entry.pressure_bar, 1)} bar</span>` : ""}
                <span>Score ${score}</span>
                ${cleanFlag}
              </div>
              ${entry.note ? `<p class="item-note">${escapeHTML(entry.note)}</p>` : ""}
            </div>
          </div>
        </div>`;

      card.addEventListener("click", () => { if (card.dataset.swiped !== "true") startEdit(entry); });
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") startEdit(entry); });
      enableSwipeToDelete(card, () => deleteEntry(entry.id));
      group.appendChild(card);
    });

    el.entriesList.appendChild(group);
  });
}

function enableSwipeToDelete(card, onDelete) {
  const inner = card.querySelector(".swipe-inner");
  let startX = 0, startY = 0, dx = 0, active = false, axis = null;

  const reset = () => {
    active = false;
    card.classList.remove("dragging", "swiping-delete");
    inner.style.transform = "";
    setTimeout(() => { card.dataset.swiped = "false"; }, 60);
  };

  card.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    startX = e.clientX; startY = e.clientY; dx = 0; axis = null; active = true;
  });

  card.addEventListener("pointermove", (e) => {
    if (!active) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (axis === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    if (axis !== "x") return;
    dx = Math.max(Math.min(mx, 0), -130);
    card.dataset.swiped = "true";
    card.classList.add("dragging");
    card.classList.toggle("swiping-delete", dx < -50);
    inner.style.transform = `translateX(${dx}px)`;
  });

  card.addEventListener("pointerup", async () => {
    if (!active) return;
    const trigger = axis === "x" && dx < -100;
    reset();
    if (trigger) await onDelete();
  });

  card.addEventListener("pointercancel", reset);
}

async function deleteEntry(id) {
  if (!confirm("Diesen Shot wirklich löschen?")) return false;
  const { error } = await supabaseClient.from(TABLE_ENTRIES).delete().eq("id", id);
  if (error) { console.error(error); showToast("Löschen fehlgeschlagen", "error"); return false; }
  await loadEntries();
  renderAll();
  showToast("Shot gelöscht");
  return true;
}

async function deleteAllEntries() {
  if (!confirm("Wirklich ALLE Shots löschen? Das kann nicht rückgängig gemacht werden.")) return;
  if (prompt('Zur Sicherheit bitte "ALLE LÖSCHEN" eingeben:') !== "ALLE LÖSCHEN") { showToast("Abgebrochen"); return; }
  const { error } = await supabaseClient.from(TABLE_ENTRIES).delete().neq("id", 0);
  if (error) { console.error(error); showToast("Löschen fehlgeschlagen", "error"); return; }
  await loadEntries();
  renderAll();
  showToast("Alle Shots gelöscht");
}


/* ============================================================
   Stats
   ============================================================ */

function renderDashboard() {
  const s = state.settings;
  const todayEntries = state.entries.filter((e) => e.entry_date === todayISO());
  const todayCaff = sumCaffeine(todayEntries);
  const limit = Number(s.caffeine_limit_mg) || 400;

  el.todayCount.textContent = String(todayEntries.length);
  el.todayCaffeine.textContent = `${formatNumber(todayCaff)} mg`;
  el.limitText.textContent = `Limit ${formatNumber(limit)} mg`;

  const recent = sortedByTime(state.entries.filter((e) => toNumber(e.extraction_time_s) !== null)).slice(-STATS_WINDOW);
  const times = recent.map((e) => Number(e.extraction_time_s));
  const avgTime = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  el.avgTime.textContent = avgTime === null ? "–" : `${formatNumber(avgTime, 1)} s`;
  el.avgTimeSub.textContent = `Ziel ${formatNumber(s.target_time_min_s, 1)}–${formatNumber(s.target_time_max_s, 1)} s`;
  el.hitRate.textContent = recent.length ? `${formatNumber((recent.filter(isShotInTarget).length / recent.length) * 100)} %` : "–";

  el.overLimitHint.classList.toggle("hidden", todayCaff <= limit);
  if (todayCaff > limit) el.overLimitHint.textContent = `Tageslimit überschritten: ${formatNumber(todayCaff)} von ${formatNumber(limit)} mg Koffein.`;

  renderWeekCanvas();
  renderTrendCanvas();
  renderCoffeeRanking();
  renderTopShots();
  renderMethodDistribution();
  renderHeatmap();
}

function renderWeekCanvas() {
  const days = getLastNDays(7);
  const values = days.map((d) => sumCaffeine(state.entries.filter((e) => e.entry_date === d)));
  const average = values.reduce((a, b) => a + b, 0) / 7;
  const prevTotal = getLastNDays(7, 7).reduce((s, d) => s + sumCaffeine(state.entries.filter((e) => e.entry_date === d)), 0);
  const curTotal = values.reduce((a, b) => a + b, 0);

  el.weekCompare.textContent = prevTotal > 0
    ? `${curTotal >= prevTotal ? "+" : ""}${formatNumber(((curTotal - prevTotal) / prevTotal) * 100)} % zur Vorwoche`
    : "Keine Vorwoche";

  const labels = days.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", ""));
  drawBarChart(el.weekCanvas, labels, values, average);
}

function renderTrendCanvas() {
  const shots = sortedByTime(state.entries.filter((e) => toNumber(e.extraction_time_s) !== null)).slice(-30);
  const values = shots.map((e) => Number(e.extraction_time_s));

  if (values.length >= 4) {
    const mid = Math.floor(values.length / 2);
    const first = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const second = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
    el.trendBadge.textContent = second > first + 2 ? "wird langsamer" : second < first - 2 ? "wird schneller" : "stabil";
  } else {
    el.trendBadge.textContent = "zu wenig Daten";
  }
  drawTrendChart(el.trendCanvas, values);
}

function renderCoffeeRanking() {
  const top = getTopCoffeeNames().slice(0, 6);
  if (!top.length) { el.coffeeRanking.innerHTML = `<div class="empty">Noch keine Daten.</div>`; return; }
  const max = top[0].count;
  el.coffeeRanking.innerHTML = top.map(({ name, count }, i) => `
    <div class="rank-row">
      <span class="rank-number">${i + 1}</span>
      <div>
        <strong>${escapeHTML(name)}</strong>
        <div class="mini-track"><div class="mini-fill" style="width:${(count / max) * 100}%"></div></div>
      </div>
      <span>${count}×</span>
    </div>`).join("");
}

function renderTopShots() {
  const shots = state.entries.filter((e) => toNumber(e.mahlgrad) !== null)
    .map((e) => ({ e, score: scoreShot(e) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (!shots.length) { el.topShots.innerHTML = `<div class="empty">Noch keine Shots.</div>`; return; }
  el.topShots.innerHTML = shots.map(({ e, score }, i) => `
    <div class="rank-row">
      <span class="rank-number">${i + 1}</span>
      <div>
        <strong>${escapeHTML(e.drink_name)}</strong>
        <small>MG ${formatNumber(e.mahlgrad, 1)}, ${formatNumber(e.extraction_time_s, 1)} s, ${formatDateShort(e.entry_date)}</small>
      </div>
      <span>${score}</span>
    </div>`).join("");
}

function renderMethodDistribution() {
  const map = new Map();
  state.entries.forEach((e) => { const m = e.drink_type || "Espresso"; map.set(m, (map.get(m) || 0) + 1); });
  const items = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  drawDonut(el.methodCanvas, items);
  if (!items.length) { el.methodBars.innerHTML = ""; return; }
  const max = items[0][1];
  el.methodBars.innerHTML = items.slice(0, 6).map(([method, count], i) => `
    <div class="rank-row">
      <span class="rank-number" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}">${getMethodIcon(method)}</span>
      <div>
        <strong>${escapeHTML(method)}</strong>
        <div class="mini-track"><div class="mini-fill" style="width:${(count / max) * 100}%"></div></div>
      </div>
      <span>${count}×</span>
    </div>`).join("");
}

function renderHeatmap() {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6–22 Uhr
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const matrix = new Map();

  state.entries.forEach((e) => {
    const wd = (new Date(`${e.entry_date}T00:00:00`).getDay() + 6) % 7;
    const h = Number(String(e.entry_time || "00").slice(0, 2));
    if (h >= 6 && h <= 22) matrix.set(`${wd}-${h}`, (matrix.get(`${wd}-${h}`) || 0) + 1);
  });

  const max = Math.max(1, ...matrix.values());
  const top = Array.from(matrix.entries()).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const [wd, h] = top[0].split("-").map(Number);
    el.peakHour.textContent = `meist ${weekdays[wd]} ${pad(h)} Uhr`;
  } else {
    el.peakHour.textContent = "–";
  }

  let html = `<div class="heatmap-label"></div>` + hours.map((h) => `<div class="heatmap-label">${h % 3 === 0 ? h : ""}</div>`).join("");
  weekdays.forEach((label, wd) => {
    html += `<div class="heatmap-label">${label}</div>`;
    hours.forEach((h) => {
      const count = matrix.get(`${wd}-${h}`) || 0;
      html += count
        ? `<div class="heatmap-cell" style="opacity:${(0.25 + (count / max) * 0.75).toFixed(2)}" title="${label} ${h} Uhr: ${count} Shots"></div>`
        : `<div class="heatmap-cell empty-cell"></div>`;
    });
  });
  el.heatmap.innerHTML = html;
}


/* ============================================================
   Charts (Canvas)
   ============================================================ */

const DONUT_COLORS = ["#ffcf8a", "#d4a574", "#b8753a", "#8b4513", "#f0b36e", "#6a3514"];
const CHART_TEXT = "rgba(245,239,232,0.62)";
const CHART_GRID = "rgba(245,239,232,0.1)";

function setupCanvas(canvas) {
  if (!canvas) return null;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth || 320;
  const height = Number(canvas.dataset.h) || 200;
  const ratio = window.devicePixelRatio || 1;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = "11px system-ui, sans-serif";
  return { ctx, width, height };
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = CHART_TEXT;
  ctx.font = "13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Noch keine Daten", width / 2, height / 2);
}

function drawBarChart(canvas, labels, values, average) {
  const s = setupCanvas(canvas); if (!s) return;
  const { ctx, width, height } = s;
  if (values.every((v) => !v)) { drawEmpty(ctx, width, height); return; }

  const padX = 12, top = 22, bottom = 24;
  const chartW = width - padX * 2, chartH = height - top - bottom;
  const max = Math.max(average, ...values, 1) * 1.15;
  const gap = 8;
  const barW = (chartW - gap * (values.length - 1)) / values.length;

  values.forEach((v, i) => {
    const x = padX + i * (barW + gap);
    const h = (v / max) * chartH;
    const y = top + chartH - h;
    const grd = ctx.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, "#ffcf8a");
    grd.addColorStop(1, "#8b4513");
    ctx.fillStyle = v ? grd : CHART_GRID;
    roundRect(ctx, x, v ? y : top + chartH - 3, barW, v ? Math.max(h, 3) : 3, 6);
    ctx.fill();

    ctx.fillStyle = CHART_TEXT;
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + barW / 2, height - 7);
    if (v) ctx.fillText(formatNumber(v), x + barW / 2, y - 6);
  });

  const avgY = top + chartH - (average / max) * chartH;
  ctx.strokeStyle = "rgba(245,239,232,0.55)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(padX, avgY); ctx.lineTo(width - padX, avgY); ctx.stroke();
  ctx.setLineDash([]);
}

function drawTrendChart(canvas, values) {
  const s = setupCanvas(canvas); if (!s) return;
  const { ctx, width, height } = s;
  if (!values.length) { drawEmpty(ctx, width, height); return; }

  const minT = Number(state.settings.target_time_min_s);
  const maxT = Number(state.settings.target_time_max_s);
  const left = 30, right = 10, top = 12, bottom = 16;
  const chartW = width - left - right, chartH = height - top - bottom;
  const yMax = Math.ceil(Math.max(...values, maxT) * 1.15 / 5) * 5;
  const yMin = Math.max(0, Math.floor(Math.min(...values, minT) * 0.8 / 5) * 5);
  const yFor = (v) => top + chartH - ((v - yMin) / (yMax - yMin || 1)) * chartH;
  const xFor = (i) => left + (values.length === 1 ? chartW / 2 : (chartW * i) / (values.length - 1));

  // Zielbereich
  ctx.fillStyle = "rgba(125,220,156,0.1)";
  ctx.fillRect(left, yFor(maxT), chartW, yFor(minT) - yFor(maxT));

  // Achsenbeschriftung
  ctx.fillStyle = CHART_TEXT;
  ctx.textAlign = "right";
  [yMin, minT, maxT, yMax].forEach((v) => ctx.fillText(formatNumber(v), left - 6, yFor(v) + 4));

  // Linie
  ctx.strokeStyle = "#ffcf8a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(xFor(i), yFor(v)) : ctx.moveTo(xFor(i), yFor(v))));
  ctx.stroke();

  // Punkte: grün im Ziel, rot außerhalb
  values.forEach((v, i) => {
    ctx.fillStyle = v >= minT && v <= maxT ? "#7ddc9c" : "#ff7066";
    ctx.beginPath(); ctx.arc(xFor(i), yFor(v), 3.5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawDonut(canvas, items) {
  const s = setupCanvas(canvas); if (!s) return;
  const { ctx, width, height } = s;
  if (!items.length) { drawEmpty(ctx, width, height); return; }

  const total = items.reduce((sum, i) => sum + i[1], 0);
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(width, height) * 0.36;
  let start = -Math.PI / 2;

  ctx.lineWidth = 22;
  items.forEach((item, i) => {
    const angle = (item[1] / total) * Math.PI * 2;
    ctx.strokeStyle = DONUT_COLORS[i % DONUT_COLORS.length];
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start + 0.02, start + angle - 0.02);
    ctx.stroke();
    start += angle;
  });

  ctx.fillStyle = "#f5efe8";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(total), cx, cy + 4);
  ctx.fillStyle = CHART_TEXT;
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("Shots", cx, cy + 20);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}


/* ============================================================
   Reinigung
   ============================================================ */

function cleaningStatusClass(days, type) {
  const t = CLEANING_THRESHOLDS[type];
  if (!Number.isFinite(days) || days > t.warn) return "is-late";
  if (days > t.ok) return "is-due";
  return "is-ok";
}

function renderCleaningEquipmentSelect() {
  const cur = el.cleaningEquipment.value;
  const items = state.equipment.filter((i) => isMachine(i) || isGrinder(i));
  el.cleaningEquipment.innerHTML = `<option value="">Bitte wählen …</option>` +
    items.map((i) => `<option value="${i.id}">${getEquipmentIcon(i.category)} ${escapeHTML(equipmentLabel(i))}</option>`).join("");
  el.cleaningEquipment.value = cur;
}

function renderCleaning() {
  const items = state.equipment.filter((i) => i.is_active && (isMachine(i) || isGrinder(i)));
  el.cleaningCount.textContent = String(state.cleaningLogs.length);
  el.cleaningHistorySummary.textContent = `Verlauf (${state.cleaningLogs.length})`;

  el.cleaningStatus.innerHTML = items.length
    ? items.map((item) => {
        const buttons = ["klein", "gross"].map((type) => {
          const last = getLastCleaning(item.id, type);
          const days = last ? daysSince(last.cleaned_at) : Infinity;
          return `
            <button type="button" class="clean-btn ${cleaningStatusClass(days, type)}" data-clean="${type}" data-id="${item.id}">
              <b>${type === "klein" ? "Klein" : "Groß"}</b>
              <small>${daysText(days)}</small>
            </button>`;
        }).join("");
        return `
          <div class="clean-row">
            <strong>${getEquipmentIcon(item.category)} ${escapeHTML(equipmentLabel(item))}</strong>
            <div class="clean-buttons">${buttons}</div>
          </div>`;
      }).join("")
    : `<div class="empty">Lege unten eine Maschine oder Mühle an, um Reinigungen zu protokollieren.</div>`;

  el.cleaningList.innerHTML = state.cleaningLogs.length
    ? state.cleaningLogs.slice(0, 40).map((log) => {
        const item = getEquipmentById(log.equipment_id);
        return `
          <div class="clean-item">
            <div>
              <strong>${log.cleaning_type === "gross" ? "Groß" : "Klein"}: ${escapeHTML(item ? equipmentLabel(item) : "Gelöschtes Gerät")}</strong>
              <div class="sub">${formatDateShort(log.cleaned_at)}${log.notes ? `, ${escapeHTML(log.notes)}` : ""}</div>
            </div>
            <button class="del" type="button" data-del-clean="${log.id}" aria-label="Eintrag löschen">×</button>
          </div>`;
      }).join("")
    : `<div class="empty">Noch keine Reinigungen eingetragen.</div>`;

  el.cleaningList.querySelectorAll("[data-del-clean]").forEach((btn) =>
    btn.addEventListener("click", () => deleteCleaning(btn.dataset.delClean)));
}

async function insertCleaning(payload) {
  const { error } = await supabaseClient.from(TABLE_CLEANING).insert(payload);
  if (error) { console.error("Cleaning:", error); showToast(`Speichern fehlgeschlagen: ${error.message}`, "error"); return false; }
  await loadCleaningLogs();
  renderAll();
  const item = getEquipmentById(payload.equipment_id);
  if (item && isGrinder(item) && payload.cleaning_type === "gross") {
    showToast("Große Reinigung gespeichert – Nullpunkt der Mühle prüfen");
  } else {
    showToast("Reinigung gespeichert 🧽");
  }
  return true;
}

async function quickClean(equipmentId, type) {
  const item = getEquipmentById(equipmentId);
  if (!item) return;
  const label = type === "gross" ? "Große" : "Kleine";
  if (!confirm(`${label} Reinigung für ${equipmentLabel(item)} heute eintragen?`)) return;
  await insertCleaning({ equipment_id: Number(equipmentId), cleaning_type: type, cleaned_at: todayISO(), notes: null });
}

async function saveCleaning(event) {
  event.preventDefault();
  if (!el.cleaningEquipment.value) { setMsg(el.cleaningMessage, "Bitte ein Gerät wählen.", "error"); return; }
  setButtonLoading(el.saveCleaningBtn, true, "Speichere …", "Reinigung speichern");
  const ok = await insertCleaning({
    equipment_id:  Number(el.cleaningEquipment.value),
    cleaning_type: el.cleaningType.value,
    cleaned_at:    el.cleaningDate.value || todayISO(),
    notes:         el.cleaningNotes.value.trim() || null,
  });
  setButtonLoading(el.saveCleaningBtn, false, "Speichere …", "Reinigung speichern");
  if (ok) { resetCleaningForm(); el.cleaningFormDetails.open = false; }
}

function resetCleaningForm() {
  el.cleaningEquipment.value = "";
  el.cleaningType.value = "klein";
  el.cleaningDate.value = todayISO();
  el.cleaningNotes.value = "";
  setMsg(el.cleaningMessage, "");
}

async function deleteCleaning(id) {
  if (!confirm("Diesen Reinigungseintrag löschen?")) return;
  const { error } = await supabaseClient.from(TABLE_CLEANING).delete().eq("id", id);
  if (error) { console.error(error); showToast("Löschen fehlgeschlagen", "error"); return; }
  await loadCleaningLogs();
  renderAll();
  showToast("Eintrag gelöscht");
}


/* ============================================================
   Geräte
   ============================================================ */

function readEquipmentForm() {
  return {
    category:      el.equipmentCategory.value || "Sonstiges",
    name:          el.equipmentName.value.trim(),
    brand:         el.equipmentBrand.value.trim() || null,
    model:         el.equipmentModel.value.trim() || null,
    purchase_date: el.equipmentPurchaseDate.value || null,
    price_eur:     toNumber(el.equipmentPrice.value),
    facts:         el.equipmentFacts.value.trim() || null,
    notes:         el.equipmentNotes.value.trim() || null,
    is_active:     Boolean(el.equipmentActive.checked),
    updated_at:    new Date().toISOString(),
  };
}

async function saveEquipment(event) {
  event.preventDefault();
  const payload = readEquipmentForm();
  if (!payload.name) { setMsg(el.equipmentMessage, "Bitte einen Namen eintragen.", "error"); el.equipmentName.focus(); return; }

  const isEditing = Boolean(state.editingEquipmentId);
  const defaultText = isEditing ? "Änderung speichern" : "Gerät speichern";
  setButtonLoading(el.saveEquipmentBtn, true, "Speichere …", defaultText);
  const response = isEditing
    ? await supabaseClient.from(TABLE_EQUIPMENT).update(payload).eq("id", state.editingEquipmentId)
    : await supabaseClient.from(TABLE_EQUIPMENT).insert(payload);
  setButtonLoading(el.saveEquipmentBtn, false, "Speichere …", defaultText);

  if (response.error) {
    console.error("Equipment:", response.error);
    setMsg(el.equipmentMessage, `Speichern fehlgeschlagen: ${response.error.message}`, "error");
    return;
  }

  resetEquipmentForm();
  el.equipmentFormDetails.open = false;
  await loadEquipment();
  renderAll();
  showToast(isEditing ? "Gerät aktualisiert" : "Gerät gespeichert");
}

function renderEquipment() {
  el.equipmentCount.textContent = String(state.equipment.length);
  if (!state.equipment.length) {
    el.equipmentList.innerHTML = `<div class="empty">Noch keine Geräte. Füge unten deine Maschine und Mühle hinzu.</div>`;
    el.equipmentFormDetails.open = true;
    return;
  }

  el.equipmentList.innerHTML = state.equipment.map((item) => `
    <article class="item-card ${item.is_active ? "" : "inactive"}" data-eq="${item.id}" tabindex="0">
      <div class="item-main">
        <div class="item-icon">${getEquipmentIcon(item.category)}</div>
        <div class="item-content">
          <div class="item-title">
            <strong>${escapeHTML(item.name)}</strong>
            <span>${escapeHTML(item.category)}${item.is_active ? "" : ", inaktiv"}</span>
          </div>
          <div class="meta">
            ${item.brand ? `<span>${escapeHTML(item.brand)}</span>` : ""}
            ${item.model ? `<span>${escapeHTML(item.model)}</span>` : ""}
            ${item.purchase_date ? `<span>seit ${formatDateShort(item.purchase_date)}</span>` : ""}
            ${item.price_eur !== null && item.price_eur !== undefined ? `<span>${formatFixed(item.price_eur, 2)} €</span>` : ""}
          </div>
          ${item.facts ? `<p class="item-note">${escapeHTML(item.facts)}</p>` : ""}
          ${item.notes ? `<p class="item-note">${escapeHTML(item.notes)}</p>` : ""}
        </div>
      </div>
    </article>`).join("");

  el.equipmentList.querySelectorAll("[data-eq]").forEach((card) => {
    const open = () => startEditEquipment(getEquipmentById(card.dataset.eq));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  });
}

function startEditEquipment(item) {
  if (!item) return;
  state.editingEquipmentId = item.id;
  el.equipmentCategory.value     = item.category || "Sonstiges";
  el.equipmentName.value         = item.name || "";
  el.equipmentBrand.value        = item.brand || "";
  el.equipmentModel.value        = item.model || "";
  el.equipmentPurchaseDate.value = item.purchase_date || "";
  el.equipmentPrice.value        = item.price_eur ?? "";
  el.equipmentFacts.value        = item.facts || "";
  el.equipmentNotes.value        = item.notes || "";
  el.equipmentActive.checked     = Boolean(item.is_active);
  el.saveEquipmentBtn.textContent = "Änderung speichern";
  el.equipmentFormSummary.textContent = `${equipmentLabel(item)} bearbeiten`;
  el.cancelEquipmentEditBtn.classList.remove("hidden");
  el.deleteEquipmentBtn.classList.remove("hidden");
  setMsg(el.equipmentMessage, "");
  el.equipmentFormDetails.open = true;
  el.equipmentFormDetails.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEquipmentForm() {
  state.editingEquipmentId = null;
  el.equipmentForm.reset();
  el.equipmentCategory.value = "Maschine";
  el.equipmentActive.checked = true;
  el.saveEquipmentBtn.textContent = "Gerät speichern";
  el.equipmentFormSummary.textContent = "Gerät hinzufügen";
  el.cancelEquipmentEditBtn.classList.add("hidden");
  el.deleteEquipmentBtn.classList.add("hidden");
  setMsg(el.equipmentMessage, "");
}

async function deleteEditedEquipment() {
  const item = getEquipmentById(state.editingEquipmentId);
  if (!item) return;
  if (!confirm(`${equipmentLabel(item)} wirklich löschen? Tipp: „In Benutzung“ abwählen behält den Verlauf.`)) return;
  const { error } = await supabaseClient.from(TABLE_EQUIPMENT).delete().eq("id", item.id);
  if (error) { console.error(error); showToast(`Löschen fehlgeschlagen: ${error.message}`, "error"); return; }
  resetEquipmentForm();
  el.equipmentFormDetails.open = false;
  await Promise.all([loadEquipment(), loadCleaningLogs()]);
  renderAll();
  showToast("Gerät gelöscht");
}


/* ============================================================
   Einstellungen
   ============================================================ */

async function saveSettings() {
  const payload = {
    id: 1,
    caffeine_limit_mg:       toNumber(el.limitInput.value)        ?? 400,
    target_time_min_s:       toNumber(el.targetTimeMin.value)     ?? 25,
    target_time_max_s:       toNumber(el.targetTimeMax.value)     ?? 30,
    target_pressure_min_bar: toNumber(el.targetPressureMin.value) ?? 8,
    target_pressure_max_bar: toNumber(el.targetPressureMax.value) ?? 10,
    updated_at: new Date().toISOString(),
  };

  if (payload.target_time_min_s >= payload.target_time_max_s) {
    setMsg(el.settingsMessage, "Die minimale Zielzeit muss kleiner als die maximale sein.", "error");
    return;
  }
  if (payload.target_pressure_min_bar >= payload.target_pressure_max_bar) {
    setMsg(el.settingsMessage, "Der minimale Druck muss kleiner als der maximale sein.", "error");
    return;
  }

  setButtonLoading(el.saveSettingsBtn, true, "Speichere …", "Zielbereiche speichern");
  const { error } = await supabaseClient.from(TABLE_SETTINGS).upsert(payload, { onConflict: "id" });
  setButtonLoading(el.saveSettingsBtn, false, "Speichere …", "Zielbereiche speichern");

  if (error) {
    console.error("Settings:", error);
    setMsg(el.settingsMessage, `Speichern fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  const { id, updated_at, ...settings } = payload;
  state.settings = settings;
  setMsg(el.settingsMessage, "");
  renderAll();
  showToast("Zielbereiche gespeichert");
}


init();
