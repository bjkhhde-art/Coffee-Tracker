/* ============================================================
   Coffee Tracker – GitHub Pages + Supabase
   Getränke, Koffein, Mahlgrad, Shot-Daten, Equipment, Statistiken
   ============================================================ */


/* ============================================================
   1. SUPABASE
   ============================================================ */

const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const TABLE_ENTRIES = "coffee_entries";
const TABLE_DRINKS = "coffee_drinks";
const TABLE_SETTINGS = "coffee_user_settings";
const TABLE_GRINDER = "coffee_grinder_settings";
const TABLE_EQUIPMENT = "coffee_equipment";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;


/* ============================================================
   2. STATE
   ============================================================ */

const DEFAULT_DRINKS = [
  { name: "Espresso", drink_type: "Espresso", emoji: "☕", default_amount_ml: 30, default_caffeine_mg: 80 },
  { name: "Doppelter Espresso", drink_type: "Espresso", emoji: "☕", default_amount_ml: 60, default_caffeine_mg: 120 },
  { name: "Kaffee", drink_type: "Kaffee", emoji: "☕", default_amount_ml: 200, default_caffeine_mg: 95 },
  { name: "Cappuccino", drink_type: "Milchkaffee", emoji: "🥛", default_amount_ml: 180, default_caffeine_mg: 80 },
  { name: "Latte Macchiato", drink_type: "Milchkaffee", emoji: "🥛", default_amount_ml: 250, default_caffeine_mg: 80 },
  { name: "V60", drink_type: "V60", emoji: "🔻", default_amount_ml: 250, default_caffeine_mg: 120 },
  { name: "French Press", drink_type: "French Press", emoji: "🫙", default_amount_ml: 250, default_caffeine_mg: 110 },
  { name: "Cold Brew", drink_type: "Cold Brew", emoji: "🧊", default_amount_ml: 250, default_caffeine_mg: 150 },
  { name: "Entkoffeiniert", drink_type: "Entkoffeiniert", emoji: "🌙", default_amount_ml: 200, default_caffeine_mg: 5 },
];

const state = {
  isLoading: true,
  entries: [],
  drinks: [],
  grinderSettings: [],
  equipment: [],
  settings: {
    caffeine_limit_mg: 400,
    unit: "ml",
  },
  editingId: null,
  editingEquipmentId: null,
  filters: {
    date: "",
    drink: "",
  },
  grinderSearch: "",
};


/* ============================================================
   3. DOM
   ============================================================ */

const $ = (id) => document.getElementById(id);

const el = {
  tabs: $("tabs"),
  navToggle: $("navToggle"),
  fabAdd: $("fabAdd"),

  drinkSelect: $("drinkSelect"),
  quickFavorites: $("quickFavorites"),
  entryForm: $("entryForm"),
  entryDate: $("entryDate"),
  entryTime: $("entryTime"),
  customDrinkName: $("customDrinkName"),
  drinkEmoji: $("drinkEmoji"),
  drinkType: $("drinkType"),
  amountMl: $("amountMl"),
  caffeineMg: $("caffeineMg"),
  mahlgrad: $("mahlgrad"),
  extractionTime: $("extractionTime"),
  pressureBar: $("pressureBar"),
  rating: $("rating"),
  note: $("note"),

  drinkError: $("drinkError"),
  amountError: $("amountError"),
  caffeineError: $("caffeineError"),
  formError: $("formError"),
  formMessage: $("formMessage"),

  saveEntryBtn: $("saveEntryBtn"),
  saveDrinkBtn: $("saveDrinkBtn"),
  cancelEditBtn: $("cancelEditBtn"),
  resetFormBtn: $("resetFormBtn"),
  editBadge: $("editBadge"),

  todayCount: $("todayCount"),
  todayCaffeine: $("todayCaffeine"),
  caffeineRemaining: $("caffeineRemaining"),
  avgDaily: $("avgDaily"),
  limitText: $("limitText"),
  overLimitHint: $("overLimitHint"),

  weekCanvas: $("weekCanvas"),
  weekCompare: $("weekCompare"),
  trendCanvas: $("trendCanvas"),
  trendBadge: $("trendBadge"),
  beanRanking: $("beanRanking"),
  topRatings: $("topRatings"),
  methodCanvas: $("methodCanvas"),
  methodBars: $("methodBars"),
  peakHour: $("peakHour"),
  heatmap: $("heatmap"),

  filterDate: $("filterDate"),
  filterDrink: $("filterDrink"),
  clearFiltersBtn: $("clearFiltersBtn"),
  deleteAllBtn: $("deleteAllBtn"),
  entriesList: $("entriesList"),
  entriesCount: $("entriesCount"),

  grinderSearch: $("grinderSearch"),
  grinderTable: $("grinderTable"),
  grinderCount: $("grinderCount"),

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
  unitSelect: $("unitSelect"),
  saveSettingsBtn: $("saveSettingsBtn"),
  settingsMessage: $("settingsMessage"),

  toast: $("toast"),
};


/* ============================================================
   4. HELFER
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

function showToast(message) {
  if (!el.toast) return;

  el.toast.textContent = message;
  el.toast.classList.add("show");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.remove("show");
  }, 2600);
}

function setFormMessage(message, type = "info") {
  if (!el.formMessage) return;
  el.formMessage.textContent = message || "";
  el.formMessage.style.color = type === "error" ? "var(--danger)" : "var(--accent-light)";
}

function setSettingsMessage(message, type = "info") {
  if (!el.settingsMessage) return;
  el.settingsMessage.textContent = message || "";
  el.settingsMessage.style.color = type === "error" ? "var(--danger)" : "var(--accent-light)";
}

function setEquipmentMessage(message, type = "info") {
  if (!el.equipmentMessage) return;
  el.equipmentMessage.textContent = message || "";
  el.equipmentMessage.style.color = type === "error" ? "var(--danger)" : "var(--accent-light)";
}

function setButtonLoading(button, isLoading, loadingText, defaultText) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
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

function formatDateShort(date) {
  if (!date) return "–";

  return new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatEntryTime(time) {
  if (!time) return "–";
  return String(time).slice(0, 5);
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

function getMethodIcon(entryOrType) {
  const text = normalize(
    typeof entryOrType === "string"
      ? entryOrType
      : `${entryOrType.drink_type || ""} ${entryOrType.drink_name || ""}`
  );

  if (text.includes("espresso")) return "☕";
  if (text.includes("v60")) return "🔻";
  if (text.includes("filter")) return "🔻";
  if (text.includes("french")) return "🫙";
  if (text.includes("cold")) return "🧊";
  if (text.includes("cappuccino")) return "🥛";
  if (text.includes("latte")) return "🥛";
  if (text.includes("entkoff")) return "🌙";
  return "☕";
}

function getMethodName(entry) {
  return entry.drink_type || entry.drink_name || "Unbekannt";
}

function getRatingClass(rating) {
  const n = Number(rating);

  if (!Number.isFinite(n)) return "rating-none";
  if (n >= 4) return "rating-good";
  if (n >= 3) return "rating-mid";
  return "rating-bad";
}

function getRoastClass(roast) {
  const text = normalize(roast);

  if (text.includes("light") || text.includes("hell")) return "roast-light";
  if (text.includes("medium")) return "roast-medium";
  if (text.includes("dark") || text.includes("dunkel")) return "roast-dark";

  return "roast-unknown";
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

function sumCaffeine(entries) {
  return entries.reduce((sum, entry) => sum + (Number(entry.caffeine_mg) || 0), 0);
}

function sumCaffeineForDays(days) {
  return days.reduce((sum, day) => {
    const entries = state.entries.filter((entry) => entry.entry_date === day);
    return sum + sumCaffeine(entries);
  }, 0);
}


/* ============================================================
   5. INIT
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

  setTimeout(() => {
    el.drinkSelect?.focus();
  }, 350);
}

function initFormDefaults() {
  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();

  if (el.equipmentCategory) {
    el.equipmentCategory.value = "Maschine";
  }
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      openView(tab.dataset.view);
    });
  });

  el.navToggle?.addEventListener("click", () => {
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

  if (viewName === "dashboard") renderDashboard();
  if (viewName === "history") renderEntries();
  if (viewName === "grinder") renderGrinderSettings();
  if (viewName === "equipment") renderEquipment();
}


/* ============================================================
   6. SKELETON LOADING
   ============================================================ */

function renderSkeletons() {
  if (el.entriesList) {
    el.entriesList.innerHTML = `
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    `;
  }

  if (el.beanRanking) {
    el.beanRanking.innerHTML = `
      <div class="skeleton skeleton-list"></div>
      <div class="skeleton skeleton-list"></div>
      <div class="skeleton skeleton-list"></div>
    `;
  }

  if (el.topRatings) {
    el.topRatings.innerHTML = `
      <div class="skeleton skeleton-list"></div>
      <div class="skeleton skeleton-list"></div>
      <div class="skeleton skeleton-list"></div>
    `;
  }

  if (el.grinderTable) {
    el.grinderTable.innerHTML = `
      <tr><td colspan="8"><div class="skeleton skeleton-card"></div></td></tr>
      <tr><td colspan="8"><div class="skeleton skeleton-card"></div></td></tr>
    `;
  }

  if (el.equipmentList) {
    el.equipmentList.innerHTML = `
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    `;
  }
}


/* ============================================================
   7. SUPABASE LOAD
   ============================================================ */

async function reloadAll() {
  state.isLoading = true;
  renderSkeletons();

  await Promise.all([
    loadSettings(),
    loadDrinks(),
    loadEntries(),
    loadGrinderSettings(),
    loadEquipment(),
  ]);

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
      unit: data.unit || "ml",
    };
  }

  el.limitInput.value = state.settings.caffeine_limit_mg;
  el.unitSelect.value = state.settings.unit;
}

async function loadDrinks() {
  const { data, error } = await supabaseClient
    .from(TABLE_DRINKS)
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Getränke konnten nicht geladen werden:", error);
    state.drinks = [...DEFAULT_DRINKS];
    return;
  }

  const byName = new Map();

  [...DEFAULT_DRINKS, ...(data || [])].forEach((drink) => {
    byName.set(normalize(drink.name), drink);
  });

  state.drinks = Array.from(byName.values());
}

async function loadEntries() {
  const { data, error } = await supabaseClient
    .from(TABLE_ENTRIES)
    .select("*")
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false });

  if (error) {
    console.error("Einträge konnten nicht geladen werden:", error);
    showToast("Einträge konnten nicht geladen werden.");
    state.entries = [];
    return;
  }

  state.entries = data || [];
}

async function loadGrinderSettings() {
  const { data, error } = await supabaseClient
    .from(TABLE_GRINDER)
    .select("*")
    .order("marke", { ascending: true })
    .order("bohne", { ascending: true })
    .order("mahlgrad", { ascending: true });

  if (error) {
    console.error("Mahlgrad-Daten konnten nicht geladen werden:", error);
    state.grinderSettings = [];
    return;
  }

  state.grinderSettings = data || [];
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
   8. EVENTS
   ============================================================ */

function initEvents() {
  el.entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEntry();
  });

  el.drinkSelect.addEventListener("change", () => {
    const drink = getDrinkByName(el.drinkSelect.value);
    fillFormFromDrink(drink);
    validateEntryForm(false);
  });

  [el.customDrinkName, el.amountMl, el.caffeineMg].forEach((input) => {
    input.addEventListener("input", () => validateEntryForm(false));
  });

  el.saveDrinkBtn.addEventListener("click", saveDrinkTemplate);
  el.resetFormBtn.addEventListener("click", resetForm);
  el.cancelEditBtn.addEventListener("click", cancelEdit);

  el.filterDate.addEventListener("change", () => {
    state.filters.date = el.filterDate.value;
    renderEntries();
  });

  el.filterDrink.addEventListener("change", () => {
    state.filters.drink = el.filterDrink.value;
    renderEntries();
  });

  el.clearFiltersBtn.addEventListener("click", () => {
    state.filters.date = "";
    state.filters.drink = "";
    el.filterDate.value = "";
    el.filterDrink.value = "";
    renderEntries();
  });

  el.deleteAllBtn.addEventListener("click", deleteAllEntries);

  el.grinderSearch.addEventListener("input", () => {
    state.grinderSearch = el.grinderSearch.value;
    renderGrinderSettings();
  });

  el.equipmentForm.addEventListener("submit", saveEquipment);
  el.resetEquipmentBtn.addEventListener("click", resetEquipmentForm);
  el.cancelEquipmentEditBtn.addEventListener("click", resetEquipmentForm);

  el.saveSettingsBtn.addEventListener("click", saveSettings);

  el.fabAdd.addEventListener("click", () => {
    cancelEdit();
    openView("add");
    setTimeout(() => el.drinkSelect?.focus(), 80);
  });

  window.addEventListener("resize", () => {
    if ($("view-dashboard").classList.contains("active")) {
      renderDashboard();
    }
  });
}


/* ============================================================
   9. RENDER ALL
   ============================================================ */

function renderAll() {
  renderDrinkSelect();
  renderQuickFavorites();
  renderFilterDrinkSelect();
  renderDashboard();
  renderEntries();
  renderGrinderSettings();
  renderEquipment();
}


/* ============================================================
   10. GETRÄNKE
   ============================================================ */

function renderDrinkSelect() {
  const current = el.drinkSelect.value;

  el.drinkSelect.innerHTML = "";

  state.drinks.forEach((drink) => {
    const option = document.createElement("option");
    option.value = drink.name;
    option.textContent = `${getMethodIcon(drink.drink_type || drink.name)} ${drink.name}`;
    el.drinkSelect.appendChild(option);
  });

  if (current && state.drinks.some((drink) => drink.name === current)) {
    el.drinkSelect.value = current;
  } else if (state.drinks.length) {
    el.drinkSelect.value = state.drinks[0].name;
    fillFormFromDrink(state.drinks[0]);
  }
}

function renderQuickFavorites() {
  el.quickFavorites.innerHTML = "";

  state.drinks.slice(0, 6).forEach((drink) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-btn";
    button.innerHTML = `
      <span>${escapeHTML(getMethodIcon(drink.drink_type || drink.name))}</span>
      <strong>${escapeHTML(drink.name)}</strong>
      <small>${formatNumber(drink.default_caffeine_mg)} mg</small>
    `;

    button.addEventListener("click", () => {
      el.drinkSelect.value = drink.name;
      fillFormFromDrink(drink);
      openView("add");
    });

    el.quickFavorites.appendChild(button);
  });
}

function getDrinkByName(name) {
  return state.drinks.find((drink) => drink.name === name) || null;
}

function fillFormFromDrink(drink) {
  if (!drink) return;

  el.customDrinkName.value = "";
  el.drinkEmoji.value = getMethodIcon(drink.drink_type || drink.name);
  el.drinkType.value = drink.drink_type || "";
  el.amountMl.value = drink.default_amount_ml ?? "";
  el.caffeineMg.value = drink.default_caffeine_mg ?? "";
}

async function saveDrinkTemplate() {
  const name = el.customDrinkName.value.trim();

  if (!name) {
    setFormMessage("Bitte zuerst einen Namen für dein eigenes Getränk eintragen.", "error");
    return;
  }

  const payload = {
    name,
    drink_type: el.drinkType.value.trim() || null,
    emoji: el.drinkEmoji.value.trim() || getMethodIcon(el.drinkType.value),
    default_amount_ml: toNumber(el.amountMl.value) ?? 200,
    default_caffeine_mg: toNumber(el.caffeineMg.value) ?? 80,
  };

  setButtonLoading(el.saveDrinkBtn, true, "Speichere ...", "Getränk als Vorlage speichern");

  const { error } = await supabaseClient
    .from(TABLE_DRINKS)
    .upsert(payload, { onConflict: "name" });

  setButtonLoading(el.saveDrinkBtn, false, "Speichere ...", "Getränk als Vorlage speichern");

  if (error) {
    console.error("Getränk konnte nicht gespeichert werden:", error);
    setFormMessage(`Getränk konnte nicht gespeichert werden: ${error.message}`, "error");
    return;
  }

  showToast("Getränkevorlage gespeichert ☕");
  setFormMessage("Getränkevorlage gespeichert.");

  await loadDrinks();
  renderDrinkSelect();
  renderQuickFavorites();
  renderFilterDrinkSelect();

  el.drinkSelect.value = name;
}


/* ============================================================
   11. FORMULAR
   ============================================================ */

function readEntryForm() {
  const selectedDrink = getDrinkByName(el.drinkSelect.value);
  const customName = el.customDrinkName.value.trim();

  const drinkName = customName || selectedDrink?.name || el.drinkSelect.value || "";
  const rawTime = el.entryTime.value || nowTime();

  return {
    entry_date: el.entryDate.value || todayISO(),
    entry_time: rawTime.length === 5 ? `${rawTime}:00` : rawTime,

    drink_name: drinkName,
    drink_type: el.drinkType.value.trim() || selectedDrink?.drink_type || null,
    emoji: el.drinkEmoji.value.trim() || getMethodIcon(el.drinkType.value || drinkName),

    amount_ml: toNumber(el.amountMl.value),
    caffeine_mg: toNumber(el.caffeineMg.value),

    note: el.note.value.trim() || null,

    mahlgrad: toNumber(el.mahlgrad.value),
    extraction_time_s: toNumber(el.extractionTime.value),
    pressure_bar: toNumber(el.pressureBar.value),
    rating: toNumber(el.rating.value),
  };
}

function validateEntryForm(showErrors = true) {
  const entry = readEntryForm();
  const errors = {
    drink: "",
    amount: "",
    caffeine: "",
    form: "",
  };

  if (!entry.drink_name) {
    errors.drink = "Bitte Getränk auswählen oder Namen eintragen.";
  }

  if (entry.amount_ml === null || entry.amount_ml < 0) {
    errors.amount = "Bitte eine gültige Menge eintragen.";
  }

  if (entry.caffeine_mg === null || entry.caffeine_mg < 0) {
    errors.caffeine = "Bitte gültigen Koffeinwert eintragen.";
  }

  const hasErrors = Boolean(errors.drink || errors.amount || errors.caffeine);

  if (showErrors || hasErrors) {
    el.drinkError.textContent = errors.drink;
    el.amountError.textContent = errors.amount;
    el.caffeineError.textContent = errors.caffeine;
    el.formError.textContent = errors.form;
  }

  return !hasErrors;
}

async function saveEntry() {
  if (!validateEntryForm(true)) return;

  const payload = readEntryForm();

  const isEditing = Boolean(state.editingId);
  const defaultText = isEditing ? "Änderung speichern" : "Kaffee hinzufügen ☕";

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
    console.error("Eintrag konnte nicht gespeichert werden:", response.error);
    setFormMessage(`Speichern fehlgeschlagen: ${response.error.message}`, "error");
    return;
  }

  showToast(isEditing ? "Eintrag aktualisiert ☕" : "Kaffee hinzugefügt ☕");

  resetForm();

  await loadEntries();
  renderAll();
  openView("history");
}

function resetForm() {
  state.editingId = null;

  el.entryDate.value = todayISO();
  el.entryTime.value = nowTime();

  el.customDrinkName.value = "";
  el.note.value = "";
  el.mahlgrad.value = "";
  el.extractionTime.value = "";
  el.pressureBar.value = "";
  el.rating.value = "";

  if (state.drinks.length) {
    el.drinkSelect.value = state.drinks[0].name;
    fillFormFromDrink(state.drinks[0]);
  }

  el.formError.textContent = "";
  el.drinkError.textContent = "";
  el.amountError.textContent = "";
  el.caffeineError.textContent = "";
  setFormMessage("");

  el.saveEntryBtn.textContent = "Kaffee hinzufügen ☕";
  el.cancelEditBtn.classList.add("hidden");
  el.editBadge.classList.add("hidden");
}

function startEdit(entry) {
  state.editingId = entry.id;

  el.entryDate.value = entry.entry_date || todayISO();
  el.entryTime.value = formatEntryTime(entry.entry_time);

  const knownDrink = getDrinkByName(entry.drink_name);

  if (knownDrink) {
    el.drinkSelect.value = knownDrink.name;
    el.customDrinkName.value = "";
  } else {
    el.customDrinkName.value = entry.drink_name || "";
  }

  el.drinkEmoji.value = entry.emoji || getMethodIcon(entry);
  el.drinkType.value = entry.drink_type || "";
  el.amountMl.value = entry.amount_ml ?? "";
  el.caffeineMg.value = entry.caffeine_mg ?? "";
  el.note.value = entry.note || "";

  el.mahlgrad.value = entry.mahlgrad ?? "";
  el.extractionTime.value = entry.extraction_time_s ?? "";
  el.pressureBar.value = entry.pressure_bar ?? "";
  el.rating.value = entry.rating ?? "";

  el.saveEntryBtn.textContent = "Änderung speichern";
  el.cancelEditBtn.classList.remove("hidden");
  el.editBadge.classList.remove("hidden");

  setFormMessage("Du bearbeitest gerade einen bestehenden Eintrag.");
  openView("add");
}

function cancelEdit() {
  resetForm();
}


/* ============================================================
   12. EINTRÄGE / VERLAUF
   ============================================================ */

function getFilteredEntries() {
  return state.entries.filter((entry) => {
    const dateMatches = !state.filters.date || entry.entry_date === state.filters.date;
    const drinkMatches = !state.filters.drink || entry.drink_name === state.filters.drink;
    return dateMatches && drinkMatches;
  });
}

function renderFilterDrinkSelect() {
  const currentValue = el.filterDrink.value;

  const drinkNames = Array.from(
    new Set([
      ...state.drinks.map((drink) => drink.name),
      ...state.entries.map((entry) => entry.drink_name),
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "de"));

  el.filterDrink.innerHTML = `<option value="">Alle Getränke</option>`;

  drinkNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    el.filterDrink.appendChild(option);
  });

  el.filterDrink.value = currentValue;
}

function renderEntries() {
  const entries = getFilteredEntries();

  el.entriesCount.textContent = `${entries.length} Einträge`;
  el.entriesList.innerHTML = "";

  if (!entries.length) {
    el.entriesList.innerHTML = `<div class="empty">Noch keine passenden Einträge vorhanden.</div>`;
    return;
  }

  const groups = new Map();

  entries.forEach((entry) => {
    const key = entry.entry_date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  groups.forEach((dayEntries, day) => {
    const dayTotal = dayEntries.reduce((sum, entry) => sum + (Number(entry.caffeine_mg) || 0), 0);

    const group = document.createElement("section");
    group.className = "day-group";

    group.innerHTML = `
      <div class="day-head">
        <h3>${escapeHTML(formatDateHeader(day))}</h3>
        <span>${formatNumber(dayTotal)} mg</span>
      </div>
    `;

    dayEntries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = `entry-card compact ${getRatingClass(entry.rating)}`;
      card.tabIndex = 0;

      const methodIcon = entry.emoji || getMethodIcon(entry);
      const ratingText = entry.rating ? `${entry.rating}/5` : "–";
      const methodName = getMethodName(entry);

      card.innerHTML = `
        <div class="swipe-hint left">Bearbeiten</div>
        <div class="swipe-hint right">Löschen</div>

        <div class="entry-main">
          <div class="entry-icon">${escapeHTML(methodIcon)}</div>

          <div class="entry-content">
            <div class="entry-title-row">
              <strong>${escapeHTML(entry.drink_name)}</strong>
              <span>${escapeHTML(formatEntryTime(entry.entry_time))}</span>
            </div>

            <div class="entry-meta compact-meta">
              <span class="method-chip">${escapeHTML(methodIcon)} ${escapeHTML(methodName)}</span>
              <span>${formatNumber(entry.caffeine_mg)} mg</span>
              <span>${formatNumber(entry.amount_ml)} ml</span>
              <span class="rating-chip ${getRatingClass(entry.rating)}">★ ${ratingText}</span>
            </div>

            ${
              entry.mahlgrad || entry.extraction_time_s || entry.pressure_bar
                ? `
                  <div class="entry-meta secondary-meta">
                    <span>MG ${formatNumber(entry.mahlgrad, 1)}</span>
                    <span>${formatNumber(entry.extraction_time_s, 1)} s</span>
                    <span>${formatNumber(entry.pressure_bar, 1)} Bar</span>
                  </div>
                `
                : ""
            }

            ${entry.note ? `<p>${escapeHTML(entry.note)}</p>` : ""}
          </div>
        </div>

        <button class="delete-entry" type="button" aria-label="Eintrag löschen">×</button>
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
  const confirmed = window.confirm("Diesen Eintrag wirklich löschen?");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from(TABLE_ENTRIES)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Eintrag konnte nicht gelöscht werden:", error);
    showToast("Löschen fehlgeschlagen.");
    return;
  }

  showToast("Eintrag gelöscht.");
  await loadEntries();
  renderAll();
}

async function deleteAllEntries() {
  const firstConfirm = window.confirm("Wirklich ALLE Kaffee-Einträge löschen?");
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
    console.error("Alle Einträge konnten nicht gelöscht werden:", error);
    showToast("Löschen fehlgeschlagen.");
    return;
  }

  showToast("Alle Einträge gelöscht.");
  await loadEntries();
  renderAll();
}


/* ============================================================
   13. DASHBOARD / STATS
   ============================================================ */

function renderDashboard() {
  const today = todayISO();
  const todayEntries = state.entries.filter((entry) => entry.entry_date === today);
  const todayCaffeine = sumCaffeine(todayEntries);
  const limit = Number(state.settings.caffeine_limit_mg) || 400;

  el.todayCount.textContent = String(todayEntries.length);
  el.todayCaffeine.textContent = `${formatNumber(todayCaffeine)} mg`;
  el.limitText.textContent = `Limit: ${formatNumber(limit)} mg`;

  const remaining = estimateRemainingCaffeine();
  el.caffeineRemaining.textContent = `${formatNumber(remaining)} mg`;

  const last7Days = getLastNDays(7);
  const last7Total = sumCaffeineForDays(last7Days);
  el.avgDaily.textContent = `${formatNumber(last7Total / 7)} mg`;

  if (todayCaffeine > limit) {
    el.overLimitHint.textContent = `Tageslimit überschritten: ${formatNumber(todayCaffeine)} mg von ${formatNumber(limit)} mg.`;
    el.overLimitHint.classList.remove("hidden");
  } else {
    el.overLimitHint.classList.add("hidden");
  }

  renderWeekCanvas();
  renderTrendCanvas();
  renderBeanRanking();
  renderTopRatings();
  renderMethodDistribution();
  renderHeatmap();
}

function renderWeekCanvas() {
  const days = getLastNDays(7);
  const values = days.map((day) => sumCaffeine(state.entries.filter((entry) => entry.entry_date === day)));
  const average = values.reduce((a, b) => a + b, 0) / 7;

  const previousDays = getPreviousNDays(7, 7);
  const currentTotal = values.reduce((a, b) => a + b, 0);
  const previousTotal = sumCaffeineForDays(previousDays);

  if (previousTotal > 0) {
    const diff = ((currentTotal - previousTotal) / previousTotal) * 100;
    const prefix = diff >= 0 ? "+" : "";
    el.weekCompare.textContent = `${prefix}${formatNumber(diff)}% zur Vorwoche`;
  } else {
    el.weekCompare.textContent = "Keine Vorwoche";
  }

  const labels = days.map((day) =>
    new Date(`${day}T00:00:00`).toLocaleDateString("de-DE", { weekday: "short" })
  );

  drawBarWithAverage(el.weekCanvas, labels, values, average, "mg");
}

function renderTrendCanvas() {
  const days = getLastNDays(30);
  const values = days.map((day) => sumCaffeine(state.entries.filter((entry) => entry.entry_date === day)));

  const firstHalf = values.slice(0, 15).reduce((a, b) => a + b, 0) / 15;
  const secondHalf = values.slice(15).reduce((a, b) => a + b, 0) / 15;

  let trend = "stabil";
  if (secondHalf > firstHalf * 1.12) trend = "steigend";
  if (secondHalf < firstHalf * 0.88) trend = "fallend";

  el.trendBadge.textContent = trend;

  const labels = days.map((day) => {
    const d = new Date(`${day}T00:00:00`);
    return d.getDate().toString();
  });

  drawLineChart(el.trendCanvas, labels, values, "mg");
}

function renderBeanRanking() {
  el.beanRanking.innerHTML = "";

  if (!state.entries.length) {
    el.beanRanking.innerHTML = `<div class="empty compact">Noch keine Daten.</div>`;
    return;
  }

  const map = new Map();

  state.entries.forEach((entry) => {
    const key = entry.drink_name || "Unbekannt";
    map.set(key, (map.get(key) || 0) + 1);
  });

  const items = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const max = Math.max(...items.map((item) => item[1]));

  items.forEach(([name, count], index) => {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <div>
        <strong>${escapeHTML(name)}</strong>
        <div class="mini-track">
          <div class="mini-fill" style="width:${(count / max) * 100}%"></div>
        </div>
      </div>
      <span>${count}x</span>
    `;

    el.beanRanking.appendChild(row);
  });
}

function renderTopRatings() {
  el.topRatings.innerHTML = "";

  const rated = state.entries
    .filter((entry) => Number(entry.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 5);

  if (!rated.length) {
    el.topRatings.innerHTML = `<div class="empty compact">Noch keine Bewertungen vorhanden.</div>`;
    return;
  }

  rated.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <div>
        <strong>${escapeHTML(entry.drink_name)}</strong>
        <small>${escapeHTML(formatDateHeader(entry.entry_date))} · ${escapeHTML(formatEntryTime(entry.entry_time))}</small>
      </div>
      <span class="rating-chip ${getRatingClass(entry.rating)}">★ ${entry.rating}/5</span>
    `;

    el.topRatings.appendChild(row);
  });
}

function renderMethodDistribution() {
  const map = new Map();

  state.entries.forEach((entry) => {
    const method = getMethodName(entry);
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
  topLeft.textContent = "";
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
      cell.title = `${weekdayLabel} ${hour}:00 – ${count} Einträge`;
      cell.style.opacity = count ? String(0.22 + intensity * 0.78) : "0.12";
      cell.dataset.count = count;

      el.heatmap.appendChild(cell);
    });
  });
}

function estimateRemainingCaffeine() {
  const now = new Date();
  const halfLifeHours = 5;

  return state.entries.reduce((sum, entry) => {
    if (!entry.entry_date || !entry.entry_time) return sum;

    const entryDateTime = new Date(`${entry.entry_date}T${entry.entry_time}`);
    const diffHours = (now - entryDateTime) / 1000 / 60 / 60;

    if (diffHours < 0) return sum;

    const caffeine = Number(entry.caffeine_mg) || 0;
    const remaining = caffeine * Math.pow(0.5, diffHours / halfLifeHours);

    return sum + remaining;
  }, 0);
}


/* ============================================================
   14. CHARTS
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
  ctx.fillText("Einträge", cx, cy + 22);
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
   15. MAHLGRADE
   ============================================================ */

function grinderMatches(item) {
  const q = normalize(state.grinderSearch);
  if (!q) return true;

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

function renderGrinderSettings() {
  const items = state.grinderSettings.filter(grinderMatches);

  el.grinderCount.textContent = `${items.length} Einträge`;
  el.grinderTable.innerHTML = "";

  if (!items.length) {
    el.grinderTable.innerHTML = `
      <tr>
        <td colspan="8">Keine Mahlgrad-Daten gefunden.</td>
      </tr>
    `;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("tr");
    const roastClass = getRoastClass(item.roestgrad);

    row.innerHTML = `
      <td><strong>${escapeHTML(item.marke || "–")}</strong></td>
      <td>${escapeHTML(item.bohne || "–")}</td>
      <td><span class="roast-chip ${roastClass}">${escapeHTML(item.roestgrad || "–")}</span></td>
      <td>${formatNumber(item.mahlgrad, 1)}</td>
      <td>${formatNumber(item.extraktionszeit_36g_s, 1)} s</td>
      <td>${formatNumber(item.druck_bar, 1)} Bar</td>
      <td>${escapeHTML(item.geschmack || "–")}</td>
      <td><button class="row-btn" type="button">Nutzen</button></td>
    `;

    row.querySelector(".row-btn").addEventListener("click", () => {
      applyGrinderSetting(item);
    });

    el.grinderTable.appendChild(row);
  });
}

function applyGrinderSetting(item) {
  el.customDrinkName.value = item.bohne || "";
  el.drinkType.value = item.roestgrad || "Espresso";
  el.drinkEmoji.value = getMethodIcon("Espresso");
  el.amountMl.value = 36;
  el.caffeineMg.value = 80;
  el.mahlgrad.value = item.mahlgrad ?? "";
  el.extractionTime.value = item.extraktionszeit_36g_s ?? "";
  el.pressureBar.value = item.druck_bar ?? "";
  el.note.value = item.geschmack || "";

  openView("add");
  setFormMessage("Mahlgrad-Vorlage übernommen.");
}


/* ============================================================
   16. EQUIPMENT
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
  renderEquipment();
}

function renderEquipment() {
  if (!el.equipmentList || !el.equipmentCount) return;

  el.equipmentCount.textContent = `${state.equipment.length} Geräte`;
  el.equipmentList.innerHTML = "";

  if (!state.equipment.length) {
    el.equipmentList.innerHTML = `<div class="empty">Noch kein Equipment hinterlegt.</div>`;
    return;
  }

  const grouped = new Map();

  state.equipment.forEach((item) => {
    const category = item.category || "Sonstiges";

    if (!grouped.has(category)) {
      grouped.set(category, []);
    }

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
  renderEquipment();
}


/* ============================================================
   17. SETTINGS
   ============================================================ */

async function saveSettings() {
  const limit = toNumber(el.limitInput.value);
  const unit = el.unitSelect.value || "ml";

  if (limit === null || limit < 0) {
    setSettingsMessage("Bitte ein gültiges Koffeinlimit eintragen.", "error");
    return;
  }

  setButtonLoading(el.saveSettingsBtn, true, "Speichere ...", "Einstellungen speichern");

  const { error } = await supabaseClient
    .from(TABLE_SETTINGS)
    .upsert({
      id: 1,
      caffeine_limit_mg: limit,
      unit,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  setButtonLoading(el.saveSettingsBtn, false, "Speichere ...", "Einstellungen speichern");

  if (error) {
    console.error("Einstellungen konnten nicht gespeichert werden:", error);
    setSettingsMessage(`Speichern fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  state.settings.caffeine_limit_mg = limit;
  state.settings.unit = unit;

  setSettingsMessage("Einstellungen gespeichert.");
  showToast("Einstellungen gespeichert.");
  renderDashboard();
}


/* ============================================================
   START
   ============================================================ */

init();
