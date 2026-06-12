/* ============================================================
   Coffee Tracker – automatische Mahlgrad-Empfehlungen
   GitHub Pages + Supabase
   ============================================================ */

const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const TABLE_ENTRIES = "coffee_entries";
const TABLE_EQUIPMENT = "coffee_equipment";
const TABLE_SETTINGS = "coffee_user_settings";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const state = {
  isLoading: true,
  entries: [],
  equipment: [],
  recommendations: [],
  editingId: null,
  editingEquipmentId: null,
  filters: {
    date: "",
    coffee: "",
  },
  settings: {
    caffeine_limit_mg: 400,
    target_time_min_s: 25,
    target_time_max_s: 30,
    target_pressure_min_bar: 8,
    target_pressure_max_bar: 10,
  },
};

const $ = (id) => document.getElementById(id);

const el = {
  tabs: $("tabs"),
  navToggle: $("navToggle"),
  fabAdd: $("fabAdd"),

  quickCoffeeButtons: $("quickCoffeeButtons"),
  recommendationBox: $("recommendationBox"),
  recommendationTitle: $("recommendationTitle"),
  recommendationText: $("recommendationText"),
  applyRecommendationBtn: $("applyRecommendationBtn"),

  entryForm: $("entryForm"),
  coffeeName: $("coffeeName"),
  coffeeSuggestions: $("coffeeSuggestions"),
  brewMethod: $("brewMethod"),
  machineSelect: $("machineSelect"),
  grinderSelect: $("grinderSelect"),
  entryDate: $("entryDate"),
  entryTime: $("entryTime"),
  doseG: $("doseG"),
  yieldG: $("yieldG"),
  mahlgrad: $("mahlgrad"),
  extractionTime: $("extractionTime"),
  pressureBar: $("pressureBar"),
  temperatureC: $("temperatureC"),
  caffeineMg: $("caffeineMg"),
  rating: $("rating"),
  note: $("note"),

  coffeeError: $("coffeeError"),
  mahlgradError: $("mahlgradError"),
  formError: $("formError"),
  formMessage: $("formMessage"),
  saveEntryBtn: $("saveEntryBtn"),
  duplicateLastBtn: $("duplicateLastBtn"),
  cancelEditBtn: $("cancelEditBtn"),
  resetFormBtn: $("resetFormBtn"),
  editBadge: $("editBadge"),

  recommendationsList: $("recommendationsList"),
  recommendationsCount: $("recommendationsCount"),

  filterDate: $("filterDate"),
  filterCoffee: $("filterCoffee"),
  clearFiltersBtn: $("clearFiltersBtn"),
  deleteAllBtn: $("deleteAllBtn"),
  entriesList: $("entriesList"),
  entriesCount: $("entriesCount"),

  todayCount: $("todayCount"),
  todayCaffeine: $("todayCaffeine"),
  limitText: $("limitText"),
  overLimitHint: $("overLimitHint"),
  avgTime: $("avgTime"),
  hitRate: $("hitRate"),
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
  equipmentCount: $("equipmentCount"),
  equipmentList: $("equipmentList"),
  saveEquipmentBtn: $("saveEquipmentBtn"),
  cancelEquipmentEditBtn: $("cancelEquipmentEditBtn"),
  resetEquipmentBtn: $("resetEquipmentBtn"),

  limitInput: $("limitInput"),
  targetTimeMin: $("targetTimeMin"),
  targetTimeMax: $("targetTimeMax"),
  targetPressureMin: $("targetPressureMin"),
  targetPressureMax: $("targetPressureMax"),
  saveSettingsBtn: $("saveSettingsBtn"),
  settingsMessage: $("settingsMessage"),

  toast: $("toast"),
};


/* ============================================================
   Helper
   ============================================================ */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

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
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatDateHeader(date) {
  const d = new Date(`${date}T00:00:00`);
  const today = todayISO();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  if (date === today) return "Heute";
  if (date === yesterdayISO) return "Gestern";

  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.remove("show");
  }, 2600);
}

function setFormMessage(message, type = "info") {
  el.formMessage.textContent = message || "";
  el.formMessage.style.color = type === "error" ? "var(--danger)" : "var(--accent-light)";
}

function setSettingsMessage(message, type = "info") {
  el.settingsMessage.textContent = message || "";
  el.settingsMessage.style.color = type === "error" ? "var(--danger)" : "var(--accent-light)";
}

function setEquipmentMessage(message, type = "info") {
  el.equipmentMessage.textContent = message || "";
  el.equipmentMessage.style.color = type === "error" ? "var(--danger)" : "var(--accent-light)";
}

function setButtonLoading(button, isLoading, loadingText, defaultText) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
}

function getLastNDays(count) {
  const days = [];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return days;
}

function getPreviousNDays(count, offset) {
  const days = [];

  for (let i = count + offset - 1; i >= offset; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return days;
}

function getMethodIcon(method) {
  const text = normalize(method);

  if (text.includes("espresso")) return "☕";
  if (text.includes("v60") || text.includes("filter")) return "🔻";
  if (text.includes("french")) return "🫙";
  if (text.includes("cold")) return "🧊";
  if (text.includes("cappuccino") || text.includes("latte")) return "🥛";
  return "☕";
}

function getEquipmentIcon(category) {
  const text = normalize(category);

  if (text.includes("maschine")) return "☕";
  if (text.includes("muhle")) return "⚙️";
  if (text.includes("sieb")) return "🧺";
  if (text.includes("waage")) return "⚖️";
  if (text.includes("tamper")) return "⬇️";
  if (text.includes("zubehor")) return "🧰";

  return "🔧";
}

function getEquipmentById(id) {
  if (!id) return null;
  return state.equipment.find((item) => String(item.id) === String(id)) || null;
}

function equipmentName(id) {
  const item = getEquipmentById(id);
  if (!item) return "Keine Mühle";
  return [item.brand, item.model || item.name].filter(Boolean).join(" ");
}

function sumCaffeine(entries) {
  return entries.reduce((sum, entry) => sum + (Number(entry.caffeine_mg) || 0), 0);
}


/* ============================================================
   Init
   ============================================================ */

async function init() {
  initTabs();
  initFormDefaults();
  initEvents();
  renderSkeletons();

  if (!supabaseClient) {
    showToast("Supabase konnte nicht geladen werden.");
    return;
  }

  if (
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes("DEIN_") ||
    SUPABASE_ANON_KEY.includes("...")
  ) {
    setFormMessage("Bitte zuerst deinen kompletten Supabase Publishable Key in app.js eintragen.", "error");
    showToast("Supabase Key fehlt.");
    return;
  }

  await reloadAll();

  setTimeout(() => el.coffeeName?.focus(), 350);
}

function initFormDefaults() {
  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();
  el.doseG.value = "18";
  el.yieldG.value = "36";
  el.caffeineMg.value = "80";
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => openView(tab.dataset.view));
  });

  el.navToggle.addEventListener("click", () => {
    el.tabs.classList.toggle("open");
  });
}

function openView(viewName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });

  const target = $(`view-${viewName}`);
  if (target) target.classList.add("active");

  el.tabs.classList.remove("open");

  if (viewName === "recommendations") renderRecommendations();
  if (viewName === "history") renderEntries();
  if (viewName === "dashboard") renderDashboard();
  if (viewName === "equipment") renderEquipment();
}

function initEvents() {
  el.entryForm.addEventListener("submit", saveEntry);
  el.resetFormBtn.addEventListener("click", resetForm);
  el.cancelEditBtn.addEventListener("click", cancelEdit);
  el.duplicateLastBtn.addEventListener("click", duplicateLastShot);

  el.coffeeName.addEventListener("input", updateCurrentRecommendation);
  el.grinderSelect.addEventListener("change", updateCurrentRecommendation);
  el.brewMethod.addEventListener("change", () => {
    el.caffeineMg.value = methodDefaultCaffeine(el.brewMethod.value);
  });

  el.applyRecommendationBtn.addEventListener("click", applyCurrentRecommendation);

  el.filterDate.addEventListener("change", () => {
    state.filters.date = el.filterDate.value;
    renderEntries();
  });

  el.filterCoffee.addEventListener("change", () => {
    state.filters.coffee = el.filterCoffee.value;
    renderEntries();
  });

  el.clearFiltersBtn.addEventListener("click", () => {
    state.filters.date = "";
    state.filters.coffee = "";
    el.filterDate.value = "";
    el.filterCoffee.value = "";
    renderEntries();
  });

  el.deleteAllBtn.addEventListener("click", deleteAllEntries);

  el.equipmentForm.addEventListener("submit", saveEquipment);
  el.resetEquipmentBtn.addEventListener("click", resetEquipmentForm);
  el.cancelEquipmentEditBtn.addEventListener("click", resetEquipmentForm);

  el.saveSettingsBtn.addEventListener("click", saveSettings);

  el.fabAdd.addEventListener("click", () => {
    cancelEdit();
    openView("add");
    setTimeout(() => el.coffeeName?.focus(), 80);
  });

  window.addEventListener("resize", () => {
    if ($("view-dashboard").classList.contains("active")) {
      renderDashboard();
    }
  });
}


/* ============================================================
   Load
   ============================================================ */

async function reloadAll() {
  state.isLoading = true;
  renderSkeletons();

  await Promise.all([
    loadSettings(),
    loadEntries(),
    loadEquipment(),
  ]);

  state.recommendations = buildRecommendations(state.entries);

  state.isLoading = false;
  renderAll();
}

async function loadSettings() {
  const { data, error } = await supabaseClient
    .from(TABLE_SETTINGS)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Settings konnten nicht geladen werden:", error);
    return;
  }

  if (data) {
    state.settings = {
      caffeine_limit_mg: Number(data.caffeine_limit_mg) || 400,
      target_time_min_s: Number(data.target_time_min_s) || 25,
      target_time_max_s: Number(data.target_time_max_s) || 30,
      target_pressure_min_bar: Number(data.target_pressure_min_bar) || 8,
      target_pressure_max_bar: Number(data.target_pressure_max_bar) || 10,
    };
  }

  el.limitInput.value = state.settings.caffeine_limit_mg;
  el.targetTimeMin.value = state.settings.target_time_min_s;
  el.targetTimeMax.value = state.settings.target_time_max_s;
  el.targetPressureMin.value = state.settings.target_pressure_min_bar;
  el.targetPressureMax.value = state.settings.target_pressure_max_bar;
}

async function loadEntries() {
  const { data, error } = await supabaseClient
    .from(TABLE_ENTRIES)
    .select("*")
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false });

  if (error) {
    console.error("Shots konnten nicht geladen werden:", error);
    showToast("Shots konnten nicht geladen werden.");
    state.entries = [];
    return;
  }

  state.entries = data || [];
}

async function loadEquipment() {
  const { data, error } = await supabaseClient
    .from(TABLE_EQUIPMENT)
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Equipment konnte nicht geladen werden:", error);
    state.equipment = [];
    return;
  }

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
  updateCurrentRecommendation();
}

function renderSkeletons() {
  el.entriesList.innerHTML = `
    <div class="skeleton skeleton-line"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
  `;

  el.recommendationsList.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
  `;

  el.equipmentList.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
  `;
}

function renderEquipmentSelects() {
  const currentMachine = el.machineSelect.value;
  const currentGrinder = el.grinderSelect.value;

  const machines = state.equipment.filter((item) =>
    item.is_active && normalize(item.category).includes("maschine")
  );

  const grinders = state.equipment.filter((item) =>
    item.is_active && normalize(item.category).includes("muhle")
  );

  el.machineSelect.innerHTML = `<option value="">Keine Maschine gewählt</option>`;
  el.grinderSelect.innerHTML = `<option value="">Keine Mühle gewählt</option>`;

  machines.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = equipmentLabel(item);
    el.machineSelect.appendChild(option);
  });

  grinders.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = equipmentLabel(item);
    el.grinderSelect.appendChild(option);
  });

  if (currentMachine) el.machineSelect.value = currentMachine;
  if (currentGrinder) el.grinderSelect.value = currentGrinder;

  if (!el.machineSelect.value && machines.length === 1) {
    el.machineSelect.value = machines[0].id;
  }

  if (!el.grinderSelect.value && grinders.length === 1) {
    el.grinderSelect.value = grinders[0].id;
  }
}

function equipmentLabel(item) {
  return [item.brand, item.model || item.name].filter(Boolean).join(" ");
}

function renderCoffeeSuggestions() {
  const coffees = Array.from(
    new Set(state.entries.map((entry) => entry.drink_name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "de"));

  el.coffeeSuggestions.innerHTML = "";
  el.filterCoffee.innerHTML = `<option value="">Alle Kaffees</option>`;

  coffees.forEach((coffee) => {
    const dataOption = document.createElement("option");
    dataOption.value = coffee;
    el.coffeeSuggestions.appendChild(dataOption);

    const filterOption = document.createElement("option");
    filterOption.value = coffee;
    filterOption.textContent = coffee;
    el.filterCoffee.appendChild(filterOption);
  });

  el.filterCoffee.value = state.filters.coffee;
}

function renderQuickCoffeeButtons() {
  el.quickCoffeeButtons.innerHTML = "";

  const top = getTopCoffeeNames().slice(0, 6);

  if (!top.length) {
    el.quickCoffeeButtons.innerHTML = `
      <div class="empty full">Noch keine Kaffees getrackt. Nach ein paar Shots erscheinen hier Schnellbuttons.</div>
    `;
    return;
  }

  top.forEach(({ name, count }) => {
    const rec = findRecommendation(name, el.grinderSelect.value);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick-btn";
    btn.innerHTML = `
      <span>☕</span>
      <strong>${escapeHTML(name)}</strong>
      <small>${count} Shots${rec ? ` · MG ${formatNumber(rec.best_grind, 1)}` : ""}</small>
    `;

    btn.addEventListener("click", () => {
      el.coffeeName.value = name;
      updateCurrentRecommendation();
      openView("add");
    });

    el.quickCoffeeButtons.appendChild(btn);
  });
}

function getTopCoffeeNames() {
  const map = new Map();

  state.entries.forEach((entry) => {
    if (!entry.drink_name) return;
    map.set(entry.drink_name, (map.get(entry.drink_name) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}


/* ============================================================
   Recommendations
   ============================================================ */

function scoreShot(entry) {
  const rating = Number(entry.rating);
  const time = Number(entry.extraction_time_s);
  const pressure = Number(entry.pressure_bar);

  const minTime = Number(state.settings.target_time_min_s);
  const maxTime = Number(state.settings.target_time_max_s);
  const targetTime = (minTime + maxTime) / 2;

  const minPressure = Number(state.settings.target_pressure_min_bar);
  const maxPressure = Number(state.settings.target_pressure_max_bar);
  const targetPressure = (minPressure + maxPressure) / 2;

  let score = 0;

  if (Number.isFinite(rating)) {
    score += (rating / 5) * 55;
  } else {
    score += 18;
  }

  if (Number.isFinite(time)) {
    const distance = Math.abs(time - targetTime);
    score += Math.max(0, 25 - distance * 3.2);
  }

  if (Number.isFinite(pressure)) {
    const distance = Math.abs(pressure - targetPressure);
    score += Math.max(0, 14 - distance * 4);
  }

  if (entry.entry_date) {
    const ageDays = (Date.now() - new Date(`${entry.entry_date}T00:00:00`).getTime()) / 86400000;
    score += Math.max(0, 6 - ageDays * 0.08);
  }

  return Math.round(score);
}

function isShotInTarget(entry) {
  const time = Number(entry.extraction_time_s);
  const pressure = Number(entry.pressure_bar);

  const timeOk =
    Number.isFinite(time) &&
    time >= Number(state.settings.target_time_min_s) &&
    time <= Number(state.settings.target_time_max_s);

  const pressureOk =
    !Number.isFinite(pressure) ||
    (
      pressure >= Number(state.settings.target_pressure_min_bar) &&
      pressure <= Number(state.settings.target_pressure_max_bar)
    );

  return timeOk && pressureOk;
}

function recommendationKey(entry) {
  return `${normalize(entry.drink_name)}__${entry.grinder_id || "no-grinder"}`;
}

function buildRecommendations(entries) {
  const groups = new Map();

  entries
    .filter((entry) => entry.drink_name && entry.mahlgrad !== null && entry.mahlgrad !== undefined)
    .forEach((entry) => {
      const key = recommendationKey(entry);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });

  return Array.from(groups.values())
    .map(buildRecommendationFromGroup)
    .sort((a, b) => b.score - a.score);
}

function buildRecommendationFromGroup(group) {
  const sorted = [...group].sort((a, b) => scoreShot(b) - scoreShot(a));
  const best = sorted[0];

  const goodShots = group.filter((entry) => scoreShot(entry) >= 75 || isShotInTarget(entry));
  const baseShots = goodShots.length ? goodShots : [best];

  const grinds = baseShots
    .map((entry) => Number(entry.mahlgrad))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const times = group.map((entry) => Number(entry.extraction_time_s)).filter(Number.isFinite);
  const pressures = group.map((entry) => Number(entry.pressure_bar)).filter(Number.isFinite);
  const ratings = group.map((entry) => Number(entry.rating)).filter(Number.isFinite);

  const avg = (arr) => {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  const confidence =
    group.length >= 6 ? "stabil" :
    group.length >= 3 ? "vorläufig" :
    "erster Richtwert";

  const hitCount = group.filter(isShotInTarget).length;

  return {
    coffee_name: best.drink_name,
    grinder_id: best.grinder_id || null,
    grinder_name: equipmentName(best.grinder_id),
    best_grind: Number(best.mahlgrad),
    grind_min: grinds[0],
    grind_max: grinds[grinds.length - 1],
    best_entry: best,
    shots_count: group.length,
    good_count: goodShots.length,
    hit_count: hitCount,
    avg_time: avg(times),
    avg_pressure: avg(pressures),
    avg_rating: avg(ratings),
    score: scoreShot(best),
    confidence,
    hint: buildGrindHint(best),
  };
}

function buildGrindHint(entry) {
  const time = Number(entry.extraction_time_s);
  const pressure = Number(entry.pressure_bar);

  if (!Number.isFinite(time)) {
    return "Noch keine Zeitbewertung möglich. Beim nächsten Shot Extraktionszeit eintragen.";
  }

  if (time < Number(state.settings.target_time_min_s)) {
    return "Der beste bekannte Shot lief eher zu schnell. Beim nächsten Versuch tendenziell etwas feiner mahlen.";
  }

  if (time > Number(state.settings.target_time_max_s)) {
    return "Der beste bekannte Shot lief eher zu langsam. Beim nächsten Versuch tendenziell etwas gröber mahlen.";
  }

  if (Number.isFinite(pressure) && pressure < Number(state.settings.target_pressure_min_bar)) {
    return "Zeit passt, Druck eher niedrig. Puck Prep prüfen oder minimal feiner mahlen.";
  }

  if (Number.isFinite(pressure) && pressure > Number(state.settings.target_pressure_max_bar)) {
    return "Zeit passt, Druck eher hoch. Puck Prep prüfen oder minimal gröber mahlen.";
  }

  return "Sehr guter Bereich. Mahlgrad erstmal beibehalten.";
}

function findRecommendation(coffeeName, grinderId) {
  const normalizedCoffee = normalize(coffeeName);
  const exact = state.recommendations.find((rec) =>
    normalize(rec.coffee_name) === normalizedCoffee &&
    String(rec.grinder_id || "") === String(grinderId || "")
  );

  if (exact) return exact;

  return state.recommendations.find((rec) =>
    normalize(rec.coffee_name) === normalizedCoffee
  ) || null;
}

function updateCurrentRecommendation() {
  const coffeeName = el.coffeeName.value.trim();
  const grinderId = el.grinderSelect.value;

  if (!coffeeName) {
    el.recommendationBox.classList.add("hidden");
    return;
  }

  const rec = findRecommendation(coffeeName, grinderId);

  if (!rec) {
    el.recommendationBox.classList.remove("hidden");
    el.recommendationTitle.textContent = "Noch keine Empfehlung";
    el.recommendationText.textContent = "Für diesen Kaffee gibt es noch keinen gespeicherten Shot mit Mahlgrad.";
    el.applyRecommendationBtn.classList.add("hidden");
    return;
  }

  el.recommendationBox.classList.remove("hidden");
  el.applyRecommendationBtn.classList.remove("hidden");

  const range =
    rec.grind_min !== rec.grind_max
      ? `Bereich ${formatNumber(rec.grind_min, 1)}–${formatNumber(rec.grind_max, 1)}`
      : `Mahlgrad ${formatNumber(rec.best_grind, 1)}`;

  el.recommendationTitle.textContent = `Empfehlung: ${range}`;

  el.recommendationText.textContent =
    `${rec.coffee_name} · ${rec.grinder_name} · ${rec.shots_count} Shots · ` +
    `${rec.confidence} · Ø ${formatNumber(rec.avg_time, 1)}s · Score ${rec.score}. ${rec.hint}`;
}

function applyCurrentRecommendation() {
  const rec = findRecommendation(el.coffeeName.value.trim(), el.grinderSelect.value);

  if (!rec) return;

  el.mahlgrad.value = rec.best_grind ?? "";
  el.doseG.value = rec.best_entry.dose_g ?? "18";
  el.yieldG.value = rec.best_entry.yield_g ?? "36";
  el.pressureBar.value = rec.best_entry.pressure_bar ?? "";
  el.temperatureC.value = rec.best_entry.temperature_c ?? "";

  setFormMessage("Empfehlung übernommen.");
}

function renderRecommendations() {
  el.recommendationsCount.textContent = `${state.recommendations.length} Empfehlungen`;
  el.recommendationsList.innerHTML = "";

  if (!state.recommendations.length) {
    el.recommendationsList.innerHTML = `
      <div class="empty">
        Noch keine Empfehlungen vorhanden. Speichere ein paar Shots mit Kaffee, Mühle, Mahlgrad und Bewertung.
      </div>
    `;
    return;
  }

  state.recommendations.forEach((rec) => {
    const card = document.createElement("article");
    card.className = `recommendation-card ${confidenceClass(rec.confidence)}`;

    const range =
      rec.grind_min !== rec.grind_max
        ? `${formatNumber(rec.grind_min, 1)}–${formatNumber(rec.grind_max, 1)}`
        : `${formatNumber(rec.best_grind, 1)}`;

    card.innerHTML = `
      <div class="recommendation-top">
        <div>
          <h3>${escapeHTML(rec.coffee_name)}</h3>
          <p>${escapeHTML(rec.grinder_name)} · ${rec.shots_count} Shots · ${rec.confidence}</p>
        </div>
        <div class="grind-badge">
          <span>MG</span>
          <strong>${range}</strong>
        </div>
      </div>

      <div class="entry-meta recommendation-meta">
        <span>⭐ Ø ${formatNumber(rec.avg_rating, 1)}/5</span>
        <span>⏱️ Ø ${formatNumber(rec.avg_time, 1)}s</span>
        <span>🧭 Ø ${formatNumber(rec.avg_pressure, 1)} Bar</span>
        <span>🎯 ${rec.hit_count}/${rec.shots_count} Treffer</span>
        <span>Score ${rec.score}</span>
      </div>

      <p>${escapeHTML(rec.hint)}</p>

      <div class="actions compact-actions">
        <button class="primary use-rec-btn" type="button">Für neuen Shot nutzen</button>
      </div>
    `;

    card.querySelector(".use-rec-btn").addEventListener("click", () => {
      resetForm();
      el.coffeeName.value = rec.coffee_name;
      el.grinderSelect.value = rec.grinder_id || "";
      applyRecommendationFromObject(rec);
      openView("add");
    });

    el.recommendationsList.appendChild(card);
  });
}

function applyRecommendationFromObject(rec) {
  el.mahlgrad.value = rec.best_grind ?? "";
  el.doseG.value = rec.best_entry.dose_g ?? "18";
  el.yieldG.value = rec.best_entry.yield_g ?? "36";
  el.pressureBar.value = rec.best_entry.pressure_bar ?? "";
  el.temperatureC.value = rec.best_entry.temperature_c ?? "";
  updateCurrentRecommendation();
}

function confidenceClass(confidence) {
  if (confidence === "stabil") return "confidence-high";
  if (confidence === "vorläufig") return "confidence-mid";
  return "confidence-low";
}


/* ============================================================
   Shot Form
   ============================================================ */

function methodDefaultCaffeine(method) {
  const text = normalize(method);

  if (text.includes("doppel")) return 120;
  if (text.includes("espresso")) return 80;
  if (text.includes("v60")) return 120;
  if (text.includes("french")) return 110;
  if (text.includes("cold")) return 150;
  return 95;
}

function readEntryForm() {
  const rawTime = el.entryTime.value || nowTime();

  return {
    entry_date: el.entryDate.value || todayISO(),
    entry_time: rawTime.length === 5 ? `${rawTime}:00` : rawTime,

    drink_name: el.coffeeName.value.trim(),
    drink_type: el.brewMethod.value,
    emoji: getMethodIcon(el.brewMethod.value),

    amount_ml: toNumber(el.yieldG.value),
    caffeine_mg: toNumber(el.caffeineMg.value),

    dose_g: toNumber(el.doseG.value),
    yield_g: toNumber(el.yieldG.value),

    mahlgrad: toNumber(el.mahlgrad.value),
    extraction_time_s: toNumber(el.extractionTime.value),
    pressure_bar: toNumber(el.pressureBar.value),
    temperature_c: toNumber(el.temperatureC.value),

    rating: toNumber(el.rating.value),
    note: el.note.value.trim() || null,

    machine_id: el.machineSelect.value ? Number(el.machineSelect.value) : null,
    grinder_id: el.grinderSelect.value ? Number(el.grinderSelect.value) : null,
  };
}

function validateEntryForm() {
  const entry = readEntryForm();

  el.coffeeError.textContent = "";
  el.mahlgradError.textContent = "";
  el.formError.textContent = "";

  let valid = true;

  if (!entry.drink_name) {
    el.coffeeError.textContent = "Bitte Kaffee oder Bohne eintragen.";
    valid = false;
  }

  if (entry.mahlgrad === null) {
    el.mahlgradError.textContent = "Bitte Mahlgrad eintragen.";
    valid = false;
  }

  return valid;
}

async function saveEntry(event) {
  event.preventDefault();

  if (!validateEntryForm()) return;

  const payload = readEntryForm();
  const isEditing = Boolean(state.editingId);
  const defaultText = isEditing ? "Änderung speichern" : "Shot speichern ☕";

  setButtonLoading(el.saveEntryBtn, true, "Speichere ...", defaultText);

  let response;

  if (isEditing) {
    response = await supabaseClient
      .from(TABLE_ENTRIES)
      .update(payload)
      .eq("id", state.editingId)
      .select()
      .single();
  } else {
    response = await supabaseClient
      .from(TABLE_ENTRIES)
      .insert(payload)
      .select()
      .single();
  }

  setButtonLoading(el.saveEntryBtn, false, "Speichere ...", defaultText);

  if (response.error) {
    console.error("Shot konnte nicht gespeichert werden:", response.error);
    setFormMessage(`Speichern fehlgeschlagen: ${response.error.message}`, "error");
    return;
  }

  await loadEntries();
  state.recommendations = buildRecommendations(state.entries);

  const rec = findRecommendation(payload.drink_name, payload.grinder_id);

  resetForm();
  renderAll();

  showToast(isEditing ? "Shot aktualisiert ☕" : "Shot gespeichert ☕");

  if (rec) {
    setFormMessage(`Aktuelle Empfehlung für ${payload.drink_name}: Mahlgrad ${formatNumber(rec.best_grind, 1)}.`);
  }

  openView("recommendations");
}

function resetForm() {
  state.editingId = null;

  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();
  el.coffeeName.value = "";
  el.brewMethod.value = "Espresso";
  el.doseG.value = "18";
  el.yieldG.value = "36";
  el.mahlgrad.value = "";
  el.extractionTime.value = "";
  el.pressureBar.value = "";
  el.temperatureC.value = "";
  el.caffeineMg.value = "80";
  el.rating.value = "";
  el.note.value = "";

  el.coffeeError.textContent = "";
  el.mahlgradError.textContent = "";
  el.formError.textContent = "";
  setFormMessage("");

  el.saveEntryBtn.textContent = "Shot speichern ☕";
  el.cancelEditBtn.classList.add("hidden");
  el.editBadge.classList.add("hidden");

  renderEquipmentSelects();
  updateCurrentRecommendation();
}

function cancelEdit() {
  resetForm();
}

function startEdit(entry) {
  state.editingId = entry.id;

  el.entryDate.value = entry.entry_date || todayISO();
  el.entryTime.value = formatEntryTime(entry.entry_time);
  el.coffeeName.value = entry.drink_name || "";
  el.brewMethod.value = entry.drink_type || "Espresso";
  el.machineSelect.value = entry.machine_id || "";
  el.grinderSelect.value = entry.grinder_id || "";
  el.doseG.value = entry.dose_g ?? "18";
  el.yieldG.value = entry.yield_g ?? "36";
  el.mahlgrad.value = entry.mahlgrad ?? "";
  el.extractionTime.value = entry.extraction_time_s ?? "";
  el.pressureBar.value = entry.pressure_bar ?? "";
  el.temperatureC.value = entry.temperature_c ?? "";
  el.caffeineMg.value = entry.caffeine_mg ?? "80";
  el.rating.value = entry.rating ?? "";
  el.note.value = entry.note || "";

  el.saveEntryBtn.textContent = "Änderung speichern";
  el.cancelEditBtn.classList.remove("hidden");
  el.editBadge.classList.remove("hidden");

  setFormMessage("Du bearbeitest gerade einen bestehenden Shot.");
  updateCurrentRecommendation();
  openView("add");
}

function duplicateLastShot() {
  const last = state.entries[0];

  if (!last) {
    showToast("Noch kein Shot zum Duplizieren vorhanden.");
    return;
  }

  state.editingId = null;

  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();
  el.coffeeName.value = last.drink_name || "";
  el.brewMethod.value = last.drink_type || "Espresso";
  el.machineSelect.value = last.machine_id || "";
  el.grinderSelect.value = last.grinder_id || "";
  el.doseG.value = last.dose_g ?? "18";
  el.yieldG.value = last.yield_g ?? "36";
  el.mahlgrad.value = last.mahlgrad ?? "";
  el.extractionTime.value = "";
  el.pressureBar.value = last.pressure_bar ?? "";
  el.temperatureC.value = last.temperature_c ?? "";
  el.caffeineMg.value = last.caffeine_mg ?? "80";
  el.rating.value = "";
  el.note.value = "";

  setFormMessage("Letzter Shot wurde als Vorlage übernommen.");
  updateCurrentRecommendation();
}


/* ============================================================
   History
   ============================================================ */

function getFilteredEntries() {
  return state.entries.filter((entry) => {
    const dateMatches = !state.filters.date || entry.entry_date === state.filters.date;
    const coffeeMatches = !state.filters.coffee || entry.drink_name === state.filters.coffee;
    return dateMatches && coffeeMatches;
  });
}

function renderEntries() {
  const entries = getFilteredEntries();

  el.entriesCount.textContent = `${entries.length} Shots`;
  el.entriesList.innerHTML = "";

  if (!entries.length) {
    el.entriesList.innerHTML = `<div class="empty">Noch keine passenden Shots vorhanden.</div>`;
    return;
  }

  const groups = new Map();

  entries.forEach((entry) => {
    const key = entry.entry_date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  groups.forEach((dayEntries, day) => {
    const group = document.createElement("section");
    group.className = "day-group";

    group.innerHTML = `
      <div class="day-head">
        <h3>${escapeHTML(formatDateHeader(day))}</h3>
        <span>${dayEntries.length} Shots</span>
      </div>
    `;

    dayEntries.forEach((entry) => {
      const score = scoreShot(entry);
      const card = document.createElement("article");
      card.className = `entry-card compact ${scoreClass(score)}`;
      card.tabIndex = 0;

      card.innerHTML = `
        <div class="swipe-hint left">Bearbeiten</div>
        <div class="swipe-hint right">Löschen</div>

        <div class="entry-main">
          <div class="entry-icon">${escapeHTML(getMethodIcon(entry.drink_type))}</div>

          <div class="entry-content">
            <div class="entry-title-row">
              <strong>${escapeHTML(entry.drink_name)}</strong>
              <span>${escapeHTML(formatEntryTime(entry.entry_time))}</span>
            </div>

            <div class="entry-meta compact-meta">
              <span>⚙️ MG ${formatNumber(entry.mahlgrad, 1)}</span>
              <span>⏱️ ${formatNumber(entry.extraction_time_s, 1)}s</span>
              <span>🧭 ${formatNumber(entry.pressure_bar, 1)} Bar</span>
              <span>⚖️ ${formatNumber(entry.dose_g, 1)}g → ${formatNumber(entry.yield_g, 1)}g</span>
              <span>⭐ ${entry.rating || "–"}/5</span>
              <span>Score ${score}</span>
            </div>

            <div class="entry-meta secondary-meta">
              <span>${escapeHTML(equipmentName(entry.grinder_id))}</span>
              <span>${escapeHTML(entry.drink_type || "Espresso")}</span>
            </div>

            ${entry.note ? `<p>${escapeHTML(entry.note)}</p>` : ""}
          </div>
        </div>

        <button class="delete-entry" type="button" aria-label="Shot löschen">×</button>
      `;

      card.addEventListener("click", () => {
        if (card.dataset.swiped === "true") return;
        startEdit(entry);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter") startEdit(entry);
      });

      card.querySelector(".delete-entry").addEventListener("click", async (event) => {
        event.stopPropagation();
        await deleteEntry(entry.id);
      });

      enableSwipeActions(card, entry);

      group.appendChild(card);
    });

    el.entriesList.appendChild(group);
  });
}

function scoreClass(score) {
  if (score >= 80) return "rating-good";
  if (score >= 60) return "rating-mid";
  return "rating-bad";
}

function enableSwipeActions(card, entry) {
  let startX = 0;
  let currentX = 0;
  let dragging = false;

  card.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;

    startX = event.clientX;
    currentX = startX;
    dragging = true;
    card.dataset.swiped = "false";
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    currentX = event.clientX;
    const dx = currentX - startX;

    if (Math.abs(dx) > 8) {
      card.style.transform = `translateX(${Math.max(Math.min(dx, 90), -90)}px)`;
      card.classList.toggle("swiping-edit", dx > 30);
      card.classList.toggle("swiping-delete", dx < -30);
    }
  });

  card.addEventListener("pointerup", async () => {
    if (!dragging) return;

    dragging = false;
    const dx = currentX - startX;

    card.style.transform = "";
    card.classList.remove("swiping-edit", "swiping-delete");

    if (dx > 82) {
      card.dataset.swiped = "true";
      startEdit(entry);
      return;
    }

    if (dx < -82) {
      card.dataset.swiped = "true";
      await deleteEntry(entry.id);
      return;
    }

    setTimeout(() => {
      card.dataset.swiped = "false";
    }, 80);
  });
}

async function deleteEntry(id) {
  const confirmed = window.confirm("Diesen Shot wirklich löschen?");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from(TABLE_ENTRIES)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Shot konnte nicht gelöscht werden:", error);
    showToast("Löschen fehlgeschlagen.");
    return;
  }

  showToast("Shot gelöscht.");
  await loadEntries();
  renderAll();
}

async function deleteAllEntries() {
  const firstConfirm = window.confirm("Wirklich ALLE Shots löschen?");
  if (!firstConfirm) return;

  const secondConfirm = window.prompt('Zur Sicherheit bitte "ALLE LÖSCHEN" eingeben:');

  if (secondConfirm !== "ALLE LÖSCHEN") {
    showToast("Löschen abgebrochen.");
    return;
  }

  const { error } = await supabaseClient
    .from(TABLE_ENTRIES)
    .delete()
    .neq("id", 0);

  if (error) {
    console.error("Alle Shots konnten nicht gelöscht werden:", error);
    showToast("Löschen fehlgeschlagen.");
    return;
  }

  showToast("Alle Shots gelöscht.");
  await loadEntries();
  renderAll();
}


/* ============================================================
   Dashboard
   ============================================================ */

function renderDashboard() {
  const today = todayISO();
  const todayEntries = state.entries.filter((entry) => entry.entry_date === today);
  const todayCaffeine = sumCaffeine(todayEntries);
  const limit = Number(state.settings.caffeine_limit_mg) || 400;

  el.todayCount.textContent = String(todayEntries.length);
  el.todayCaffeine.textContent = `${formatNumber(todayCaffeine)} mg`;
  el.limitText.textContent = `Limit: ${formatNumber(limit)} mg`;

  const times = state.entries.map((entry) => Number(entry.extraction_time_s)).filter(Number.isFinite);
  const avgTime = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  el.avgTime.textContent = avgTime === null ? "–" : `${formatNumber(avgTime, 1)}s`;

  const targetShots = state.entries.filter((entry) => Number.isFinite(Number(entry.extraction_time_s)));
  const hits = targetShots.filter(isShotInTarget).length;
  el.hitRate.textContent = targetShots.length ? `${formatNumber((hits / targetShots.length) * 100)}%` : "–";

  if (todayCaffeine > limit) {
    el.overLimitHint.textContent = `Tageslimit überschritten: ${formatNumber(todayCaffeine)} mg von ${formatNumber(limit)} mg.`;
    el.overLimitHint.classList.remove("hidden");
  } else {
    el.overLimitHint.classList.add("hidden");
  }

  renderWeekCanvas();
  renderTrendCanvas();
  renderCoffeeRanking();
  renderTopShots();
  renderMethodDistribution();
  renderHeatmap();
}

function renderWeekCanvas() {
  const days = getLastNDays(7);
  const values = days.map((day) =>
    sumCaffeine(state.entries.filter((entry) => entry.entry_date === day))
  );

  const average = values.reduce((a, b) => a + b, 0) / 7;
  const previousDays = getPreviousNDays(7, 7);
  const previousTotal = previousDays.reduce((sum, day) => {
    return sum + sumCaffeine(state.entries.filter((entry) => entry.entry_date === day));
  }, 0);

  const currentTotal = values.reduce((a, b) => a + b, 0);

  if (previousTotal > 0) {
    const diff = ((currentTotal - previousTotal) / previousTotal) * 100;
    el.weekCompare.textContent = `${diff >= 0 ? "+" : ""}${formatNumber(diff)}% zur Vorwoche`;
  } else {
    el.weekCompare.textContent = "Keine Vorwoche";
  }

  const labels = days.map((day) =>
    new Date(`${day}T00:00:00`).toLocaleDateString("de-DE", { weekday: "short" })
  );

  drawBarWithAverage(el.weekCanvas, labels, values, average, "mg");
}

function renderTrendCanvas() {
  const shots = [...state.entries]
    .filter((entry) => Number.isFinite(Number(entry.extraction_time_s)))
    .sort((a, b) => {
      const aa = `${a.entry_date || ""} ${a.entry_time || ""}`;
      const bb = `${b.entry_date || ""} ${b.entry_time || ""}`;
      return aa.localeCompare(bb);
    })
    .slice(-30);

  const values = shots.map((entry) => Number(entry.extraction_time_s));
  const labels = shots.map((_, index) => String(index + 1));

  if (values.length >= 4) {
    const first = values.slice(0, Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(values.length / 2);
    const second = values.slice(Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / (values.length - Math.floor(values.length / 2));

    let trend = "stabil";
    if (second > first + 2) trend = "langsamer";
    if (second < first - 2) trend = "schneller";
    el.trendBadge.textContent = trend;
  } else {
    el.trendBadge.textContent = "zu wenig Daten";
  }

  drawLineChart(el.trendCanvas, labels, values, "s");
}

function renderCoffeeRanking() {
  el.coffeeRanking.innerHTML = "";

  const top = getTopCoffeeNames().slice(0, 6);

  if (!top.length) {
    el.coffeeRanking.innerHTML = `<div class="empty compact">Noch keine Daten.</div>`;
    return;
  }

  const max = Math.max(...top.map((item) => item.count));

  top.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <div>
        <strong>${escapeHTML(item.name)}</strong>
        <div class="mini-track">
          <div class="mini-fill" style="width:${(item.count / max) * 100}%"></div>
        </div>
      </div>
      <span>${item.count}x</span>
    `;

    el.coffeeRanking.appendChild(row);
  });
}

function renderTopShots() {
  el.topShots.innerHTML = "";

  const shots = [...state.entries]
    .filter((entry) => entry.mahlgrad !== null && entry.mahlgrad !== undefined)
    .sort((a, b) => scoreShot(b) - scoreShot(a))
    .slice(0, 5);

  if (!shots.length) {
    el.topShots.innerHTML = `<div class="empty compact">Noch keine Shots mit Score.</div>`;
    return;
  }

  shots.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <div>
        <strong>${escapeHTML(entry.drink_name)}</strong>
        <small>MG ${formatNumber(entry.mahlgrad, 1)} · ${formatNumber(entry.extraction_time_s, 1)}s · ${entry.rating || "–"}/5</small>
      </div>
      <span>Score ${scoreShot(entry)}</span>
    `;

    el.topShots.appendChild(row);
  });
}

function renderMethodDistribution() {
  const map = new Map();

  state.entries.forEach((entry) => {
    const method = entry.drink_type || "Espresso";
    map.set(method, (map.get(method) || 0) + 1);
  });

  const items = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);

  drawDonut(el.methodCanvas, items);

  el.methodBars.innerHTML = "";

  if (!items.length) {
    el.methodBars.innerHTML = `<div class="empty compact">Noch keine Methoden-Daten.</div>`;
    return;
  }

  const max = Math.max(...items.map((item) => item[1]));

  items.slice(0, 6).forEach(([method, count]) => {
    const row = document.createElement("div");
    row.className = "method-row";
    row.innerHTML = `
      <span>${escapeHTML(getMethodIcon(method))}</span>
      <strong>${escapeHTML(method)}</strong>
      <div class="mini-track">
        <div class="mini-fill" style="width:${(count / max) * 100}%"></div>
      </div>
      <small>${count}x</small>
    `;

    el.methodBars.appendChild(row);
  });
}

function renderHeatmap() {
  el.heatmap.innerHTML = "";

  const hours = [];
  for (let h = 5; h <= 23; h++) hours.push(h);

  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const matrix = new Map();

  state.entries.forEach((entry) => {
    const d = new Date(`${entry.entry_date}T00:00:00`);
    const weekday = (d.getDay() + 6) % 7;
    const hour = Number(String(entry.entry_time || "00:00").slice(0, 2));

    if (hour >= 5 && hour <= 23) {
      const key = `${weekday}-${hour}`;
      matrix.set(key, (matrix.get(key) || 0) + 1);
    }
  });

  const max = Math.max(1, ...matrix.values());
  const top = Array.from(matrix.entries()).sort((a, b) => b[1] - a[1])[0];

  if (top) {
    const [key] = top;
    const [weekday, hour] = key.split("-").map(Number);
    el.peakHour.textContent = `${weekdays[weekday]} ${String(hour).padStart(2, "0")}:00`;
  } else {
    el.peakHour.textContent = "–";
  }

  const topLeft = document.createElement("div");
  topLeft.className = "heatmap-label";
  el.heatmap.appendChild(topLeft);

  hours.forEach((hour) => {
    const cell = document.createElement("div");
    cell.className = "heatmap-label hour-label";
    cell.textContent = String(hour);
    el.heatmap.appendChild(cell);
  });

  weekdays.forEach((weekdayLabel, weekdayIndex) => {
    const label = document.createElement("div");
    label.className = "heatmap-label";
    label.textContent = weekdayLabel;
    el.heatmap.appendChild(label);

    hours.forEach((hour) => {
      const count = matrix.get(`${weekdayIndex}-${hour}`) || 0;
      const intensity = count / max;

      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.title = `${weekdayLabel} ${hour}:00 – ${count} Shots`;
      cell.style.opacity = count ? String(0.22 + intensity * 0.78) : "0.12";

      el.heatmap.appendChild(cell);
    });
  });
}


/* ============================================================
   Equipment
   ============================================================ */

function readEquipmentForm() {
  return {
    category: el.equipmentCategory.value || "Sonstiges",
    name: el.equipmentName.value.trim(),
    brand: el.equipmentBrand.value.trim() || null,
    model: el.equipmentModel.value.trim() || null,
    purchase_date: el.equipmentPurchaseDate.value || null,
    price_eur: toNumber(el.equipmentPrice.value),
    facts: el.equipmentFacts.value.trim() || null,
    notes: el.equipmentNotes.value.trim() || null,
    is_active: Boolean(el.equipmentActive.checked),
    updated_at: new Date().toISOString(),
  };
}

async function saveEquipment(event) {
  event.preventDefault();

  const payload = readEquipmentForm();

  if (!payload.name) {
    setEquipmentMessage("Bitte mindestens einen Namen eintragen.", "error");
    return;
  }

  const isEditing = Boolean(state.editingEquipmentId);
  const defaultText = isEditing ? "Änderung speichern" : "Equipment speichern";

  setButtonLoading(el.saveEquipmentBtn, true, "Speichere ...", defaultText);

  let response;

  if (isEditing) {
    response = await supabaseClient
      .from(TABLE_EQUIPMENT)
      .update(payload)
      .eq("id", state.editingEquipmentId)
      .select()
      .single();
  } else {
    response = await supabaseClient
      .from(TABLE_EQUIPMENT)
      .insert(payload)
      .select()
      .single();
  }

  setButtonLoading(el.saveEquipmentBtn, false, "Speichere ...", defaultText);

  if (response.error) {
    console.error("Equipment konnte nicht gespeichert werden:", response.error);
    setEquipmentMessage(`Speichern fehlgeschlagen: ${response.error.message}`, "error");
    return;
  }

  showToast(isEditing ? "Equipment aktualisiert." : "Equipment gespeichert.");
  resetEquipmentForm();

  await loadEquipment();
  renderAll();
}

function renderEquipment() {
  el.equipmentCount.textContent = `${state.equipment.length} Geräte`;
  el.equipmentList.innerHTML = "";

  if (!state.equipment.length) {
    el.equipmentList.innerHTML = `<div class="empty">Noch kein Equipment hinterlegt.</div>`;
    return;
  }

  const grouped = new Map();

  state.equipment.forEach((item) => {
    const category = item.category || "Sonstiges";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(item);
  });

  grouped.forEach((items, category) => {
    const group = document.createElement("section");
    group.className = "equipment-group";

    group.innerHTML = `
      <div class="day-head">
        <h3>${escapeHTML(getEquipmentIcon(category))} ${escapeHTML(category)}</h3>
        <span>${items.length}</span>
      </div>
    `;

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = `equipment-card ${item.is_active ? "active-equipment" : "inactive-equipment"}`;

      card.innerHTML = `
        <div class="equipment-main">
          <div class="equipment-icon">${escapeHTML(getEquipmentIcon(item.category))}</div>

          <div class="equipment-content">
            <div class="equipment-title-row">
              <strong>${escapeHTML(item.name)}</strong>
              <span>${item.is_active ? "Aktiv" : "Inaktiv"}</span>
            </div>

            <div class="entry-meta compact-meta">
              ${item.brand ? `<span>${escapeHTML(item.brand)}</span>` : ""}
              ${item.model ? `<span>${escapeHTML(item.model)}</span>` : ""}
              ${item.purchase_date ? `<span>Gekauft: ${formatDateShort(item.purchase_date)}</span>` : ""}
              ${item.price_eur !== null && item.price_eur !== undefined ? `<span>${formatNumber(item.price_eur, 2)} €</span>` : ""}
            </div>

            ${item.facts ? `<p><strong>Fakten:</strong> ${escapeHTML(item.facts)}</p>` : ""}
            ${item.notes ? `<p><strong>Notiz:</strong> ${escapeHTML(item.notes)}</p>` : ""}
          </div>
        </div>

        <button class="delete-equipment" type="button" aria-label="Equipment löschen">×</button>
      `;

      card.addEventListener("click", () => startEditEquipment(item));

      card.querySelector(".delete-equipment").addEventListener("click", async (event) => {
        event.stopPropagation();
        await deleteEquipment(item.id);
      });

      group.appendChild(card);
    });

    el.equipmentList.appendChild(group);
  });
}

function startEditEquipment(item) {
  state.editingEquipmentId = item.id;

  el.equipmentCategory.value = item.category || "Sonstiges";
  el.equipmentName.value = item.name || "";
  el.equipmentBrand.value = item.brand || "";
  el.equipmentModel.value = item.model || "";
  el.equipmentPurchaseDate.value = item.purchase_date || "";
  el.equipmentPrice.value = item.price_eur ?? "";
  el.equipmentFacts.value = item.facts || "";
  el.equipmentNotes.value = item.notes || "";
  el.equipmentActive.checked = Boolean(item.is_active);

  el.saveEquipmentBtn.textContent = "Änderung speichern";
  el.cancelEquipmentEditBtn.classList.remove("hidden");

  setEquipmentMessage("Du bearbeitest gerade ein Equipment.");
  openView("equipment");
}

function resetEquipmentForm() {
  state.editingEquipmentId = null;

  el.equipmentCategory.value = "Maschine";
  el.equipmentName.value = "";
  el.equipmentBrand.value = "";
  el.equipmentModel.value = "";
  el.equipmentPurchaseDate.value = "";
  el.equipmentPrice.value = "";
  el.equipmentFacts.value = "";
  el.equipmentNotes.value = "";
  el.equipmentActive.checked = true;

  el.saveEquipmentBtn.textContent = "Equipment speichern";
  el.cancelEquipmentEditBtn.classList.add("hidden");

  setEquipmentMessage("");
}

async function deleteEquipment(id) {
  const confirmed = window.confirm("Dieses Equipment wirklich löschen?");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from(TABLE_EQUIPMENT)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Equipment konnte nicht gelöscht werden:", error);
    showToast("Löschen fehlgeschlagen.");
    return;
  }

  showToast("Equipment gelöscht.");
  await loadEquipment();
  renderAll();
}


/* ============================================================
   Settings
   ============================================================ */

async function saveSettings() {
  const payload = {
    id: 1,
    caffeine_limit_mg: toNumber(el.limitInput.value) ?? 400,
    target_time_min_s: toNumber(el.targetTimeMin.value) ?? 25,
    target_time_max_s: toNumber(el.targetTimeMax.value) ?? 30,
    target_pressure_min_bar: toNumber(el.targetPressureMin.value) ?? 8,
    target_pressure_max_bar: toNumber(el.targetPressureMax.value) ?? 10,
    updated_at: new Date().toISOString(),
  };

  if (payload.target_time_min_s >= payload.target_time_max_s) {
    setSettingsMessage("Die minimale Zielzeit muss kleiner als die maximale Zielzeit sein.", "error");
    return;
  }

  setButtonLoading(el.saveSettingsBtn, true, "Speichere ...", "Einstellungen speichern");

  const { error } = await supabaseClient
    .from(TABLE_SETTINGS)
    .upsert(payload, { onConflict: "id" });

  setButtonLoading(el.saveSettingsBtn, false, "Speichere ...", "Einstellungen speichern");

  if (error) {
    console.error("Einstellungen konnten nicht gespeichert werden:", error);
    setSettingsMessage(`Speichern fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  state.settings = {
    caffeine_limit_mg: payload.caffeine_limit_mg,
    target_time_min_s: payload.target_time_min_s,
    target_time_max_s: payload.target_time_max_s,
    target_pressure_min_bar: payload.target_pressure_min_bar,
    target_pressure_max_bar: payload.target_pressure_max_bar,
  };

  state.recommendations = buildRecommendations(state.entries);

  setSettingsMessage("Einstellungen gespeichert.");
  showToast("Einstellungen gespeichert.");
  renderAll();
}


/* ============================================================
   Charts
   ============================================================ */

function setupCanvas(canvas) {
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 400;
  const height = Number(canvas.getAttribute("height")) || 260;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  return { ctx, width, height };
}

function drawBarWithAverage(canvas, labels, values, average, unit) {
  const setup = setupCanvas(canvas);
  if (!setup) return;

  const { ctx, width, height } = setup;
  const pad = 34;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const max = Math.max(average, ...values, 1) * 1.25;
  const barGap = 10;
  const barW = Math.max(12, (chartW - barGap * (values.length - 1)) / values.length);

  ctx.strokeStyle = "rgba(245,245,245,0.14)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  values.forEach((value, index) => {
    const x = pad + index * (barW + barGap);
    const h = (value / max) * chartH;
    const y = pad + chartH - h;

    const grd = ctx.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, "#ffcf8a");
    grd.addColorStop(1, "#8b4513");

    ctx.fillStyle = grd;
    roundRect(ctx, x, y, barW, h || 2, 7);
    ctx.fill();

    ctx.fillStyle = "rgba(245,245,245,0.72)";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(labels[index], x + barW / 2, height - 9);
  });

  const avgY = pad + chartH - (average / max) * chartH;

  ctx.strokeStyle = "#f5f5f5";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(pad, avgY);
  ctx.lineTo(width - pad, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`Ø ${formatNumber(average)} ${unit}`, pad, avgY - 8);
}

function drawLineChart(canvas, labels, values, unit) {
  const setup = setupCanvas(canvas);
  if (!setup) return;

  const { ctx, width, height } = setup;
  const pad = 34;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  if (!values.length || values.every((v) => !v)) {
    ctx.fillStyle = "rgba(245,245,245,0.72)";
    ctx.font = "14px system-ui";
    ctx.fillText("Noch keine Daten", pad, height / 2);
    return;
  }

  const max = Math.max(...values, 1) * 1.2;

  ctx.strokeStyle = "rgba(245,245,245,0.14)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  const xFor = (i) => pad + (chartW * i) / Math.max(values.length - 1, 1);
  const yFor = (v) => pad + chartH - (v / max) * chartH;

  ctx.strokeStyle = "#ffcf8a";
  ctx.lineWidth = 3;
  ctx.beginPath();

  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  ctx.fillStyle = "#d4a574";

  values.forEach((value, index) => {
    if (value <= 0) return;

    ctx.beginPath();
    ctx.arc(xFor(index), yFor(value), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(245,245,245,0.72)";
  ctx.font = "12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`${formatNumber(max)} ${unit}`, pad, 16);
}

function drawDonut(canvas, items) {
  const setup = setupCanvas(canvas);
  if (!setup) return;

  const { ctx, width, height } = setup;

  if (!items.length) {
    ctx.fillStyle = "rgba(245,245,245,0.72)";
    ctx.font = "14px system-ui";
    ctx.fillText("Noch keine Daten", 24, height / 2);
    return;
  }

  const total = items.reduce((sum, item) => sum + item[1], 0);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const lineWidth = 28;

  const colors = ["#ffcf8a", "#d4a574", "#8b4513", "#b8753a", "#f0b36e", "#6a3514"];

  let start = -Math.PI / 2;

  items.forEach((item, index) => {
    const value = item[1];
    const angle = (value / total) * Math.PI * 2;

    ctx.strokeStyle = colors[index % colors.length];
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.stroke();

    start += angle;
  });

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 22px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(String(total), cx, cy + 2);

  ctx.fillStyle = "rgba(245,245,245,0.72)";
  ctx.font = "12px system-ui";
  ctx.fillText("Shots", cx, cy + 22);
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

init();
