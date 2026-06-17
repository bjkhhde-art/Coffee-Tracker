/* ============================================================
   Coffee Tracker – automatische Mahlgrad-Empfehlungen
   GitHub Pages + Supabase + Shelly Plug S Gen 3
   ============================================================ */

const SUPABASE_URL     = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_ANON_KEY= "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
const TABLE_ENTRIES    = "coffee_entries";
const TABLE_EQUIPMENT  = "coffee_equipment";
const TABLE_SETTINGS   = "coffee_user_settings";
const TABLE_CLEANING = "coffee_cleaning_logs";
const TABLE_SHELLY_LOGS = "coffee_shelly_logs";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const state = {
  isLoading: true,
  entries: [],
  equipment: [],
  cleaningLogs: [],
  recommendations: [],
  editingId: null,
  editingEquipmentId: null,
  filters: { date: "", coffee: "" },
  settings: {
    caffeine_limit_mg: 400,
    target_time_min_s: 25,
    target_time_max_s: 30,
    target_pressure_min_bar: 8,
    target_pressure_max_bar: 10,
  },
  shelly: {
    ip: "",
    price: 0.35,
  },
};

let shellyPollTimer = null;
const $ = (id) => document.getElementById(id);

const el = {
  tabs:   $("tabs"),
  fabAdd: $("fabAdd"),

  quickCoffeeButtons:     $("quickCoffeeButtons"),
  recommendationBox:      $("recommendationBox"),
  recommendationTitle:    $("recommendationTitle"),
  recommendationText:     $("recommendationText"),
  applyRecommendationBtn: $("applyRecommendationBtn"),

  entryForm:       $("entryForm"),
  coffeeName:      $("coffeeName"),
  coffeeSuggestions: $("coffeeSuggestions"),
  brewMethod:      $("brewMethod"),
  machineSelect:   $("machineSelect"),
  grinderSelect:   $("grinderSelect"),
  entryDate:       $("entryDate"),
  entryTime:       $("entryTime"),
  doseG:           $("doseG"),
  yieldG:          $("yieldG"),
  mahlgrad:        $("mahlgrad"),
  extractionTime:  $("extractionTime"),
  pressureBar:     $("pressureBar"),
  temperatureC:    $("temperatureC"),
  caffeineMg:      $("caffeineMg"),
  rating:          $("rating"),
  note:            $("note"),

  coffeeError:      $("coffeeError"),
  mahlgradError:    $("mahlgradError"),
  formError:        $("formError"),
  formMessage:      $("formMessage"),
  saveEntryBtn:     $("saveEntryBtn"),
  duplicateLastBtn: $("duplicateLastBtn"),
  cancelEditBtn:    $("cancelEditBtn"),
  resetFormBtn:     $("resetFormBtn"),
  editBadge:        $("editBadge"),

  recommendationsList:  $("recommendationsList"),
  recommendationsCount: $("recommendationsCount"),

  filterDate:      $("filterDate"),
  filterCoffee:    $("filterCoffee"),
  clearFiltersBtn: $("clearFiltersBtn"),
  deleteAllBtn:    $("deleteAllBtn"),
  entriesList:     $("entriesList"),
  entriesCount:    $("entriesCount"),

  todayCount:    $("todayCount"),
  todayCaffeine: $("todayCaffeine"),
  limitText:     $("limitText"),
  overLimitHint: $("overLimitHint"),
  avgTime:       $("avgTime"),
  hitRate:       $("hitRate"),
  weekCanvas:    $("weekCanvas"),
  weekCompare:   $("weekCompare"),
  trendCanvas:   $("trendCanvas"),
  trendBadge:    $("trendBadge"),
  coffeeRanking: $("coffeeRanking"),
  topShots:      $("topShots"),
  methodCanvas:  $("methodCanvas"),
  methodBars:    $("methodBars"),
  heatmap:       $("heatmap"),
  peakHour:      $("peakHour"),

  shellyContent:     $("shellyContent"),
  shellyStatusBadge: $("shellyStatusBadge"),
  shellySubline:     $("shellySubline"),
  shellyUpdateTime:  $("shellyUpdateTime"),

  shellyIp:              $("shellyIp"),
  shellyPrice:           $("shellyPrice"),
  saveShellyBtn:         $("saveShellyBtn"),
  testShellyBtn:         $("testShellyBtn"),
  shellySettingsMessage: $("shellySettingsMessage"),
  shellyHintUrl:         $("shellyHintUrl"),

  equipmentForm:          $("equipmentForm"),
  equipmentCategory:      $("equipmentCategory"),
  equipmentName:          $("equipmentName"),
  equipmentBrand:         $("equipmentBrand"),
  equipmentModel:         $("equipmentModel"),
  equipmentPurchaseDate:  $("equipmentPurchaseDate"),
  equipmentPrice:         $("equipmentPrice"),
  equipmentFacts:         $("equipmentFacts"),
  equipmentNotes:         $("equipmentNotes"),
  equipmentActive:        $("equipmentActive"),
  equipmentMessage:       $("equipmentMessage"),
  equipmentCount:         $("equipmentCount"),
  equipmentList:          $("equipmentList"),
  saveEquipmentBtn:       $("saveEquipmentBtn"),
  cancelEquipmentEditBtn: $("cancelEquipmentEditBtn"),
  resetEquipmentBtn:      $("resetEquipmentBtn"),

  limitInput:        $("limitInput"),
  targetTimeMin:     $("targetTimeMin"),
  targetTimeMax:     $("targetTimeMax"),
  targetPressureMin: $("targetPressureMin"),
  targetPressureMax: $("targetPressureMax"),
  saveSettingsBtn:   $("saveSettingsBtn"),
  settingsMessage:   $("settingsMessage"),

  toast: $("toast"),

  cleaningForm:       $("cleaningForm"),
  cleaningEquipment:  $("cleaningEquipment"),
  cleaningType:       $("cleaningType"),
  cleaningDate:       $("cleaningDate"),
  cleaningNotes:      $("cleaningNotes"),
  cleaningMessage:    $("cleaningMessage"),
  cleaningCount:      $("cleaningCount"),
  cleaningStatus:     $("cleaningStatus"),
  cleaningList:       $("cleaningList"),
  saveCleaningBtn:    $("saveCleaningBtn"),
  resetCleaningBtn:   $("resetCleaningBtn"),
};


/* ============================================================
   Helper
   ============================================================ */

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowTime()  { return new Date().toTimeString().slice(0, 5); }

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
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

function formatEntryTime(time) {
  if (!time) return "–";
  return String(time).slice(0, 5);
}

function formatDateShort(date) {
  if (!date) return "–";
  return new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

function formatDateHeader(date) {
  const d         = new Date(`${date}T00:00:00`);
  const today     = todayISO();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yISO = yesterday.toISOString().slice(0, 10);
  if (date === today) return "Heute";
  if (date === yISO)  return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function setMsg(elem, message, type) {
  if (!elem) return;
  elem.textContent   = message || "";
  elem.style.color   = type === "error" ? "var(--danger)" : "var(--accent-light)";
}

function setFormMessage(m, t)         { setMsg(el.formMessage,         m, t); }
function setSettingsMessage(m, t)     { setMsg(el.settingsMessage,     m, t); }
function setEquipmentMessage(m, t)    { setMsg(el.equipmentMessage,    m, t); }
function setShellySettingsMessage(m, t) { setMsg(el.shellySettingsMessage, m, t); }

function setButtonLoading(btn, loading, loadText, defaultText) {
  btn.disabled    = loading;
  btn.textContent = loading ? loadText : defaultText;
}

function getLastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function getPreviousNDays(n, offset) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n + offset - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function getMethodIcon(method) {
  const t = normalize(method);
  if (t.includes("espresso")) return "☕";
  if (t.includes("v60") || t.includes("filter")) return "🔻";
  if (t.includes("french"))   return "🫙";
  if (t.includes("cold"))     return "🧊";
  if (t.includes("latte") || t.includes("cappuccino")) return "🥛";
  return "☕";
}

function getEquipmentIcon(cat) {
  const t = normalize(cat);
  if (t.includes("maschine")) return "☕";
  if (t.includes("muhle"))    return "⚙️";
  if (t.includes("sieb"))     return "🧺";
  if (t.includes("waage"))    return "⚖️";
  if (t.includes("tamper"))   return "⬇️";
  if (t.includes("zubehor"))  return "🧰";
  return "🔧";
}

function getEquipmentById(id) {
  if (!id) return null;
  return state.equipment.find(i => String(i.id) === String(id)) || null;
}

function equipmentName(id) {
  const item = getEquipmentById(id);
  if (!item) return "Keine Mühle";
  return [item.brand, item.model || item.name].filter(Boolean).join(" ");
}

function sumCaffeine(entries) {
  return entries.reduce((s, e) => s + (Number(e.caffeine_mg) || 0), 0);
}


/* ============================================================
   Shelly – localStorage settings
   ============================================================ */

function loadShellySettings() {
  try {
    const raw = localStorage.getItem("ct_shelly");
    if (raw) {
      const s = JSON.parse(raw);
      state.shelly.price = Number(s.price) || 0.35;
    }
  } catch { /* ignore */ }
  el.shellyPrice.value = state.shelly.price;
}

function saveShellySettings() {
  const price = toNumber(el.shellyPrice.value) ?? 0.35;
  state.shelly.price = price;
  try { localStorage.setItem("ct_shelly", JSON.stringify({ price })); } catch { /* ignore */ }
  setShellySettingsMessage("Strompreis gespeichert.");
  showToast("Strompreis gespeichert ⚡");
  if ($("view-dashboard").classList.contains("active")) renderShellyPanel();
}

function updateShellyHint() {
  if (el.shellyHintUrl) {
    el.shellyHintUrl.textContent = `https://${state.shelly.ip || "<IP>"}/`;
  }
}

/* Daily energy baseline ----------------------------------------
   aenergy.total is cumulative Wh since last factory reset.
   We store today's starting value in localStorage to derive
   "Energie heute" = (current – baseline) / 1000 kWh.
-------------------------------------------------------------- */

function getShellyTodayKwh(currentWh) {
  const today      = todayISO();
  const storedDate = localStorage.getItem("ct_shelly_bdate") || "";
  const storedWh   = Number(localStorage.getItem("ct_shelly_bwh")) || 0;

  if (storedDate !== today || currentWh < storedWh) {
    localStorage.setItem("ct_shelly_bdate", today);
    localStorage.setItem("ct_shelly_bwh",   String(currentWh));
    return 0;
  }
  return (currentWh - storedWh) / 1000;
}

/* Shelly fetch ------------------------------------------------
   Shelly Plug S Gen 3 speaks RPC over HTTPS.
   The device uses a self-signed cert → user must accept once.
   CORS: Shelly Gen 2/3 returns Access-Control-Allow-Origin: *
-------------------------------------------------------------- */

async function fetchShellyStatus() {
  try {
    // Letzten Eintrag aus Supabase holen
    const { data, error } = await supabaseClient
      .from(TABLE_SHELLY_LOGS)
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    // Auf das gleiche Format mappen, das renderShellyPanel erwartet
    return {
      output: data.output,
      apower: Number(data.apower_w) || 0,
      aenergy: { total: Number(data.aenergy_wh) || 0 },
      temperature: data.temperature_c != null ? { tC: Number(data.temperature_c) } : null,
      _recorded_at: data.recorded_at,   // für Anzeige „zuletzt aktualisiert"
    };
  } catch (err) {
    console.warn("Shelly-Logs:", err);
    return null;
  }
}

/* Render Shelly panel ---------------------------------------- */

async function renderShellyPanel() {
  if (!el.shellyContent) return;
  const { price } = state.shelly;

  /* keep existing content while refreshing (no flicker) */
  if (!el.shellyContent.querySelector(".shelly-stats")) {
    el.shellyContent.innerHTML = `<div class="empty">Lade …</div>`;
  }

  const data = await fetchShellyStatus();

  if (!data) {
    el.shellyContent.innerHTML = `
      <div class="shelly-error">
        ⚠️ Noch keine Shelly-Daten in der Datenbank.<br><br>
        Prüfe ob das Skript auf der Shelly läuft (Shelly-App → Skripte → Status sollte „läuft" sein).
      </div>`;
    el.shellyStatusBadge.textContent = "Keine Daten";
    el.shellyUpdateTime.textContent  = "";
    return;
  }

  const isOn      = Boolean(data.output);
  const powerW    = Number(data.apower  ?? 0);
  const totalWh   = Number(data.aenergy?.total ?? 0);
  const tempC     = data.temperature?.tC ?? null;
  const totalKwh  = totalWh / 1000;
  const todayKwh  = getShellyTodayKwh(totalWh);
  const todayCost = todayKwh  * price;
  const totalCost = totalKwh  * price;

  el.shellyStatusBadge.textContent = isOn ? "🟢 An" : "⚫ Aus";
  el.shellyStatusBadge.style.color = isOn ? "var(--success)" : "var(--muted)";

  el.shellyContent.innerHTML = `
    <div class="shelly-stats">
      <div class="shelly-stat ${isOn ? "is-on" : "is-off"}">
        <span class="shelly-stat-label">Status</span>
        <span class="shelly-stat-value">${isOn ? "An" : "Aus"}</span>
      </div>
      <div class="shelly-stat">
        <span class="shelly-stat-label">Aktuell</span>
        <span class="shelly-stat-value">${formatNumber(powerW, 0)} W</span>
      </div>
      <div class="shelly-stat">
        <span class="shelly-stat-label">Heute</span>
        <span class="shelly-stat-value">${todayKwh.toFixed(3)} kWh</span>
        <span class="shelly-stat-sub">${todayCost.toFixed(3)} €</span>
      </div>
      <div class="shelly-stat">
        <span class="shelly-stat-label">Gesamt</span>
        <span class="shelly-stat-value">${totalKwh.toFixed(2)} kWh</span>
        <span class="shelly-stat-sub">${totalCost.toFixed(2)} €</span>
      </div>
      ${tempC !== null ? `
      <div class="shelly-stat ${tempC > 60 ? "is-warm" : ""}">
        <span class="shelly-stat-label">Steckdose</span>
        <span class="shelly-stat-value">${tempC.toFixed(1)} °C</span>
      </div>` : ""}
    </div>`;

  if (data._recorded_at) {
    const recorded = new Date(data._recorded_at);
    const ageSec   = Math.floor((Date.now() - recorded.getTime()) / 1000);
    const ageText  = ageSec < 60
      ? `vor ${ageSec}s`
      : ageSec < 3600
        ? `vor ${Math.floor(ageSec/60)} min`
        : `vor ${Math.floor(ageSec/3600)} h`;
    el.shellyUpdateTime.textContent = `Letzter Push: ${recorded.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} (${ageText})`;
  }
}

function startShellyPolling() {
  stopShellyPolling();
  if (state.shelly.ip) shellyPollTimer = setInterval(renderShellyPanel, 30000);
}

function stopShellyPolling() {
  if (shellyPollTimer) { clearInterval(shellyPollTimer); shellyPollTimer = null; }
}

async function testShellyConnection() {
  setButtonLoading(el.testShellyBtn, true, "Teste …", "Verbindung testen");
  const { data, error } = await supabaseClient
    .from(TABLE_SHELLY_LOGS)
    .select("recorded_at, apower_w, output")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  setButtonLoading(el.testShellyBtn, false, "Teste …", "Verbindung testen");

  if (error || !data) {
    setShellySettingsMessage("❌ Keine Daten in der DB. Läuft das Shelly-Skript?", "error");
    return;
  }
  const ageSec = Math.floor((Date.now() - new Date(data.recorded_at).getTime()) / 1000);
  setShellySettingsMessage(`✅ Letzter Push vor ${ageSec}s · ${data.output ? "An" : "Aus"} · ${Number(data.apower_w).toFixed(0)} W`);
}


/* ============================================================
   Init
   ============================================================ */

async function init() {
  loadShellySettings();
  initTabs();
  initFormDefaults();
  initEvents();
  renderSkeletons();

  if (!supabaseClient) { showToast("Supabase konnte nicht geladen werden."); return; }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("DEIN_") || SUPABASE_ANON_KEY.includes("...")) {
    setFormMessage("Bitte zuerst deinen Supabase Publishable Key in app.js eintragen.", "error");
    showToast("Supabase Key fehlt."); return;
  }

  await reloadAll();
  setTimeout(() => el.coffeeName?.focus(), 350);
}

function initFormDefaults() {
  el.entryDate.value  = todayISO();
  el.entryTime.value  = nowTime();
  el.doseG.value      = "18";
  el.yieldG.value     = "36";
  el.caffeineMg.value = "80";
  el.cleaningDate.value = todayISO();
}

function initTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => openView(tab.dataset.view));
  });
}

function openView(viewName) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === viewName));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = $(`view-${viewName}`);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (viewName === "dashboard") {
    renderDashboard();
    startShellyPolling();
  } else {
    stopShellyPolling();
    if (viewName === "recommendations") renderRecommendations();
    if (viewName === "history")         renderEntries();
    if (viewName === "equipment")       renderEquipment();
  }
}

function initEvents() {
  el.cleaningForm.addEventListener("submit", saveCleaning);
  el.resetCleaningBtn.addEventListener("click", resetCleaningForm);
   
  el.entryForm.addEventListener("submit", saveEntry);
  el.resetFormBtn.addEventListener("click", resetForm);
  el.cancelEditBtn.addEventListener("click", cancelEdit);
  el.duplicateLastBtn.addEventListener("click", duplicateLastShot);

  el.coffeeName.addEventListener("input", updateCurrentRecommendation);
  el.grinderSelect.addEventListener("change", updateCurrentRecommendation);
  el.brewMethod.addEventListener("change", () => { el.caffeineMg.value = methodDefaultCaffeine(el.brewMethod.value); });
  el.applyRecommendationBtn.addEventListener("click", applyCurrentRecommendation);

  el.filterDate.addEventListener("change",   () => { state.filters.date   = el.filterDate.value;   renderEntries(); });
  el.filterCoffee.addEventListener("change", () => { state.filters.coffee = el.filterCoffee.value; renderEntries(); });
  el.clearFiltersBtn.addEventListener("click", () => {
    state.filters.date = state.filters.coffee = "";
    el.filterDate.value = el.filterCoffee.value = "";
    renderEntries();
  });
  el.deleteAllBtn.addEventListener("click", deleteAllEntries);

  el.equipmentForm.addEventListener("submit", saveEquipment);
  el.resetEquipmentBtn.addEventListener("click", resetEquipmentForm);
  el.cancelEquipmentEditBtn.addEventListener("click", resetEquipmentForm);

  el.saveSettingsBtn.addEventListener("click", saveSettings);
  el.saveShellyBtn.addEventListener("click",   saveShellySettings);

  el.fabAdd.addEventListener("click", () => { cancelEdit(); openView("add"); setTimeout(() => el.coffeeName?.focus(), 80); });
  window.addEventListener("resize", () => { if ($("view-dashboard").classList.contains("active")) renderDashboard(); });
}


/* ============================================================
   Load
   ============================================================ */

async function reloadAll() {
  state.isLoading = true;
  renderSkeletons();
  await Promise.all([loadSettings(), loadEntries(), loadEquipment(), loadCleaningLogs()]);
  state.recommendations = buildRecommendations(state.entries);
  state.isLoading = false;
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
  const { data, error } = await supabaseClient.from(TABLE_ENTRIES).select("*")
    .order("entry_date", { ascending: false }).order("entry_time", { ascending: false });
  if (error) { console.error("Entries:", error); showToast("Shots konnten nicht geladen werden."); state.entries = []; return; }
  state.entries = data || [];
}

async function loadEquipment() {
  const { data, error } = await supabaseClient.from(TABLE_EQUIPMENT).select("*")
    .order("category", { ascending: true }).order("name", { ascending: true });
  if (error) { console.error("Equipment:", error); state.equipment = []; return; }
  state.equipment = data || [];
}


/* ============================================================
   Render
   ============================================================ */

function renderAll() {
  state.recommendations = buildRecommendations(state.entries);
  renderEquipmentSelects();
  renderCoffeeSuggestions();
  renderQuickCoffeeButtons();
  renderRecommendations();
  renderEntries();
  renderDashboard();
  renderEquipment();
  renderCleaning();
  updateCurrentRecommendation();
}

function renderSkeletons() {
  el.entriesList.innerHTML        = `<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
  el.recommendationsList.innerHTML= `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
  el.equipmentList.innerHTML      = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
}

function renderEquipmentSelects() {
  const curM = el.machineSelect.value;
  const curG = el.grinderSelect.value;
  const machines = state.equipment.filter(i => i.is_active && normalize(i.category).includes("maschine"));
  const grinders = state.equipment.filter(i => i.is_active && normalize(i.category).includes("muhle"));

  el.machineSelect.innerHTML = `<option value="">Keine Maschine gewählt</option>`;
  el.grinderSelect.innerHTML = `<option value="">Keine Mühle gewählt</option>`;
  machines.forEach(i => { const o = document.createElement("option"); o.value = i.id; o.textContent = equipmentLabel(i); el.machineSelect.appendChild(o); });
  grinders.forEach(i => { const o = document.createElement("option"); o.value = i.id; o.textContent = equipmentLabel(i); el.grinderSelect.appendChild(o); });

  if (curM) el.machineSelect.value = curM;
  if (curG) el.grinderSelect.value = curG;
  if (!el.machineSelect.value && machines.length === 1) el.machineSelect.value = machines[0].id;
  if (!el.grinderSelect.value && grinders.length === 1) el.grinderSelect.value = grinders[0].id;
}

function equipmentLabel(item) { return [item.brand, item.model || item.name].filter(Boolean).join(" "); }

function renderCoffeeSuggestions() {
  const coffees = Array.from(new Set(state.entries.map(e => e.drink_name).filter(Boolean))).sort((a,b) => a.localeCompare(b, "de"));
  el.coffeeSuggestions.innerHTML = "";
  el.filterCoffee.innerHTML = `<option value="">Alle Kaffees</option>`;
  coffees.forEach(c => {
    const d = document.createElement("option"); d.value = c; el.coffeeSuggestions.appendChild(d);
    const f = document.createElement("option"); f.value = c; f.textContent = c; el.filterCoffee.appendChild(f);
  });
  el.filterCoffee.value = state.filters.coffee;
}

function renderQuickCoffeeButtons() {
  el.quickCoffeeButtons.innerHTML = "";
  const top = getTopCoffeeNames().slice(0, 6);
  if (!top.length) { el.quickCoffeeButtons.innerHTML = `<div class="empty full">Noch keine Kaffees getrackt. Nach ein paar Shots erscheinen hier Schnellbuttons.</div>`; return; }
  top.forEach(({ name, count }) => {
    const rec = findRecommendation(name, el.grinderSelect.value);
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "quick-btn";
    btn.innerHTML = `<span>☕</span><strong>${escapeHTML(name)}</strong><small>${count} Shots${rec ? ` · MG ${formatNumber(rec.best_grind, 1)}` : ""}</small>`;
    btn.addEventListener("click", () => { el.coffeeName.value = name; updateCurrentRecommendation(); openView("add"); });
    el.quickCoffeeButtons.appendChild(btn);
  });
}

function getTopCoffeeNames() {
  const map = new Map();
  state.entries.forEach(e => { if (!e.drink_name) return; map.set(e.drink_name, (map.get(e.drink_name) || 0) + 1); });
  return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
}


/* ============================================================
   Recommendations
   ============================================================ */

function scoreShot(entry) {
  const rating   = Number(entry.rating);
  const time     = Number(entry.extraction_time_s);
  const pressure = Number(entry.pressure_bar);
  const tTime    = (Number(state.settings.target_time_min_s) + Number(state.settings.target_time_max_s)) / 2;
  const tPress   = (Number(state.settings.target_pressure_min_bar) + Number(state.settings.target_pressure_max_bar)) / 2;
  let score = 0;
  if (Number.isFinite(rating))   score += (rating / 5) * 55; else score += 18;
  if (Number.isFinite(time))     score += Math.max(0, 25 - Math.abs(time - tTime) * 3.2);
  if (Number.isFinite(pressure)) score += Math.max(0, 14 - Math.abs(pressure - tPress) * 4);
  if (entry.entry_date) { const age = (Date.now() - new Date(`${entry.entry_date}T00:00:00`).getTime()) / 86400000; score += Math.max(0, 6 - age * 0.08); }
  return Math.round(score);
}

function isShotInTarget(entry) {
  const time     = Number(entry.extraction_time_s);
  const pressure = Number(entry.pressure_bar);
  const timeOk   = Number.isFinite(time) && time >= Number(state.settings.target_time_min_s) && time <= Number(state.settings.target_time_max_s);
  const pressOk  = !Number.isFinite(pressure) || (pressure >= Number(state.settings.target_pressure_min_bar) && pressure <= Number(state.settings.target_pressure_max_bar));
  return timeOk && pressOk;
}

function recommendationKey(e) { return `${normalize(e.drink_name)}__${e.grinder_id || "no-grinder"}`; }

function buildRecommendations(entries) {
  const groups = new Map();
  entries
    .filter(e => e.drink_name && e.mahlgrad !== null && e.mahlgrad !== undefined)
    .filter(isShotAfterLastBigCleaning)   // <-- NEU: nur Shots seit letzter großer Reinigung
    .forEach(e => {
      const k = recommendationKey(e);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });
  return Array.from(groups.values())
    .map(buildRecommendationFromGroup)
    .sort((a,b) => b.score - a.score);
}

function buildRecommendationFromGroup(group) {
  const sorted    = [...group].sort((a,b) => scoreShot(b) - scoreShot(a));
  const best      = sorted[0];
  const goodShots = group.filter(e => scoreShot(e) >= 75 || isShotInTarget(e));
  const baseShots = goodShots.length ? goodShots : [best];
  const grinds    = baseShots.map(e => Number(e.mahlgrad)).filter(Number.isFinite).sort((a,b) => a-b);
  const avg = arr => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : null;
  const confidence = group.length >= 6 ? "stabil" : group.length >= 3 ? "vorläufig" : "erster Richtwert";
  return {
    coffee_name:  best.drink_name,
    cleaning_info: buildCleaningInfo(best.grinder_id),
    grinder_id:   best.grinder_id || null,
    grinder_name: equipmentName(best.grinder_id),
    best_grind:   Number(best.mahlgrad),
    grind_min:    grinds[0],
    grind_max:    grinds[grinds.length - 1],
    best_entry:   best,
    shots_count:  group.length,
    good_count:   goodShots.length,
    hit_count:    group.filter(isShotInTarget).length,
    avg_time:     avg(group.map(e => Number(e.extraction_time_s)).filter(Number.isFinite)),
    avg_pressure: avg(group.map(e => Number(e.pressure_bar)).filter(Number.isFinite)),
    avg_rating:   avg(group.map(e => Number(e.rating)).filter(Number.isFinite)),
    score:        scoreShot(best),
    confidence,
    hint:         buildGrindHint(best),
  };
}

function buildCleaningInfo(grinderId) {
  const date = getLastBigCleaningDate(grinderId);
  if (!date) return null;
  const days = daysSince(date);
  return `🧽 Basis: Shots seit letzter großer Reinigung (${formatDateShort(date)}, vor ${days}d)`;
}

function buildGrindHint(entry) {
  const time    = Number(entry.extraction_time_s);
  const pressure= Number(entry.pressure_bar);
  const minT = Number(state.settings.target_time_min_s);
  const maxT = Number(state.settings.target_time_max_s);
  const minP = Number(state.settings.target_pressure_min_bar);
  const maxP = Number(state.settings.target_pressure_max_bar);
  if (!Number.isFinite(time))                                return "Noch keine Zeitbewertung möglich. Beim nächsten Shot Extraktionszeit eintragen.";
  if (time < minT)                                           return "Der beste bekannte Shot lief eher zu schnell. Beim nächsten Versuch tendenziell etwas feiner mahlen.";
  if (time > maxT)                                           return "Der beste bekannte Shot lief eher zu langsam. Beim nächsten Versuch tendenziell etwas gröber mahlen.";
  if (Number.isFinite(pressure) && pressure < minP)          return "Zeit passt, Druck eher niedrig. Puck Prep prüfen oder minimal feiner mahlen.";
  if (Number.isFinite(pressure) && pressure > maxP)          return "Zeit passt, Druck eher hoch. Puck Prep prüfen oder minimal gröber mahlen.";
  return "Sehr guter Bereich. Mahlgrad erstmal beibehalten.";
}

function findRecommendation(coffeeName, grinderId) {
  const nc    = normalize(coffeeName);
  const exact = state.recommendations.find(r => normalize(r.coffee_name) === nc && String(r.grinder_id || "") === String(grinderId || ""));
  if (exact) return exact;
  return state.recommendations.find(r => normalize(r.coffee_name) === nc) || null;
}

function updateCurrentRecommendation() {
  const coffeeName = el.coffeeName.value.trim();
  if (!coffeeName) { el.recommendationBox.classList.add("hidden"); return; }
  const rec = findRecommendation(coffeeName, el.grinderSelect.value);
  el.recommendationBox.classList.remove("hidden");
  if (!rec) {
    el.recommendationTitle.textContent = "Noch keine Empfehlung";
    el.recommendationText.textContent  = "Für diesen Kaffee gibt es noch keinen gespeicherten Shot mit Mahlgrad.";
    el.applyRecommendationBtn.classList.add("hidden");
    return;
  }
  el.applyRecommendationBtn.classList.remove("hidden");
  const range = rec.grind_min !== rec.grind_max
    ? `Bereich ${formatNumber(rec.grind_min, 1)}–${formatNumber(rec.grind_max, 1)}`
    : `Mahlgrad ${formatNumber(rec.best_grind, 1)}`;
  el.recommendationTitle.textContent = `Empfehlung: ${range}`;
  el.recommendationText.textContent  = `${rec.coffee_name} · ${rec.grinder_name} · ${rec.shots_count} Shots · ${rec.confidence} · Ø ${formatNumber(rec.avg_time, 1)}s · Score ${rec.score}. ${rec.hint}`;
}

function applyCurrentRecommendation() {
  const rec = findRecommendation(el.coffeeName.value.trim(), el.grinderSelect.value);
  if (!rec) return;
  el.mahlgrad.value     = rec.best_grind ?? "";
  el.doseG.value        = rec.best_entry.dose_g ?? "18";
  el.yieldG.value       = rec.best_entry.yield_g ?? "36";
  el.pressureBar.value  = rec.best_entry.pressure_bar ?? "";
  el.temperatureC.value = rec.best_entry.temperature_c ?? "";
  setFormMessage("Empfehlung übernommen.");
}

function renderRecommendations() {
  el.recommendationsCount.textContent = `${state.recommendations.length} Empfehlungen`;
  el.recommendationsList.innerHTML    = "";
  if (!state.recommendations.length) {
    el.recommendationsList.innerHTML = `<div class="empty">Noch keine Empfehlungen. Speichere ein paar Shots mit Kaffee, Mühle, Mahlgrad und Bewertung.</div>`;
    return;
  }
  state.recommendations.forEach(rec => {
    const card  = document.createElement("article");
    card.className = `recommendation-card ${confidenceClass(rec.confidence)}`;
    const range = rec.grind_min !== rec.grind_max
      ? `${formatNumber(rec.grind_min, 1)}–${formatNumber(rec.grind_max, 1)}`
      : `${formatNumber(rec.best_grind, 1)}`;
    card.innerHTML = `
      <div class="recommendation-top">
        <div><h3>${escapeHTML(rec.coffee_name)}</h3><p>${escapeHTML(rec.grinder_name)} · ${rec.shots_count} Shots · ${rec.confidence}</p></div>
        <div class="grind-badge"><span>MG</span><strong>${range}</strong></div>
      </div>
      <div class="entry-meta recommendation-meta">
        <span>⭐ Ø ${formatNumber(rec.avg_rating, 1)}/5</span>
        <span>⏱️ Ø ${formatNumber(rec.avg_time, 1)}s</span>
        <span>🧭 Ø ${formatNumber(rec.avg_pressure, 1)} Bar</span>
        <span>🎯 ${rec.hit_count}/${rec.shots_count}</span>
        <span>Score ${rec.score}</span>
      </div>
      <p>${escapeHTML(rec.hint)}</p>
      ${rec.cleaning_info ? `<p class="cleaning-info-note">${escapeHTML(rec.cleaning_info)}</p>` : ""}
      <div class="actions compact-actions">
        <button class="primary use-rec-btn" type="button">Für neuen Shot nutzen</button>
      </div>`;
    card.querySelector(".use-rec-btn").addEventListener("click", () => {
      resetForm();
      el.coffeeName.value    = rec.coffee_name;
      el.grinderSelect.value = rec.grinder_id || "";
      applyRecommendationFromObject(rec);
      openView("add");
    });
    el.recommendationsList.appendChild(card);
  });
}

function applyRecommendationFromObject(rec) {
  el.mahlgrad.value     = rec.best_grind ?? "";
  el.doseG.value        = rec.best_entry.dose_g ?? "18";
  el.yieldG.value       = rec.best_entry.yield_g ?? "36";
  el.pressureBar.value  = rec.best_entry.pressure_bar ?? "";
  el.temperatureC.value = rec.best_entry.temperature_c ?? "";
  updateCurrentRecommendation();
}

function confidenceClass(c) {
  if (c === "stabil")    return "confidence-high";
  if (c === "vorläufig") return "confidence-mid";
  return "confidence-low";
}


/* ============================================================
   Shot Form
   ============================================================ */

function methodDefaultCaffeine(method) {
  const t = normalize(method);
  if (t.includes("doppel"))   return 120;
  if (t.includes("espresso")) return 80;
  if (t.includes("v60"))      return 120;
  if (t.includes("french"))   return 110;
  if (t.includes("cold"))     return 150;
  return 95;
}

function readEntryForm() {
  const rawTime = el.entryTime.value || nowTime();
  return {
    entry_date: el.entryDate.value || todayISO(),
    entry_time: rawTime.length === 5 ? `${rawTime}:00` : rawTime,
    drink_name: el.coffeeName.value.trim(),
    drink_type: el.brewMethod.value,
    emoji:      getMethodIcon(el.brewMethod.value),
    amount_ml:        toNumber(el.yieldG.value),
    caffeine_mg:      toNumber(el.caffeineMg.value),
    dose_g:           toNumber(el.doseG.value),
    yield_g:          toNumber(el.yieldG.value),
    mahlgrad:         toNumber(el.mahlgrad.value),
    extraction_time_s:toNumber(el.extractionTime.value),
    pressure_bar:     toNumber(el.pressureBar.value),
    temperature_c:    toNumber(el.temperatureC.value),
    rating:           toNumber(el.rating.value),
    note:             el.note.value.trim() || null,
    machine_id:       el.machineSelect.value ? Number(el.machineSelect.value) : null,
    grinder_id:       el.grinderSelect.value ? Number(el.grinderSelect.value) : null,
    grinder_cleaning_id: el.grinderSelect.value
      ? getLatestCleaningId(Number(el.grinderSelect.value))
      : null,
  };
}

function validateEntryForm() {
  const entry = readEntryForm();
  el.coffeeError.textContent = el.mahlgradError.textContent = el.formError.textContent = "";
  let valid = true;
  if (!entry.drink_name)       { el.coffeeError.textContent   = "Bitte Kaffee oder Bohne eintragen."; valid = false; }
  if (entry.mahlgrad === null) { el.mahlgradError.textContent = "Bitte Mahlgrad eintragen.";          valid = false; }
  return valid;
}

async function saveEntry(event) {
  event.preventDefault();
  if (!validateEntryForm()) return;
  const payload     = readEntryForm();
  const isEditing   = Boolean(state.editingId);
  const defaultText = isEditing ? "Änderung speichern" : "Shot speichern ☕";
  setButtonLoading(el.saveEntryBtn, true, "Speichere ...", defaultText);
  const response = isEditing
    ? await supabaseClient.from(TABLE_ENTRIES).update(payload).eq("id", state.editingId).select().single()
    : await supabaseClient.from(TABLE_ENTRIES).insert(payload).select().single();
  setButtonLoading(el.saveEntryBtn, false, "Speichere ...", defaultText);
  if (response.error) { console.error("Save:", response.error); setFormMessage(`Speichern fehlgeschlagen: ${response.error.message}`, "error"); return; }
  await loadEntries();
  state.recommendations = buildRecommendations(state.entries);
  const rec = findRecommendation(payload.drink_name, payload.grinder_id);
  resetForm(); renderAll();
  showToast(isEditing ? "Shot aktualisiert ☕" : "Shot gespeichert ☕");
  if (rec) setFormMessage(`Aktuelle Empfehlung für ${payload.drink_name}: Mahlgrad ${formatNumber(rec.best_grind, 1)}.`);
  openView("recommendations");
}

function resetForm() {
  state.editingId = null;
  el.entryDate.value = todayISO(); el.entryTime.value = nowTime();
  el.coffeeName.value = ""; el.brewMethod.value = "Espresso";
  el.doseG.value = "18"; el.yieldG.value = "36"; el.mahlgrad.value = "";
  el.extractionTime.value = ""; el.pressureBar.value = ""; el.temperatureC.value = "";
  el.caffeineMg.value = "80"; el.rating.value = ""; el.note.value = "";
  el.coffeeError.textContent = el.mahlgradError.textContent = el.formError.textContent = "";
  setFormMessage("");
  el.saveEntryBtn.textContent = "Shot speichern ☕";
  el.cancelEditBtn.classList.add("hidden");
  el.editBadge.classList.add("hidden");
  renderEquipmentSelects();
  updateCurrentRecommendation();
}

function cancelEdit() { resetForm(); }

function startEdit(entry) {
  state.editingId = entry.id;
  el.entryDate.value     = entry.entry_date || todayISO();
  el.entryTime.value     = formatEntryTime(entry.entry_time);
  el.coffeeName.value    = entry.drink_name || "";
  el.brewMethod.value    = entry.drink_type || "Espresso";
  el.machineSelect.value = entry.machine_id || "";
  el.grinderSelect.value = entry.grinder_id || "";
  el.doseG.value         = entry.dose_g ?? "18";
  el.yieldG.value        = entry.yield_g ?? "36";
  el.mahlgrad.value      = entry.mahlgrad ?? "";
  el.extractionTime.value= entry.extraction_time_s ?? "";
  el.pressureBar.value   = entry.pressure_bar ?? "";
  el.temperatureC.value  = entry.temperature_c ?? "";
  el.caffeineMg.value    = entry.caffeine_mg ?? "80";
  el.rating.value        = entry.rating ?? "";
  el.note.value          = entry.note || "";
  el.saveEntryBtn.textContent = "Änderung speichern";
  el.cancelEditBtn.classList.remove("hidden");
  el.editBadge.classList.remove("hidden");
  setFormMessage("Du bearbeitest gerade einen bestehenden Shot.");
  updateCurrentRecommendation();
  openView("add");
}

function duplicateLastShot() {
  const last = state.entries[0];
  if (!last) { showToast("Noch kein Shot zum Duplizieren vorhanden."); return; }
  state.editingId = null;
  el.entryDate.value = todayISO(); el.entryTime.value = nowTime();
  el.coffeeName.value    = last.drink_name || "";
  el.brewMethod.value    = last.drink_type || "Espresso";
  el.machineSelect.value = last.machine_id || "";
  el.grinderSelect.value = last.grinder_id || "";
  el.doseG.value         = last.dose_g ?? "18";
  el.yieldG.value        = last.yield_g ?? "36";
  el.mahlgrad.value      = last.mahlgrad ?? "";
  el.extractionTime.value= "";
  el.pressureBar.value   = last.pressure_bar ?? "";
  el.temperatureC.value  = last.temperature_c ?? "";
  el.caffeineMg.value    = last.caffeine_mg ?? "80";
  el.rating.value        = ""; el.note.value = "";
  setFormMessage("Letzter Shot wurde als Vorlage übernommen.");
  updateCurrentRecommendation();
}


/* ============================================================
   History
   ============================================================ */

function getFilteredEntries() {
  return state.entries.filter(e => {
    const dateOk   = !state.filters.date   || e.entry_date === state.filters.date;
    const coffeeOk = !state.filters.coffee || e.drink_name === state.filters.coffee;
    return dateOk && coffeeOk;
  });
}

function renderEntries() {
  const entries = getFilteredEntries();
  el.entriesCount.textContent = `${entries.length} Shots`;
  el.entriesList.innerHTML    = "";
  if (!entries.length) { el.entriesList.innerHTML = `<div class="empty">Noch keine passenden Shots vorhanden.</div>`; return; }

  const groups = new Map();
  entries.forEach(e => { if (!groups.has(e.entry_date)) groups.set(e.entry_date, []); groups.get(e.entry_date).push(e); });

  groups.forEach((dayEntries, day) => {
    const group = document.createElement("section");
    group.className = "day-group";
    group.innerHTML = `<div class="day-head"><h3>${escapeHTML(formatDateHeader(day))}</h3><span>${dayEntries.length} Shots</span></div>`;
    dayEntries.forEach(entry => {
      const score = scoreShot(entry);
      const card  = document.createElement("article");
      card.className = `entry-card compact ${scoreClass(score)}`; card.tabIndex = 0;
      card.innerHTML = `
        <div class="swipe-hint left">✏️ Bearbeiten</div>
        <div class="swipe-hint right">🗑️ Löschen</div>
        <div class="entry-main">
          <div class="entry-icon">${escapeHTML(getMethodIcon(entry.drink_type))}</div>
          <div class="entry-content">
            <div class="entry-title-row"><strong>${escapeHTML(entry.drink_name)}</strong><span>${escapeHTML(formatEntryTime(entry.entry_time))}</span></div>
            <div class="entry-meta">
              <span>⚙️ MG ${formatNumber(entry.mahlgrad, 1)}</span>
              <span>⏱️ ${formatNumber(entry.extraction_time_s, 1)}s</span>
              <span>🧭 ${formatNumber(entry.pressure_bar, 1)} Bar</span>
              <span>⚖️ ${formatNumber(entry.dose_g, 1)}→${formatNumber(entry.yield_g, 1)}g</span>
              <span>⭐ ${entry.rating || "–"}/5</span>
            </div>
            <div class="entry-meta secondary-meta">
              <span>${escapeHTML(equipmentName(entry.grinder_id))}</span>
              <span>${escapeHTML(entry.drink_type || "Espresso")}</span>
              <span>Score ${score}</span>
              ${entry.grinder_id && !isShotAfterLastBigCleaning(entry)
                ? `<span class="cleaning-flag-old">vor letzter Reinigung</span>`
                : entry.grinder_cleaning_id
                  ? `<span class="cleaning-flag-fresh">🧽 nach Reinigung</span>`
                  : ""}
            </div>
            ${entry.note ? `<p>${escapeHTML(entry.note)}</p>` : ""}
          </div>
        </div>
        <button class="delete-entry" type="button" aria-label="Shot löschen">×</button>`;
      card.addEventListener("click",   () => { if (card.dataset.swiped !== "true") startEdit(entry); });
      card.addEventListener("keydown", e => { if (e.key === "Enter") startEdit(entry); });
      card.querySelector(".delete-entry").addEventListener("click", async e => { e.stopPropagation(); await deleteEntry(entry.id); });
      enableSwipeActions(card, entry);
      group.appendChild(card);
    });
    el.entriesList.appendChild(group);
  });
}

function scoreClass(score) { return score >= 80 ? "rating-good" : score >= 60 ? "rating-mid" : "rating-bad"; }

function enableSwipeActions(card, entry) {
  let startX = 0, currentX = 0, dragging = false;
  card.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    startX = currentX = e.clientX; dragging = true; card.dataset.swiped = "false"; card.setPointerCapture(e.pointerId);
  });
  card.addEventListener("pointermove", e => {
    if (!dragging) return;
    currentX = e.clientX; const dx = currentX - startX;
    if (Math.abs(dx) > 8) {
      card.style.transform = `translateX(${Math.max(Math.min(dx, 90), -90)}px)`;
      card.classList.toggle("swiping-edit",   dx >  30);
      card.classList.toggle("swiping-delete", dx < -30);
    }
  });
  card.addEventListener("pointerup", async () => {
    if (!dragging) return;
    dragging = false; const dx = currentX - startX;
    card.style.transform = ""; card.classList.remove("swiping-edit", "swiping-delete");
    if (dx >  82) { card.dataset.swiped = "true"; startEdit(entry);         return; }
    if (dx < -82) { card.dataset.swiped = "true"; await deleteEntry(entry.id); return; }
    setTimeout(() => { card.dataset.swiped = "false"; }, 80);
  });
}

async function deleteEntry(id) {
  if (!window.confirm("Diesen Shot wirklich löschen?")) return;
  const { error } = await supabaseClient.from(TABLE_ENTRIES).delete().eq("id", id);
  if (error) { console.error(error); showToast("Löschen fehlgeschlagen."); return; }
  showToast("Shot gelöscht."); await loadEntries(); renderAll();
}

async function deleteAllEntries() {
  if (!window.confirm("Wirklich ALLE Shots löschen?")) return;
  if (window.prompt('Zur Sicherheit bitte "ALLE LÖSCHEN" eingeben:') !== "ALLE LÖSCHEN") { showToast("Löschen abgebrochen."); return; }
  const { error } = await supabaseClient.from(TABLE_ENTRIES).delete().neq("id", 0);
  if (error) { console.error(error); showToast("Löschen fehlgeschlagen."); return; }
  showToast("Alle Shots gelöscht."); await loadEntries(); renderAll();
}


/* ============================================================
   Dashboard
   ============================================================ */

function renderDashboard() {
  const today        = todayISO();
  const todayEntries = state.entries.filter(e => e.entry_date === today);
  const todayCaff    = sumCaffeine(todayEntries);
  const limit        = Number(state.settings.caffeine_limit_mg) || 400;

  el.todayCount.textContent    = String(todayEntries.length);
  el.todayCaffeine.textContent = `${formatNumber(todayCaff)} mg`;
  el.limitText.textContent     = `Limit: ${formatNumber(limit)} mg`;

  const times   = state.entries.map(e => Number(e.extraction_time_s)).filter(Number.isFinite);
  const avgTime = times.length ? times.reduce((a,b) => a+b, 0) / times.length : null;
  el.avgTime.textContent = avgTime === null ? "–" : `${formatNumber(avgTime, 1)}s`;

  const tShots = state.entries.filter(e => Number.isFinite(Number(e.extraction_time_s)));
  const hits   = tShots.filter(isShotInTarget).length;
  el.hitRate.textContent = tShots.length ? `${formatNumber((hits / tShots.length) * 100)}%` : "–";

  if (todayCaff > limit) {
    el.overLimitHint.textContent = `Tageslimit überschritten: ${formatNumber(todayCaff)} mg von ${formatNumber(limit)} mg.`;
    el.overLimitHint.classList.remove("hidden");
  } else {
    el.overLimitHint.classList.add("hidden");
  }

  renderShellyPanel();
  renderWeekCanvas();
  renderTrendCanvas();
  renderCoffeeRanking();
  renderTopShots();
  renderMethodDistribution();
  renderHeatmap();
}

function renderWeekCanvas() {
  const days    = getLastNDays(7);
  const values  = days.map(d => sumCaffeine(state.entries.filter(e => e.entry_date === d)));
  const average = values.reduce((a,b) => a+b, 0) / 7;
  const prev    = getPreviousNDays(7, 7);
  const prevTot = prev.reduce((s,d) => s + sumCaffeine(state.entries.filter(e => e.entry_date === d)), 0);
  const curTot  = values.reduce((a,b) => a+b, 0);
  if (prevTot > 0) {
    const diff = ((curTot - prevTot) / prevTot) * 100;
    el.weekCompare.textContent = `${diff >= 0 ? "+" : ""}${formatNumber(diff)}% zur Vorwoche`;
  } else {
    el.weekCompare.textContent = "Keine Vorwoche";
  }
  const labels = days.map(d => new Date(`${d}T00:00:00`).toLocaleDateString("de-DE", { weekday: "short" }));
  drawBarWithAverage(el.weekCanvas, labels, values, average, "mg");
}

function renderTrendCanvas() {
  const shots  = [...state.entries].filter(e => Number.isFinite(Number(e.extraction_time_s)))
    .sort((a,b) => (`${a.entry_date} ${a.entry_time}`).localeCompare(`${b.entry_date} ${b.entry_time}`)).slice(-30);
  const values = shots.map(e => Number(e.extraction_time_s));
  const labels = shots.map((_,i) => String(i+1));
  if (values.length >= 4) {
    const mid  = Math.floor(values.length / 2);
    const f    = values.slice(0, mid).reduce((a,b) => a+b, 0) / mid;
    const s    = values.slice(mid).reduce((a,b) => a+b, 0) / (values.length - mid);
    el.trendBadge.textContent = s > f + 2 ? "langsamer" : s < f - 2 ? "schneller" : "stabil";
  } else { el.trendBadge.textContent = "zu wenig Daten"; }
  drawLineChart(el.trendCanvas, labels, values, "s");
}

function renderCoffeeRanking() {
  el.coffeeRanking.innerHTML = "";
  const top = getTopCoffeeNames().slice(0, 6);
  if (!top.length) { el.coffeeRanking.innerHTML = `<div class="empty compact">Noch keine Daten.</div>`; return; }
  const max = Math.max(...top.map(i => i.count));
  top.forEach(({ name, count }, index) => {
    const row = document.createElement("div"); row.className = "rank-row";
    row.innerHTML = `<span class="rank-number">${index + 1}</span><div><strong>${escapeHTML(name)}</strong><div class="mini-track"><div class="mini-fill" style="width:${(count/max)*100}%"></div></div></div><span>${count}x</span>`;
    el.coffeeRanking.appendChild(row);
  });
}

function renderTopShots() {
  el.topShots.innerHTML = "";
  const shots = [...state.entries].filter(e => e.mahlgrad !== null && e.mahlgrad !== undefined)
    .sort((a,b) => scoreShot(b) - scoreShot(a)).slice(0, 5);
  if (!shots.length) { el.topShots.innerHTML = `<div class="empty compact">Noch keine Shots mit Score.</div>`; return; }
  shots.forEach((entry, index) => {
    const row = document.createElement("div"); row.className = "rank-row";
    row.innerHTML = `<span class="rank-number">${index + 1}</span><div><strong>${escapeHTML(entry.drink_name)}</strong><small>MG ${formatNumber(entry.mahlgrad, 1)} · ${formatNumber(entry.extraction_time_s, 1)}s · ${entry.rating || "–"}/5</small></div><span>Score ${scoreShot(entry)}</span>`;
    el.topShots.appendChild(row);
  });
}

function renderMethodDistribution() {
  const map = new Map();
  state.entries.forEach(e => { const m = e.drink_type || "Espresso"; map.set(m, (map.get(m) || 0) + 1); });
  const items = Array.from(map.entries()).sort((a,b) => b[1] - a[1]);
  drawDonut(el.methodCanvas, items);
  el.methodBars.innerHTML = "";
  if (!items.length) { el.methodBars.innerHTML = `<div class="empty compact">Noch keine Methoden-Daten.</div>`; return; }
  const max = Math.max(...items.map(i => i[1]));
  items.slice(0, 6).forEach(([method, count]) => {
    const row = document.createElement("div"); row.className = "method-row";
    row.innerHTML = `<span>${escapeHTML(getMethodIcon(method))}</span><strong>${escapeHTML(method)}</strong><div class="mini-track"><div class="mini-fill" style="width:${(count/max)*100}%"></div></div><small>${count}x</small>`;
    el.methodBars.appendChild(row);
  });
}

function renderHeatmap() {
  el.heatmap.innerHTML = "";
  const hours    = Array.from({ length: 19 }, (_, i) => i + 5);
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const matrix   = new Map();
  state.entries.forEach(e => {
    const d = new Date(`${e.entry_date}T00:00:00`);
    const wd = (d.getDay() + 6) % 7;
    const h  = Number(String(e.entry_time || "00:00").slice(0, 2));
    if (h >= 5 && h <= 23) { const k = `${wd}-${h}`; matrix.set(k, (matrix.get(k) || 0) + 1); }
  });
  const max = Math.max(1, ...matrix.values());
  const top = Array.from(matrix.entries()).sort((a,b) => b[1] - a[1])[0];
  if (top) {
    const [k] = top; const [wd, h] = k.split("-").map(Number);
    el.peakHour.textContent = `${weekdays[wd]} ${String(h).padStart(2,"0")}:00`;
  } else { el.peakHour.textContent = "–"; }

  const tl = document.createElement("div"); tl.className = "heatmap-label"; el.heatmap.appendChild(tl);
  hours.forEach(h => { const c = document.createElement("div"); c.className = "heatmap-label hour-label"; c.textContent = String(h); el.heatmap.appendChild(c); });
  weekdays.forEach((wdLabel, wdIdx) => {
    const label = document.createElement("div"); label.className = "heatmap-label"; label.textContent = wdLabel; el.heatmap.appendChild(label);
    hours.forEach(h => {
      const count = matrix.get(`${wdIdx}-${h}`) || 0;
      const cell  = document.createElement("div"); cell.className = "heatmap-cell";
      cell.title  = `${wdLabel} ${h}:00 – ${count} Shots`;
      cell.style.opacity = count ? String(0.22 + (count / max) * 0.78) : "0.1";
      el.heatmap.appendChild(cell);
    });
  });
}


/* ============================================================
   Equipment
   ============================================================ */

function readEquipmentForm() {
  return {
    category:      el.equipmentCategory.value || "Sonstiges",
    name:          el.equipmentName.value.trim(),
    brand:         el.equipmentBrand.value.trim()  || null,
    model:         el.equipmentModel.value.trim()  || null,
    purchase_date: el.equipmentPurchaseDate.value  || null,
    price_eur:     toNumber(el.equipmentPrice.value),
    facts:         el.equipmentFacts.value.trim()  || null,
    notes:         el.equipmentNotes.value.trim()  || null,
    is_active:     Boolean(el.equipmentActive.checked),
    updated_at:    new Date().toISOString(),
  };
}

async function saveEquipment(event) {
  event.preventDefault();
  const payload   = readEquipmentForm();
  if (!payload.name) { setEquipmentMessage("Bitte mindestens einen Namen eintragen.", "error"); return; }
  const isEditing   = Boolean(state.editingEquipmentId);
  const defaultText = isEditing ? "Änderung speichern" : "Equipment speichern";
  setButtonLoading(el.saveEquipmentBtn, true, "Speichere ...", defaultText);
  const response = isEditing
    ? await supabaseClient.from(TABLE_EQUIPMENT).update(payload).eq("id", state.editingEquipmentId).select().single()
    : await supabaseClient.from(TABLE_EQUIPMENT).insert(payload).select().single();
  setButtonLoading(el.saveEquipmentBtn, false, "Speichere ...", defaultText);
  if (response.error) { console.error("Equipment:", response.error); setEquipmentMessage(`Speichern fehlgeschlagen: ${response.error.message}`, "error"); return; }
  showToast(isEditing ? "Equipment aktualisiert." : "Equipment gespeichert.");
  resetEquipmentForm(); await loadEquipment(); renderAll();
}

function renderEquipment() {
  el.equipmentCount.textContent = `${state.equipment.length} Geräte`;
  el.equipmentList.innerHTML    = "";
  if (!state.equipment.length) { el.equipmentList.innerHTML = `<div class="empty">Noch kein Equipment hinterlegt.</div>`; return; }
  const grouped = new Map();
  state.equipment.forEach(item => { const c = item.category || "Sonstiges"; if (!grouped.has(c)) grouped.set(c, []); grouped.get(c).push(item); });
  grouped.forEach((items, category) => {
    const group = document.createElement("section"); group.className = "equipment-group";
    group.innerHTML = `<div class="day-head"><h3>${escapeHTML(getEquipmentIcon(category))} ${escapeHTML(category)}</h3><span>${items.length}</span></div>`;
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = `equipment-card ${item.is_active ? "active-equipment" : "inactive-equipment"}`;
      card.innerHTML = `
        <div class="equipment-main">
          <div class="equipment-icon">${escapeHTML(getEquipmentIcon(item.category))}</div>
          <div class="equipment-content">
            <div class="equipment-title-row"><strong>${escapeHTML(item.name)}</strong><span>${item.is_active ? "Aktiv" : "Inaktiv"}</span></div>
            <div class="entry-meta">
              ${item.brand         ? `<span>${escapeHTML(item.brand)}</span>` : ""}
              ${item.model         ? `<span>${escapeHTML(item.model)}</span>` : ""}
              ${item.purchase_date ? `<span>Gekauft: ${formatDateShort(item.purchase_date)}</span>` : ""}
              ${item.price_eur != null ? `<span>${formatNumber(item.price_eur, 2)} €</span>` : ""}
            </div>
            ${item.facts ? `<p><strong>Fakten:</strong> ${escapeHTML(item.facts)}</p>` : ""}
            ${item.notes ? `<p><strong>Notiz:</strong>  ${escapeHTML(item.notes)}</p>`  : ""}
          </div>
        </div>
        <button class="delete-equipment" type="button" aria-label="Equipment löschen">×</button>`;
      card.addEventListener("click", () => startEditEquipment(item));
      card.querySelector(".delete-equipment").addEventListener("click", async e => { e.stopPropagation(); await deleteEquipment(item.id); });
      group.appendChild(card);
    });
    el.equipmentList.appendChild(group);
  });
}

function startEditEquipment(item) {
  state.editingEquipmentId      = item.id;
  el.equipmentCategory.value    = item.category || "Sonstiges";
  el.equipmentName.value        = item.name     || "";
  el.equipmentBrand.value       = item.brand    || "";
  el.equipmentModel.value       = item.model    || "";
  el.equipmentPurchaseDate.value= item.purchase_date || "";
  el.equipmentPrice.value       = item.price_eur ?? "";
  el.equipmentFacts.value       = item.facts    || "";
  el.equipmentNotes.value       = item.notes    || "";
  el.equipmentActive.checked    = Boolean(item.is_active);
  el.saveEquipmentBtn.textContent = "Änderung speichern";
  el.cancelEquipmentEditBtn.classList.remove("hidden");
  setEquipmentMessage("Du bearbeitest gerade ein Equipment.");
  openView("equipment");
}

function resetEquipmentForm() {
  state.editingEquipmentId       = null;
  el.equipmentCategory.value     = "Maschine"; el.equipmentName.value  = ""; el.equipmentBrand.value = "";
  el.equipmentModel.value        = ""; el.equipmentPurchaseDate.value   = ""; el.equipmentPrice.value = "";
  el.equipmentFacts.value        = ""; el.equipmentNotes.value          = ""; el.equipmentActive.checked = true;
  el.saveEquipmentBtn.textContent = "Equipment speichern";
  el.cancelEquipmentEditBtn.classList.add("hidden");
  setEquipmentMessage("");
}

async function deleteEquipment(id) {
  if (!window.confirm("Dieses Equipment wirklich löschen?")) return;
  const { error } = await supabaseClient.from(TABLE_EQUIPMENT).delete().eq("id", id);
  if (error) { console.error(error); showToast("Löschen fehlgeschlagen."); return; }
  showToast("Equipment gelöscht."); await loadEquipment(); renderAll();
}


/* ============================================================
   Settings
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
  if (payload.target_time_min_s >= payload.target_time_max_s) { setSettingsMessage("Die minimale Zielzeit muss kleiner als die maximale Zielzeit sein.", "error"); return; }
  setButtonLoading(el.saveSettingsBtn, true, "Speichere ...", "Einstellungen speichern");
  const { error } = await supabaseClient.from(TABLE_SETTINGS).upsert(payload, { onConflict: "id" });
  setButtonLoading(el.saveSettingsBtn, false, "Speichere ...", "Einstellungen speichern");
  if (error) { console.error("Settings:", error); setSettingsMessage(`Speichern fehlgeschlagen: ${error.message}`, "error"); return; }
  state.settings = {
    caffeine_limit_mg:       payload.caffeine_limit_mg,
    target_time_min_s:       payload.target_time_min_s,
    target_time_max_s:       payload.target_time_max_s,
    target_pressure_min_bar: payload.target_pressure_min_bar,
    target_pressure_max_bar: payload.target_pressure_max_bar,
  };
  state.recommendations = buildRecommendations(state.entries);
  setSettingsMessage("Einstellungen gespeichert."); showToast("Einstellungen gespeichert."); renderAll();
}


/* ============================================================
   Charts
   ============================================================ */

function setupCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect  = canvas.getBoundingClientRect();
  const width = rect.width || 400;
  const height= Number(canvas.getAttribute("height")) || 220;
  canvas.width  = Math.floor(width  * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function drawBarWithAverage(canvas, labels, values, average, unit) {
  const s = setupCanvas(canvas); if (!s) return;
  const { ctx, width, height } = s;
  const pad = 30, chartW = width - pad*2, chartH = height - pad*2;
  const max = Math.max(average, ...values, 1) * 1.25;
  const barGap = 8, barW = Math.max(10, (chartW - barGap * (values.length-1)) / values.length);
  ctx.strokeStyle = "rgba(245,245,245,0.12)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pad + (chartH/4)*i; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width-pad, y); ctx.stroke(); }
  values.forEach((value, index) => {
    const x = pad + index * (barW + barGap), h = (value/max)*chartH, y = pad + chartH - h;
    const grd = ctx.createLinearGradient(0, y, 0, y+h); grd.addColorStop(0, "#ffcf8a"); grd.addColorStop(1, "#8b4513");
    ctx.fillStyle = grd; roundRect(ctx, x, y, barW, h||2, 6); ctx.fill();
    ctx.fillStyle = "rgba(245,245,245,0.68)"; ctx.font = "11px system-ui"; ctx.textAlign = "center";
    ctx.fillText(labels[index], x + barW/2, height - 8);
  });
  const avgY = pad + chartH - (average/max)*chartH;
  ctx.strokeStyle = "rgba(245,245,245,0.8)"; ctx.setLineDash([5,5]);
  ctx.beginPath(); ctx.moveTo(pad, avgY); ctx.lineTo(width-pad, avgY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "rgba(245,245,245,0.8)"; ctx.font = "11px system-ui"; ctx.textAlign = "left";
  ctx.fillText(`Ø ${formatNumber(average)} ${unit}`, pad, avgY - 6);
}

function drawLineChart(canvas, labels, values, unit) {
  const s = setupCanvas(canvas); if (!s) return;
  const { ctx, width, height } = s;
  const pad = 30, chartW = width - pad*2, chartH = height - pad*2;
  if (!values.length || values.every(v => !v)) { ctx.fillStyle = "rgba(245,245,245,0.68)"; ctx.font = "13px system-ui"; ctx.fillText("Noch keine Daten", pad, height/2); return; }
  const max = Math.max(...values, 1) * 1.2;
  ctx.strokeStyle = "rgba(245,245,245,0.12)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pad + (chartH/4)*i; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width-pad, y); ctx.stroke(); }
  const xFor = i => pad + (chartW*i) / Math.max(values.length-1, 1);
  const yFor = v => pad + chartH - (v/max)*chartH;
  ctx.strokeStyle = "#ffcf8a"; ctx.lineWidth = 2.5; ctx.beginPath();
  values.forEach((v, i) => { if (i === 0) ctx.moveTo(xFor(i), yFor(v)); else ctx.lineTo(xFor(i), yFor(v)); }); ctx.stroke();
  ctx.fillStyle = "#d4a574";
  values.forEach((v, i) => { if (v <= 0) return; ctx.beginPath(); ctx.arc(xFor(i), yFor(v), 3, 0, Math.PI*2); ctx.fill(); });
  ctx.fillStyle = "rgba(245,245,245,0.68)"; ctx.font = "11px system-ui"; ctx.textAlign = "left";
  ctx.fillText(`${formatNumber(max)} ${unit}`, pad, 14);
}

function drawDonut(canvas, items) {
  const s = setupCanvas(canvas); if (!s) return;
  const { ctx, width, height } = s;
  if (!items.length) { ctx.fillStyle = "rgba(245,245,245,0.68)"; ctx.font = "13px system-ui"; ctx.fillText("Noch keine Daten", 24, height/2); return; }
  const total  = items.reduce((s, i) => s + i[1], 0);
  const cx = width/2, cy = height/2, radius = Math.min(width, height) * 0.3;
  const colors = ["#ffcf8a", "#d4a574", "#8b4513", "#b8753a", "#f0b36e", "#6a3514"];
  let start = -Math.PI / 2;
  items.forEach((item, index) => {
    const angle = (item[1]/total) * Math.PI * 2;
    ctx.strokeStyle = colors[index % colors.length]; ctx.lineWidth = 24; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + angle); ctx.stroke(); start += angle;
  });
  ctx.fillStyle = "#f5f5f5"; ctx.font = "700 20px system-ui"; ctx.textAlign = "center";
  ctx.fillText(String(total), cx, cy + 2);
  ctx.fillStyle = "rgba(245,245,245,0.68)"; ctx.font = "11px system-ui"; ctx.fillText("Shots", cx, cy + 20);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x+w, y, x+w, y+h, radius);
  ctx.arcTo(x+w, y+h, x, y+h, radius);
  ctx.arcTo(x, y+h, x, y, radius);
  ctx.arcTo(x, y, x+w, y, radius);
  ctx.closePath();
}

/* ============================================================
   Cleaning Protocol
   ============================================================ */

// Schwellen in Tagen
const CLEANING_THRESHOLDS = {
  klein: { ok: 3,  warn: 7  },   // klein: ok < 3d, warn 3-7d, danach late
  gross: { ok: 14, warn: 30 },   // gross: ok < 14d, warn 14-30d, danach late
};

async function loadCleaningLogs() {
  const { data, error } = await supabaseClient
    .from(TABLE_CLEANING).select("*")
    .order("cleaned_at", { ascending: false });
  if (error) { console.error("Cleaning:", error); state.cleaningLogs = []; return; }
  state.cleaningLogs = data || [];
}

function renderCleaningEquipmentSelect() {
  const cur = el.cleaningEquipment.value;
  const items = state.equipment.filter(i =>
    normalize(i.category).includes("maschine") || normalize(i.category).includes("muhle")
  );
  el.cleaningEquipment.innerHTML = `<option value="">Bitte wählen …</option>`;
  items.forEach(i => {
    const o = document.createElement("option");
    o.value = i.id;
    o.textContent = `${getEquipmentIcon(i.category)} ${equipmentLabel(i)}`;
    el.cleaningEquipment.appendChild(o);
  });
  if (cur) el.cleaningEquipment.value = cur;
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const ms = Date.now() - new Date(`${dateStr}T00:00:00`).getTime();
  return Math.floor(ms / 86400000);
}

function getLastCleaning(equipmentId, type) {
  return state.cleaningLogs.find(c =>
    String(c.equipment_id) === String(equipmentId) && c.cleaning_type === type
  ) || null;
}

function cleaningStatusClass(days, type) {
  const t = CLEANING_THRESHOLDS[type];
  if (days <= t.ok)   return "is-ok";
  if (days <= t.warn) return "is-due";
  return "is-late";
}

function renderCleaning() {
  renderCleaningEquipmentSelect();
  renderCleaningStatus();
  renderCleaningList();
  el.cleaningCount.textContent = `${state.cleaningLogs.length} Einträge`;
}

function renderCleaningStatus() {
  el.cleaningStatus.innerHTML = "";
  const items = state.equipment.filter(i =>
    i.is_active && (normalize(i.category).includes("maschine") || normalize(i.category).includes("muhle"))
  );
  if (!items.length) {
    el.cleaningStatus.innerHTML = `<div class="empty compact">Keine aktiven Geräte vorhanden.</div>`;
    return;
  }
  items.forEach(item => {
    ["klein", "gross"].forEach(type => {
      const last = getLastCleaning(item.id, type);
      const days = last ? daysSince(last.cleaned_at) : Infinity;
      const cls  = last ? cleaningStatusClass(days, type) : "is-late";
      const label= type === "klein" ? "🧴 Klein" : "🧽 Groß";
      const text = last
        ? (days === 0 ? "heute" : days === 1 ? "gestern" : `vor ${days} Tagen`)
        : "noch nie";
      const row = document.createElement("div");
      row.className = `cleaning-status-row ${cls}`;
      row.innerHTML = `
        <div>
          <strong>${escapeHTML(equipmentLabel(item))}</strong>
          <small> · ${label}</small>
        </div>
        <span class="badge">${text}</span>`;
      el.cleaningStatus.appendChild(row);
    });
  });
}

function renderCleaningList() {
  el.cleaningList.innerHTML = "";
  if (!state.cleaningLogs.length) {
    el.cleaningList.innerHTML = `<div class="empty compact">Noch keine Reinigungen protokolliert.</div>`;
    return;
  }
  state.cleaningLogs.slice(0, 30).forEach(log => {
    const item = getEquipmentById(log.equipment_id);
    const name = item ? equipmentLabel(item) : "Unbekanntes Gerät";
    const icon = log.cleaning_type === "klein" ? "🧴" : "🧽";
    const row  = document.createElement("div");
    row.className = "cleaning-item";
    row.innerHTML = `
      <div>
        <strong>${icon} ${escapeHTML(name)}</strong>
        <div class="meta">${formatDateShort(log.cleaned_at)}${log.notes ? " · " + escapeHTML(log.notes) : ""}</div>
      </div>
      <button class="del" type="button" aria-label="Löschen">×</button>`;
    row.querySelector(".del").addEventListener("click", () => deleteCleaning(log.id));
    el.cleaningList.appendChild(row);
  });
}

async function saveCleaning(event) {
  event.preventDefault();
  const equipment_id = el.cleaningEquipment.value;
  if (!equipment_id) {
    setMsg(el.cleaningMessage, "Bitte ein Gerät wählen.", "error");
    return;
  }
  const payload = {
    equipment_id:  Number(equipment_id),
    cleaning_type: el.cleaningType.value,
    cleaned_at:    el.cleaningDate.value || todayISO(),
    notes:         el.cleaningNotes.value.trim() || null,
  };
  setButtonLoading(el.saveCleaningBtn, true, "Speichere ...", "Reinigung speichern");
  const { error } = await supabaseClient.from(TABLE_CLEANING).insert(payload);
  setButtonLoading(el.saveCleaningBtn, false, "Speichere ...", "Reinigung speichern");
  if (error) {
    console.error("Cleaning save:", error);
    setMsg(el.cleaningMessage, `Speichern fehlgeschlagen: ${error.message}`, "error");
    return;
  }
  showToast("Reinigung gespeichert 🧽");
  resetCleaningForm();
  await loadCleaningLogs();
  state.recommendations = buildRecommendations(state.entries);
  renderAll();
  renderCleaning();
}

function resetCleaningForm() {
  el.cleaningEquipment.value = "";
  el.cleaningType.value      = "klein";
  el.cleaningDate.value      = todayISO();
  el.cleaningNotes.value     = "";
  setMsg(el.cleaningMessage, "");
}

async function deleteCleaning(id) {
  if (!window.confirm("Diesen Reinigungseintrag löschen?")) return;
  const { error } = await supabaseClient.from(TABLE_CLEANING).delete().eq("id", id);
  if (error) { console.error(error); showToast("Löschen fehlgeschlagen."); return; }
  showToast("Eintrag gelöscht.");
  await loadCleaningLogs();
  renderCleaning();
}

/* Letzte Reinigung (egal welcher Typ) für eine Mühle */
function getLatestCleaningId(grinderId) {
  if (!grinderId) return null;
  const last = state.cleaningLogs.find(c => String(c.equipment_id) === String(grinderId));
  return last ? last.id : null;
}

/* Letzte GROSSE Reinigung für eine Mühle (zum Filtern der Empfehlungen) */
function getLastBigCleaningDate(grinderId) {
  if (!grinderId) return null;
  const last = state.cleaningLogs.find(c =>
    String(c.equipment_id) === String(grinderId) && c.cleaning_type === "gross"
  );
  return last ? last.cleaned_at : null;
}

/* Ist der Shot nach der letzten großen Reinigung entstanden? */
function isShotAfterLastBigCleaning(entry) {
  if (!entry.grinder_id || !entry.entry_date) return true;
  const cleanDate = getLastBigCleaningDate(entry.grinder_id);
  if (!cleanDate) return true;
  return entry.entry_date >= cleanDate;
}

init();
