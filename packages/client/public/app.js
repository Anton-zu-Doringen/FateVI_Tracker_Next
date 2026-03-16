const state = {
  token: null,
  session: null,
  view: null,
  bootstrap: null,
  eventSource: null,
  liveConnected: false,
  bluetoothDevices: [],
  pixelsDevices: [],
  pixelsMonitor: { monitors: [], recentEvents: [] },
  selectedPixelsDevices: [],
  pixelsAssignments: [],
  pixelsConfig: { mode: "pc-set-3", sharedSet: [null, null, null] },
  pixelsRollProgress: [],
  library: { snapshots: [], groups: [] },
  initiativeDialogRequested: false,
  initiativeDialogInputs: {},
  logEntries: [],
  minimizedCharacterIds: [],
  editingCharacterId: null,
  draggedRosterCharacterId: null,
  draggedTurnCharacterId: null,
  undoStack: [],
  redoStack: [],
  uiSettings: {
    fontScale: 1,
    forceOneColumn: false,
    showSystemLogs: true
  }
};
const SESSION_TOKEN_KEY = "fatevi_tracker_next.session_token";
const UI_SETTINGS_KEY = "fatevi_tracker_next.ui_settings";

const appShellEl = document.querySelector(".app-shell");
const openLoginDialogBtn = document.getElementById("open-login-dialog");
const gmLoginBtn = document.getElementById("gm-login");
const loginDialogEl = document.getElementById("login-dialog");
const loginFormEl = document.getElementById("login-form");
const loginDialogCloseBtn = document.getElementById("login-dialog-close");
const loginNameEl = document.getElementById("login-name");
const loginPasswordEl = document.getElementById("login-password");
const registerFormEl = document.getElementById("register-form");
const registerNameEl = document.getElementById("register-name");
const registerPasswordEl = document.getElementById("register-password");
const registerPasswordRepeatEl = document.getElementById("register-password-repeat");
const accountMenuEl = document.getElementById("account-menu");
const accountConnectionChipEl = document.getElementById("account-connection-chip");
const openAccountDialogBtn = document.getElementById("open-account-dialog");
const logoutBtn = document.getElementById("logout-btn");
const accountDialogEl = document.getElementById("account-dialog");
const accountDialogCloseBtn = document.getElementById("account-dialog-close");
const accountDialogDescriptionEl = document.getElementById("account-dialog-description");
const accountPasswordFormEl = document.getElementById("account-password-form");
const accountCurrentPasswordEl = document.getElementById("account-current-password");
const accountNewPasswordEl = document.getElementById("account-new-password");
const accountNewPasswordRepeatEl = document.getElementById("account-new-password-repeat");
const addFormEl = document.getElementById("add-form");
const addNameEl = document.getElementById("name");
const addTypeEl = document.getElementById("type");
const addIniEl = document.getElementById("ini");
const addSpecialAbilityEl = document.getElementById("special-ability");
const eventFormEl = document.getElementById("event-form");
const eventDescriptionEl = document.getElementById("event-description");
const eventDueOffsetEl = document.getElementById("event-due-offset");
const eventsEl = document.getElementById("events");
const loginHintEl = document.getElementById("login-hint");
const sessionStatusEl = document.getElementById("session-status");
const refreshStateBtn = document.getElementById("refresh-state");
const undoActionBtn = document.getElementById("undo-action");
const redoActionBtn = document.getElementById("redo-action");
const fontSizeSliderEl = document.getElementById("font-size-slider");
const forceOneColumnEl = document.getElementById("force-one-column");
const resetAppStateBtn = document.getElementById("reset-app-state");
const headerSettingsMenuEl = document.getElementById("header-settings-menu");
const characterSettingsMenuEl = document.getElementById("character-settings-menu");
const iniSettingsMenuEl = document.getElementById("ini-settings-menu");
const removeAllCharactersBtn = document.getElementById("remove-all-characters");
const removePcCharactersBtn = document.getElementById("remove-pc-characters");
const removeNpcCharactersBtn = document.getElementById("remove-npc-characters");
const endCombatBtn = document.getElementById("end-combat");
const openPixelsSettingsBtn = document.getElementById("open-pixels-settings");
const pixelsSettingsDialogEl = document.getElementById("pixels-settings-dialog");
const pixelsSettingsCloseBtn = document.getElementById("pixels-settings-close");
const startRoundBtn = document.getElementById("start-round");
const toggleAllPcSurprisedEl = document.getElementById("toggle-all-pc-surprised");
const toggleAllNpcSurprisedEl = document.getElementById("toggle-all-npc-surprised");
const turnOrderEl = document.getElementById("turn-order");
const charactersEl = document.getElementById("characters");
const snapshotFormEl = document.getElementById("snapshot-form");
const snapshotNameEl = document.getElementById("snapshot-name");
const snapshotListEl = document.getElementById("snapshot-list");
const libraryExportBtn = document.getElementById("library-export");
const libraryImportTriggerBtn = document.getElementById("library-import-trigger");
const libraryImportFileEl = document.getElementById("library-import-file");
const pcGroupFormEl = document.getElementById("pc-group-form");
const pcGroupNameEl = document.getElementById("pc-group-name");
const pcGroupListEl = document.getElementById("pc-group-list");
const npcGroupFormEl = document.getElementById("npc-group-form");
const npcGroupNameEl = document.getElementById("npc-group-name");
const npcGroupListEl = document.getElementById("npc-group-list");
const roundStatusEl = document.getElementById("round-status");
const combatLogEl = document.getElementById("combat-log");
const showSystemLogsEl = document.getElementById("show-system-logs");
const rawStateEl = document.getElementById("raw-state");
const activateCharacterUpBtn = document.getElementById("activate-character-up");
const activateCharacterDownBtn = document.getElementById("activate-character-down");
const bluetoothScanBtn = document.getElementById("bluetooth-scan");
const bluetoothDevicesEl = document.getElementById("bluetooth-devices");
const pixelsRefreshBtn = document.getElementById("pixels-refresh");
const pixelsDevicesEl = document.getElementById("pixels-devices");
const pixelsModeSelectEl = document.getElementById("pixels-mode-select");
const pixelsModeHelpEl = document.getElementById("pixels-mode-help");
const pixelsCharacterAssignmentsEl = document.getElementById("pixels-character-assignments");
const pixelsMonitorEl = document.getElementById("pixels-monitor");
const pixelsEventsEl = document.getElementById("pixels-events");
const clearPixelsEventsBtn = document.getElementById("clear-pixels-events");
const initiativeRollDialogEl = document.getElementById("initiative-roll-dialog");
const initiativeRollTitleEl = document.getElementById("initiative-roll-title");
const initiativeRollStatusEl = document.getElementById("initiative-roll-status");
const initiativeRollListEl = document.getElementById("initiative-roll-list");
const initiativeRollCloseBtn = document.getElementById("initiative-roll-close");
const warningDialogEl = document.getElementById("warning-dialog");
const warningDialogTitleEl = document.getElementById("warning-dialog-title");
const warningDialogMessageEl = document.getElementById("warning-dialog-message");
const warningDialogCancelBtn = document.getElementById("warning-dialog-cancel");
const warningDialogConfirmBtn = document.getElementById("warning-dialog-confirm");
const editCharacterDialogEl = document.getElementById("edit-character-dialog");
const editCharacterFormEl = document.getElementById("edit-character-form");
const editCharacterTitleEl = document.getElementById("edit-character-title");
const editNameEl = document.getElementById("edit-name");
const editTypeEl = document.getElementById("edit-type");
const editIniEl = document.getElementById("edit-ini");
const editSpecialAbilityEl = document.getElementById("edit-special-ability");
const editInitiativeRollModeEl = document.getElementById("edit-initiative-roll-mode");
const editHiddenEl = document.getElementById("edit-hidden");
const editCharacterCancelBtn = document.getElementById("edit-character-cancel");
const DAMAGE_QM_VALUES = ["-", "-", "-", "-", "-", "-", "-", "-1", "-2", "-3", "-4", "-7", "-8", "-9", "-12", "-15"];
const DAMAGE_BEW_VALUES = ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-1", "-1", "-2", "-3", "-5", "-7"];
const SPECIAL_ABILITY_LABELS = {
  "INI Archer": "INI Schützen",
  "INI Nimble": "INI Flink",
  "INI Boxer": "INI Straßenschläger",
  "INI Pacifist": "INI Pazifist",
  "INI Horsemen": "INI Reiter"
};
const HEADER_SETTINGS_CLOSE_DELAY_MS = 220;
const PIXELS_MODE = {
  PC_SET_3: "pc-set-3",
  SHARED_SET_3: "shared-set-3",
  PC_SINGLE_3X: "pc-single-3x"
};
let headerSettingsCloseTimer = null;
let warningDialogResolver = null;
let characterSettingsCloseTimer = null;
let iniSettingsCloseTimer = null;
let accountMenuCloseTimer = null;

function openDialog(dialogEl) {
  if (!dialogEl) {
    return;
  }
  if (typeof dialogEl.showModal === "function") {
    dialogEl.showModal();
  } else {
    dialogEl.setAttribute("open", "open");
  }
}

function closeDialog(dialogEl) {
  if (!dialogEl) {
    return;
  }
  if (typeof dialogEl.close === "function") {
    dialogEl.close();
  } else {
    dialogEl.removeAttribute("open");
  }
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function requestBinary(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }
  return response;
}

function createLogEntry(message, options = {}, currentLog = []) {
  const nextLineNo = (currentLog.at(-1)?.lineNo || 0) + 1;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    lineLabel: `#${String(nextLineNo).padStart(3, "0")}`,
    lineNo: nextLineNo,
    kind: options.kind || "combat",
    turn: options.turn ?? (Number(state.view?.round) || 0),
    at: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    message
  };
}

function renderLogEntries(container, entries, emptyMessage) {
  container.innerHTML = "";
  if (!entries.length) {
    container.innerHTML = `<p class="empty">${emptyMessage}</p>`;
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("div");
    item.className = "log-entry";
    if (entry.kind === "system") {
      item.classList.add("log-entry-system");
    } else {
      item.classList.add(/\bINI\b|Initiative|Wurf/i.test(entry.message) ? "log-entry-initiative" : "log-entry-muted");
    }

    const lineNo = document.createElement("span");
    lineNo.className = "log-line-no";
    lineNo.textContent = entry.lineLabel || "#---";
    item.appendChild(lineNo);

    const turn = document.createElement("span");
    turn.className = "log-turn";
    turn.textContent = entry.turn > 0 ? `T${entry.turn}` : "T-";
    item.appendChild(turn);

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = entry.at;
    item.appendChild(time);

    const text = document.createElement("span");
    text.className = "log-message";
    text.textContent = entry.message;
    item.appendChild(text);

    container.appendChild(item);
  }

  container.scrollTop = container.scrollHeight;
}

function renderLogs() {
  const visibleEntries = state.uiSettings.showSystemLogs
    ? state.logEntries
    : state.logEntries.filter((entry) => entry.kind !== "system");
  renderLogEntries(combatLogEl, visibleEntries, "Noch keine Logeinträge.");
}

function formatLibraryTimestamp(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderLibrarySection(container, entries, emptyMessage, options = {}) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  if (!state.session || state.session.role !== "gm") {
    container.innerHTML = '<p class="empty">Nur im SL-Login verfügbar.</p>';
    return;
  }
  if (!entries.length) {
    container.innerHTML = `<p class="empty">${emptyMessage}</p>`;
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("article");
    item.className = "library-item";

    const titleRow = document.createElement("div");
    titleRow.className = "library-item-head";

    const title = document.createElement("strong");
    title.textContent = entry.name || "Ohne Name";
    titleRow.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "library-item-meta";
    meta.textContent = `${entry.characterCount || 0} Einträge | ${formatLibraryTimestamp(entry.updatedAt || entry.createdAt)}`;
    titleRow.appendChild(meta);
    item.appendChild(titleRow);

    if (typeof entry.round === "number") {
      const detail = document.createElement("p");
      detail.className = "library-item-detail";
      detail.textContent = `Kampfrunde: ${entry.round || 0}`;
      item.appendChild(detail);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "ghost";
    loadBtn.textContent = "Laden";
    loadBtn.addEventListener("click", async () => {
      try {
        const payload = await requestJson(options.loadPath, {
          method: "POST",
          body: JSON.stringify({ [options.idKey]: entry.id })
        });
        if (payload.view) {
          state.undoStack = [];
          state.redoStack = [];
          state.view = payload.view;
          renderView();
        }
        if (payload.library) {
          state.library = payload.library;
          renderImportExportPanel();
        }
        setStatus(`${options.label} geladen: ${entry.name}.`);
      } catch (error) {
        setStatus(`${options.label} konnte nicht geladen werden: ${error.message}`);
      }
    });
    actions.appendChild(loadBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ghost";
    deleteBtn.textContent = "Löschen";
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await openWarningDialog(`${options.label} "${entry.name}" wirklich löschen?`, `${options.label} löschen`);
      if (!confirmed) {
        return;
      }
      try {
        const payload = await requestJson(options.deletePath, {
          method: "POST",
          body: JSON.stringify({ [options.idKey]: entry.id })
        });
        state.library = payload.library || { snapshots: [], groups: [] };
        renderImportExportPanel();
        setStatus(`${options.label} gelöscht: ${entry.name}.`);
      } catch (error) {
        setStatus(`${options.label} konnte nicht gelöscht werden: ${error.message}`);
      }
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    container.appendChild(item);
  }
}

function renderImportExportPanel() {
  const isGm = Boolean(state.session && state.session.role === "gm");
  for (const element of [libraryExportBtn, libraryImportTriggerBtn, libraryImportFileEl]) {
    if (element) {
      element.disabled = !isGm;
    }
  }
  for (const form of [snapshotFormEl, pcGroupFormEl, npcGroupFormEl]) {
    if (!form) {
      continue;
    }
    for (const element of form.querySelectorAll("input, button")) {
      element.disabled = !isGm;
    }
  }
  const groups = Array.isArray(state.library?.groups) ? state.library.groups : [];
  renderLibrarySection(snapshotListEl, state.library?.snapshots || [], "Noch keine Tracker-Snapshots.", {
    idKey: "snapshotId",
    loadPath: "/api/library/snapshots/load",
    deletePath: "/api/library/snapshots/delete",
    label: "Snapshot"
  });
  renderLibrarySection(
    pcGroupListEl,
    groups.filter((entry) => entry.type === "PC"),
    "Noch keine gespeicherten SC-Gruppen.",
    {
      idKey: "groupId",
      loadPath: "/api/library/groups/load",
      deletePath: "/api/library/groups/delete",
      label: "SC-Gruppe"
    }
  );
  renderLibrarySection(
    npcGroupListEl,
    groups.filter((entry) => entry.type === "NPC"),
    "Noch keine gespeicherten NSC-Gruppen.",
    {
      idKey: "groupId",
      loadPath: "/api/library/groups/load",
      deletePath: "/api/library/groups/delete",
      label: "NSC-Gruppe"
    }
  );
}

async function loadLibrary() {
  if (!state.token || !state.session || state.session.role !== "gm") {
    state.library = { snapshots: [], groups: [] };
    renderImportExportPanel();
    return;
  }
  const payload = await requestJson("/api/library");
  state.library = payload.library || { snapshots: [], groups: [] };
  renderImportExportPanel();
}

function setStatus(message) {
  if (sessionStatusEl) {
    sessionStatusEl.textContent = message;
  }
  state.logEntries = [...state.logEntries, createLogEntry(message, { kind: "system" }, state.logEntries)].slice(0, 60);
  renderLogs();
}

function appendLogMessage(message, options = {}) {
  state.logEntries = [...state.logEntries, createLogEntry(message, { ...options, kind: "combat" }, state.logEntries)].slice(0, 60);
  renderLogs();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCharacterNameById(characterId) {
  return getCharacterById(state.view, characterId)?.name || characterId || "Unbekannt";
}

function formatRuleEvent(event) {
  const characterName = event?.characterId ? getCharacterNameById(event.characterId) : null;
  switch (event?.type) {
    case "combat-ended":
      return "Kampf beendet.";
    case "round-started":
      return `Kampfrunde gestartet (${event.detail || `KR ${Number(state.view?.round || 0) + 1}`}).`;
    case "initiative-roll-requested":
      return `INI-Wurf angefordert: ${characterName}.`;
    case "initiative-roll-resolved":
      return `INI-Wurf übernommen: ${characterName}.`;
    case "active-character-changed":
      return `Aktiver Charakter: ${characterName || "-"}.`;
    case "damage-monitor-updated":
      return `Schadensmonitor geändert: ${characterName}.`;
    case "dazed-applied":
      return `Benommenheit gesetzt: ${characterName}.`;
    case "parade-triggered":
      return `Parade verwendet: ${characterName}${event.detail ? ` (${event.detail})` : ""}.`;
    case "special-ability-toggled":
      return `Ch. Vorteil umgeschaltet: ${characterName}.`;
    case "turn-entry-toggled":
      return `${characterName}: ${event.detail || "Turn geändert"}.`;
    case "character-updated":
      return `${characterName}: ${event.detail || "aktualisiert"}.`;
    case "event-updated":
      return `Ereignis: ${event.detail || "aktualisiert"}.`;
    default:
      return null;
  }
}

function saveToken(token) {
  state.token = token;
  if (token) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

function clearSession() {
  disconnectLiveUpdates();
  saveToken(null);
  state.session = null;
  state.liveConnected = false;
  state.view = null;
  state.bluetoothDevices = [];
  state.pixelsDevices = [];
  state.pixelsMonitor = { monitors: [], recentEvents: [] };
  state.selectedPixelsDevices = [];
  state.pixelsAssignments = [];
  state.pixelsConfig = { mode: PIXELS_MODE.PC_SET_3, sharedSet: [null, null, null] };
  state.pixelsRollProgress = [];
  state.library = { snapshots: [], groups: [] };
  state.initiativeDialogRequested = false;
  state.initiativeDialogInputs = {};
  state.undoStack = [];
  state.redoStack = [];
  closeInitiativeRollDialog();
  renderAuthControls();
}

function getSessionDisplayName() {
  return state.session?.displayName || "Spielleiter";
}

function renderAuthControls() {
  if (openLoginDialogBtn) {
    openLoginDialogBtn.hidden = Boolean(state.session?.role === "gm");
  }
  if (accountMenuEl) {
    accountMenuEl.hidden = !state.session || state.session.role !== "gm";
  }
  const accountMenuTriggerEl = document.getElementById("account-menu-trigger");
  if (accountMenuTriggerEl) {
    accountMenuTriggerEl.textContent =
      state.session?.role === "gm" ? `${getSessionDisplayName()} (SL)` : "Spielleiter (SL)";
  }
  if (accountConnectionChipEl) {
    const connected = Boolean(state.session?.role === "gm" && state.liveConnected);
    accountConnectionChipEl.className = `connection-chip ${connected ? "connected" : "disconnected"}`;
    accountConnectionChipEl.textContent = connected ? "✓" : "✕";
    accountConnectionChipEl.setAttribute("aria-label", connected ? "Verbunden" : "Nicht verbunden");
    accountConnectionChipEl.setAttribute("title", connected ? "Verbunden" : "Nicht verbunden");
    accountConnectionChipEl.hidden = !state.session || state.session.role !== "gm";
  }
}

function isCharacterMinimized(characterId) {
  return state.minimizedCharacterIds.includes(characterId);
}

function toggleCharacterMinimized(characterId) {
  if (isCharacterMinimized(characterId)) {
    state.minimizedCharacterIds = state.minimizedCharacterIds.filter((entry) => entry !== characterId);
  } else {
    state.minimizedCharacterIds = [...state.minimizedCharacterIds, characterId];
  }
  renderView();
}

function openPixelsSettingsDialog() {
  if (!pixelsSettingsDialogEl) {
    return;
  }
  if (typeof pixelsSettingsDialogEl.showModal === "function") {
    pixelsSettingsDialogEl.showModal();
  } else {
    pixelsSettingsDialogEl.setAttribute("open", "open");
  }
}

function closePixelsSettingsDialog() {
  if (!pixelsSettingsDialogEl) {
    return;
  }
  if (typeof pixelsSettingsDialogEl.close === "function") {
    pixelsSettingsDialogEl.close();
  } else {
    pixelsSettingsDialogEl.removeAttribute("open");
  }
}

function openInitiativeRollDialog() {
  if (!initiativeRollDialogEl || initiativeRollDialogEl.open) {
    return;
  }
  if (typeof initiativeRollDialogEl.showModal === "function") {
    initiativeRollDialogEl.showModal();
  } else {
    initiativeRollDialogEl.setAttribute("open", "open");
  }
}

function closeInitiativeRollDialog() {
  if (!initiativeRollDialogEl) {
    return;
  }
  if (typeof initiativeRollDialogEl.close === "function") {
    initiativeRollDialogEl.close();
  } else {
    initiativeRollDialogEl.removeAttribute("open");
  }
}

function openWarningDialog(message, title = "Bestätigen") {
  if (!warningDialogEl || !warningDialogTitleEl || !warningDialogMessageEl) {
    return Promise.resolve(window.confirm(message));
  }

  warningDialogTitleEl.textContent = title;
  warningDialogMessageEl.textContent = message;

  return new Promise((resolve) => {
    warningDialogResolver = resolve;
    if (typeof warningDialogEl.showModal === "function") {
      warningDialogEl.showModal();
    } else {
      warningDialogEl.setAttribute("open", "open");
    }
  });
}

function closeWarningDialog(result) {
  if (warningDialogResolver) {
    warningDialogResolver(Boolean(result));
    warningDialogResolver = null;
  }
  if (!warningDialogEl) {
    return;
  }
  if (typeof warningDialogEl.close === "function") {
    warningDialogEl.close();
  } else {
    warningDialogEl.removeAttribute("open");
  }
}

function getCharacterById(view, characterId) {
  return (view?.characters || []).find((entry) => entry.id === characterId) || null;
}

function getCharactersByType(view, type) {
  return (view?.characters || []).filter((character) => character.type === type);
}

function isCharacterHidden(character) {
  return Boolean(character?.hidden);
}

function getVisibleCharactersByType(view, type) {
  return getCharactersByType(view, type).filter((character) => !isCharacterHidden(character));
}

function getRosterCharacterBuckets(view) {
  const buckets = {
    visible: { PC: [], NPC: [] },
    hidden: { PC: [], NPC: [] }
  };
  for (const character of view?.characters || []) {
    const visibilityKey = isCharacterHidden(character) ? "hidden" : "visible";
    const typeKey = character.type === "NPC" ? "NPC" : "PC";
    buckets[visibilityKey][typeKey].push(character);
  }
  return buckets;
}

function getDefaultInitiativeRollMode(type) {
  return type === "NPC" ? "automatic" : "manual";
}

function normalizeInitiativeRollMode(value, type = "PC") {
  if (value === "automatic" || value === "manual" || value === "pixels") {
    return value;
  }
  return getDefaultInitiativeRollMode(type);
}

function getSpecialAbilityLabel(value) {
  if (!value) {
    return "";
  }
  return SPECIAL_ABILITY_LABELS[value] || value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function persistUiSettings() {
  window.localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(state.uiSettings));
}

function applyUiSettings(uiSettings) {
  const fontScale = clamp(Number(uiSettings?.fontScale) || 1, 0.7, 1.3);
  const forceOneColumn = Boolean(uiSettings?.forceOneColumn);
  const showSystemLogs = uiSettings?.showSystemLogs !== false;
  state.uiSettings = { fontScale, forceOneColumn, showSystemLogs };
  if (appShellEl) {
    appShellEl.style.zoom = String(fontScale);
    const supportsZoom = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("zoom", "1");
    if (supportsZoom) {
      appShellEl.style.transform = "";
      appShellEl.style.transformOrigin = "";
      appShellEl.style.width = "";
    } else {
      appShellEl.style.transform = `scale(${fontScale})`;
      appShellEl.style.transformOrigin = "top center";
      appShellEl.style.width = `${100 / fontScale}%`;
    }
    appShellEl.classList.toggle("one-column", forceOneColumn);
  }
  if (fontSizeSliderEl) {
    fontSizeSliderEl.value = String(Math.round(fontScale * 100));
  }
  if (forceOneColumnEl) {
    forceOneColumnEl.checked = forceOneColumn;
  }
  if (showSystemLogsEl) {
    showSystemLogsEl.checked = showSystemLogs;
  }
  renderLogs();
}

function cloneCombatStateSnapshot(view = state.view) {
  if (!view) {
    return null;
  }
  return JSON.parse(JSON.stringify(view));
}

function areSnapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function updateHistoryButtons() {
  if (undoActionBtn) {
    undoActionBtn.disabled = !state.undoStack.length;
  }
  if (redoActionBtn) {
    redoActionBtn.disabled = !state.redoStack.length;
  }
}

async function restoreCombatState(snapshot, reason) {
  const payload = await requestJson("/api/state/restore", {
    method: "POST",
    body: JSON.stringify({ state: snapshot, reason })
  });
  state.view = payload.view;
  renderView();
}

async function performTrackedCombatAction(action, label = "Aktion") {
  const before = cloneCombatStateSnapshot();
  if (!before) {
    await action();
    return;
  }
  await action();
  const after = cloneCombatStateSnapshot();
  if (!after || areSnapshotsEqual(before, after)) {
    updateHistoryButtons();
    return;
  }
  state.undoStack = [{ before, after, label }, ...state.undoStack].slice(0, 100);
  state.redoStack = [];
  updateHistoryButtons();
}

function closeCharacterSettingsMenu() {
  if (characterSettingsCloseTimer) {
    window.clearTimeout(characterSettingsCloseTimer);
    characterSettingsCloseTimer = null;
  }
  if (characterSettingsMenuEl) {
    characterSettingsMenuEl.open = false;
  }
}

async function removeCharactersByType(type = null) {
  const snapshot = cloneCombatStateSnapshot();
  if (!snapshot) {
    return;
  }

  const remainingCharacters = type
    ? (snapshot.characters || []).filter((character) => character.type !== type)
    : [];
  const removed = (snapshot.characters || []).length - remainingCharacters.length;
  const label = type === "PC" ? "SC entfernen" : type === "NPC" ? "NSC entfernen" : "Alle entfernen";
  const confirmText = type === "PC" ? "Alle SC entfernen?" : type === "NPC" ? "Alle NSC entfernen?" : "Alle Charaktere/NSC entfernen?";

  if (removed <= 0) {
    closeCharacterSettingsMenu();
    setStatus(type === "PC" ? "Keine SC zum Entfernen vorhanden." : type === "NPC" ? "Keine NSC zum Entfernen vorhanden." : "Keine Charaktere/NSC zum Entfernen vorhanden.");
    return;
  }

  const confirmed = await openWarningDialog(confirmText, label);
  if (!confirmed) {
    return;
  }

  const remainingIds = new Set(remainingCharacters.map((character) => character.id));
  const nextState = {
    ...snapshot,
    characters: remainingCharacters,
    turnEntries: (snapshot.turnEntries || []).filter((entry) => remainingIds.has(entry.characterId)),
    pendingInputs: (snapshot.pendingInputs || []).filter((entry) => remainingIds.has(entry.characterId)),
    activeCharacterId: remainingIds.has(snapshot.activeCharacterId) ? snapshot.activeCharacterId : null
  };

  try {
    await performTrackedCombatAction(() => restoreCombatState(nextState, `bulk-remove-${type || "all"}`), label);
    state.minimizedCharacterIds = state.minimizedCharacterIds.filter((characterId) => remainingIds.has(characterId));
    closeCharacterSettingsMenu();
    setStatus(
      type === "PC"
        ? `SC entfernt (${removed}).`
        : type === "NPC"
          ? `NSC entfernt (${removed}).`
          : `Charaktere/NSC entfernt (${removed}).`
    );
  } catch (error) {
    closeCharacterSettingsMenu();
    setStatus(`${label} fehlgeschlagen: ${error.message}`);
  }
}

function normalizePixelsMode(value) {
  if (value === PIXELS_MODE.SHARED_SET_3 || value === PIXELS_MODE.PC_SINGLE_3X || value === PIXELS_MODE.PC_SET_3) {
    return value;
  }
  return PIXELS_MODE.PC_SET_3;
}

function normalizeSharedSet(value) {
  return Array.from({ length: 3 }, (_, index) => {
    const entry = Array.isArray(value) ? value[index] : null;
    return typeof entry === "string" && entry ? entry : "";
  });
}

function getPixelsModeDescription(mode) {
  if (mode === PIXELS_MODE.PC_SINGLE_3X) {
    return "Jeder SC nutzt einen eigenen Pixels-Würfel und würfelt damit dreimal.";
  }
  if (mode === PIXELS_MODE.SHARED_SET_3) {
    return "Alle SC würfeln mit demselben 3er-Set in Reihenfolge des Charaktere/NSC-Panels.";
  }
  return "Jeder SC nutzt ein eigenes Set aus drei spezifischen Pixels.";
}

function getCharacterDetail(character) {
  if (!character) {
    return null;
  }
  if (character.detail) {
    return character.detail;
  }
  if (typeof character.initiativeBase === "number") {
    return {
      initiativeBase: character.initiativeBase,
      initiativeRollMode: normalizeInitiativeRollMode(character.initiativeRollMode, character.type),
      surprised: Boolean(character.surprised),
      incapacitated: Boolean(character.incapacitated),
      dazedUntilRound: character.dazedUntilRound ?? null,
      damageMonitorMarks: Array.isArray(character.damageMonitorMarks) ? [...character.damageMonitorMarks] : [],
      unfreeDefensePenalty: Number(character.unfreeDefensePenalty) || 0,
      paradeClickCount: Number(character.paradeClickCount) || 0,
      moveActionUsed: Boolean(character.moveActionUsed),
      specialAbilityActive: Boolean(character.specialAbilityActive),
      lastRoll: character.lastRoll ?? null,
      critBonusRoll: character.critBonusRoll ?? null
    };
  }
  return null;
}

function getTurnTypeLabel(turnType) {
  return turnType === "Main" ? "Aktion" : turnType === "Move" ? "Bew." : "Bonus";
}

function getTurnGroups(view) {
  const groups = [];
  const groupsByCharacterId = new Map();
  for (const entry of view.turnEntries || []) {
    if (!groupsByCharacterId.has(entry.characterId)) {
      const character = getCharacterById(view, entry.characterId);
      const group = {
        characterId: entry.characterId,
        character,
        groupInitiative: entry.groupInitiative,
        critical: entry.critical,
        entries: []
      };
      groupsByCharacterId.set(entry.characterId, group);
      groups.push(group);
    }
    groupsByCharacterId.get(entry.characterId).entries.push(entry);
  }
  return groups;
}

function moveIdBeforeTarget(ids, sourceId, targetId) {
  if (!Array.isArray(ids) || !sourceId || !targetId || sourceId === targetId) {
    return Array.isArray(ids) ? [...ids] : [];
  }
  const nextIds = [...ids];
  const sourceIndex = nextIds.indexOf(sourceId);
  const targetIndex = nextIds.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return nextIds;
  }
  const [movedId] = nextIds.splice(sourceIndex, 1);
  const nextTargetIndex = nextIds.indexOf(targetId);
  nextIds.splice(nextTargetIndex, 0, movedId);
  return nextIds;
}

function moveIdAfterAnchor(ids, sourceId, anchorId = null) {
  if (!Array.isArray(ids) || !sourceId) {
    return Array.isArray(ids) ? [...ids] : [];
  }
  const nextIds = [...ids];
  const sourceIndex = nextIds.indexOf(sourceId);
  if (sourceIndex < 0) {
    return nextIds;
  }
  const [movedId] = nextIds.splice(sourceIndex, 1);
  if (!anchorId) {
    nextIds.unshift(movedId);
    return nextIds;
  }
  const anchorIndex = nextIds.indexOf(anchorId);
  if (anchorIndex < 0) {
    nextIds.push(movedId);
    return nextIds;
  }
  nextIds.splice(anchorIndex + 1, 0, movedId);
  return nextIds;
}

async function moveCharacterToHiddenState(characterId, hidden) {
  const characters = state.view?.characters || [];
  const character = characters.find((entry) => entry.id === characterId);
  if (!character || isCharacterHidden(character) === hidden) {
    return;
  }
  const orderedIds = characters.map((entry) => entry.id);
  const reorderedIds = hidden
    ? [...orderedIds.filter((id) => id !== characterId), characterId]
    : moveIdAfterAnchor(
        orderedIds,
        characterId,
        [...characters].reverse().find((entry) => !isCharacterHidden(entry) && entry.id !== characterId)?.id || null
      );
  await performTrackedCombatAction(
    async () => {
      await sendCommand({
        type: "update-character",
        characterId,
        patch: { hidden }
      });
      await sendCommand({ type: "reorder-characters", characterIds: reorderedIds });
    },
    hidden ? "Charakter ausblenden" : "Charakter einblenden"
  );
}

function getActiveTurnEntryIdForCharacter(view, characterId) {
  const entries = (view.turnEntries || []).filter((entry) => entry.characterId === characterId);
  const unresolvedEntry = entries.find((entry) => !entry.used);
  return unresolvedEntry?.id || entries[0]?.id || null;
}

function normalizeDamageMonitorMarks(value) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: 16 }, (_, index) => Boolean(source[index]));
}

function computeDamagePenalty(characterDetail) {
  const marks = normalizeDamageMonitorMarks(characterDetail?.damageMonitorMarks);
  let rightmostIndex = -1;
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    if (marks[index]) {
      rightmostIndex = index;
      break;
    }
  }
  if (rightmostIndex === -1) {
    return { qm: 0, bew: 0 };
  }
  const qm = Number.parseInt(String(DAMAGE_QM_VALUES[rightmostIndex] || "-").replace(/[^\d-]/g, ""), 10);
  const bew = Number.parseInt(String(DAMAGE_BEW_VALUES[rightmostIndex] || "-").replace(/[^\d-]/g, ""), 10);
  return {
    qm: Number.isFinite(qm) ? Math.abs(qm) : 0,
    bew: Number.isFinite(bew) ? Math.abs(bew) : 0
  };
}

function isCharacterDazed(characterDetail, round) {
  if (!characterDetail || characterDetail.dazedUntilRound === null || characterDetail.dazedUntilRound === undefined) {
    return false;
  }
  if ((round || 0) <= 0) {
    return false;
  }
  return round <= characterDetail.dazedUntilRound;
}

function disconnectLiveUpdates() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  state.liveConnected = false;
  renderAuthControls();
}

function connectLiveUpdates() {
  disconnectLiveUpdates();
  if (!state.token) {
    return;
  }

  const eventSource = new EventSource(`/api/events?token=${encodeURIComponent(state.token)}`);
  eventSource.onopen = () => {
    state.liveConnected = true;
    renderAuthControls();
  };
  eventSource.addEventListener("state", (event) => {
    const payload = JSON.parse(event.data);
    state.session = payload.session;
    state.view = payload.view;
    state.liveConnected = true;
    renderAuthControls();
    setStatus(`Live verbunden als ${getSessionDisplayName()} (${state.session.role === "gm" ? "SL" : state.session.role}).`);
    renderView();
  });
  eventSource.addEventListener("pixels-status", (event) => {
    state.pixelsMonitor = JSON.parse(event.data);
    renderPixelsMonitor();
    renderPixelsDevices();
  });
  eventSource.addEventListener("pixels-roll", (event) => {
    const payload = JSON.parse(event.data);
    const recentEvents = [payload, ...(state.pixelsMonitor?.recentEvents || [])].slice(0, 50);
    state.pixelsMonitor = {
      ...(state.pixelsMonitor || { monitors: [] }),
      recentEvents
    };
    renderPixelsMonitor();
  });
  eventSource.addEventListener("pixels-assignments", (event) => {
    const payload = JSON.parse(event.data);
    state.pixelsAssignments = payload.assignments || [];
    renderPixelsDevices();
    renderPixelsCharacterAssignments();
  });
  eventSource.addEventListener("pixels-selection", (event) => {
    const payload = JSON.parse(event.data);
    state.selectedPixelsDevices = payload.selectedDevices || [];
    renderBluetoothDevices();
    renderPixelsDevices();
    renderPixelsCharacterAssignments();
  });
  eventSource.addEventListener("pixels-config", (event) => {
    const payload = JSON.parse(event.data);
    state.pixelsConfig = {
      mode: normalizePixelsMode(payload?.config?.mode),
      sharedSet: normalizeSharedSet(payload?.config?.sharedSet)
    };
    renderPixelsDevices();
    renderPixelsCharacterAssignments();
  });
  eventSource.addEventListener("pixels-roll-progress", (event) => {
    const payload = JSON.parse(event.data);
    state.pixelsRollProgress = [
      payload,
      ...(state.pixelsRollProgress || []).filter((entry) => entry.characterId !== payload.characterId)
    ].slice(0, 20);
    renderPixelsMonitor();
  });
  eventSource.addEventListener("pixels-roll-resolved", (event) => {
    const payload = JSON.parse(event.data);
    state.pixelsRollProgress = (state.pixelsRollProgress || []).filter((entry) => entry.characterId !== payload.characterId);
    renderPixelsMonitor();
  });
  eventSource.onerror = () => {
    state.liveConnected = false;
    renderAuthControls();
    setStatus("Live-Update-Verbindung unterbrochen. Browser versucht Wiederverbindung.");
  };
  state.eventSource = eventSource;
}

function renderBootstrap() {
  if (loginHintEl) {
    loginHintEl.textContent = state.bootstrap?.gmLoginHint || "";
  }
  renderAuthControls();
}

function createCharacterId(name, type) {
  const base = String(name || "charakter")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "charakter";
  const prefix = type === "NPC" ? "npc" : "pc";
  return `${prefix}-${base}-${Math.random().toString(36).slice(2, 6)}`;
}

async function setAllCharactersSurprised(type, surprised) {
  const characters = getCharactersByType(state.view, type);
  for (const character of characters) {
    const detail = getCharacterDetail(character);
    if (!detail || Boolean(detail.surprised) === surprised) {
      continue;
    }
    await sendCommand({
      type: "toggle-surprised",
      characterId: character.id,
      surprised
    });
  }
}

function openCharacterEditDialog(character) {
  state.editingCharacterId = character.id;
  editCharacterTitleEl.textContent = `Charakter bearbeiten: ${character.name}`;
  editNameEl.value = character.name;
  editTypeEl.value = character.type === "NPC" ? "NPC" : "PC";
  editIniEl.value = String(character.initiativeBase ?? 10);
  editSpecialAbilityEl.value = character.specialAbility || "";
  if (editHiddenEl) {
    editHiddenEl.checked = Boolean(character.hidden);
  }
  if (editInitiativeRollModeEl) {
    editInitiativeRollModeEl.value = normalizeInitiativeRollMode(character.initiativeRollMode, character.type);
  }
  if (typeof editCharacterDialogEl.showModal === "function") {
    editCharacterDialogEl.showModal();
  } else {
    editCharacterDialogEl.setAttribute("open", "open");
  }
}

function closeCharacterEditDialog() {
  state.editingCharacterId = null;
  if (typeof editCharacterDialogEl.close === "function") {
    editCharacterDialogEl.close();
  } else {
    editCharacterDialogEl.removeAttribute("open");
  }
}

function getPendingInitiativeInputs(view) {
  return (view?.pendingInputs || []).filter(
    (input) => input?.type === "roll" && input?.request?.kind === "initiative-roll"
  );
}

function getDueTimedEvents(view) {
  const currentRound = Number(view?.round || 0);
  if (currentRound <= 0) {
    return [];
  }
  return (view?.events || []).filter((event) => Number(event.dueRound) <= currentRound);
}

function getInteractivePendingInitiativeEntries(view) {
  return getPendingInitiativeInputs(view)
    .map((input) => {
      const character = getCharacterById(view, input.request.characterId);
      const detail = getCharacterDetail(character);
      const mode = normalizeInitiativeRollMode(detail?.initiativeRollMode, character?.type);
      if (!character || !detail || (mode !== "manual" && mode !== "pixels")) {
        return null;
      }
      return { input, character, detail, mode };
    })
    .filter(Boolean);
}

function isCharacterPendingInitiative(view, characterId) {
  return getPendingInitiativeInputs(view).some((input) => input.request.characterId === characterId);
}

function parsePromptNumber(value, min, max) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function requestManualInitiativeRoll(character) {
  const response = window.prompt(`Manueller 3W6-Wurf für ${character.name} eingeben (3-18).`, "10");
  if (response === null) {
    return null;
  }
  return parsePromptNumber(response, 3, 18);
}

function requestManualCriticalBonusRoll(character) {
  const response = window.prompt(`Kritischer Zusatz-W6 für ${character.name} eingeben (1-6).`, "1");
  if (response === null) {
    return null;
  }
  return parsePromptNumber(response, 1, 6);
}

async function resolvePendingManualInitiativeRolls() {
  const pendingInputs = getPendingInitiativeInputs(state.view);
  for (const input of pendingInputs) {
    const character = getCharacterById(state.view, input.request.characterId);
    const detail = getCharacterDetail(character);
    if (!character || !detail || detail.initiativeRollMode !== "manual") {
      continue;
    }

    const total = requestManualInitiativeRoll(character);
    if (total === null) {
      setStatus(`Manueller INI-Wurf abgebrochen: ${character.name}.`);
      break;
    }
    let critBonusRoll = null;
    if (total === 18) {
      critBonusRoll = requestManualCriticalBonusRoll(character);
      if (critBonusRoll === null) {
        setStatus(`Kritischer Zusatz-W6 abgebrochen: ${character.name}.`);
        break;
      }
    }
    await sendCommand({
      type: "resolve-initiative-roll",
      characterId: character.id,
      total,
      critBonusRoll
    });
  }
}

function getInitiativeDialogInputState(characterId) {
  const key = String(characterId);
  if (!state.initiativeDialogInputs[key]) {
    state.initiativeDialogInputs[key] = { total: "", critBonus: "" };
  }
  return state.initiativeDialogInputs[key];
}

function createInitiativeRollBadge(text, className = "") {
  const badge = document.createElement("span");
  badge.className = `pixels-roll-badge${className ? ` ${className}` : ""}`;
  badge.textContent = text;
  return badge;
}

function renderInitiativeRollDialog() {
  if (!initiativeRollListEl || !initiativeRollStatusEl || !initiativeRollTitleEl) {
    return;
  }

  const entries = getInteractivePendingInitiativeEntries(state.view);
  const dueEvents = getDueTimedEvents(state.view);
  if (!entries.length && !dueEvents.length) {
    initiativeRollListEl.innerHTML = "";
    initiativeRollTitleEl.textContent = "INI Würfelphase";
    initiativeRollStatusEl.textContent = "Keine offenen INI-Würfe.";
    state.initiativeDialogRequested = false;
    closeInitiativeRollDialog();
    return;
  }

  initiativeRollTitleEl.textContent = Number(state.view?.round || 0) > 1 ? "Nächste KR" : "Kampf starten";
  initiativeRollStatusEl.textContent = dueEvents.length
    ? "Fällige Ereignisse zuerst prüfen, danach manuelle Würfe eintragen und Pixels würfeln."
    : "Trage manuelle Würfe ein und würfle für Pixels die markierten Würfel.";
  initiativeRollListEl.innerHTML = "";

  for (const dueEvent of dueEvents) {
    const row = document.createElement("div");
    row.className = "pixels-roll-row pending";

    const head = document.createElement("div");
    head.className = "pixels-roll-row-head";
    const nameEl = document.createElement("strong");
    nameEl.textContent = dueEvent.description;
    head.appendChild(nameEl);

    const badgesEl = document.createElement("div");
    badgesEl.className = "pixels-roll-row-badges";
    badgesEl.appendChild(createInitiativeRollBadge("Ereignis"));
    badgesEl.appendChild(createInitiativeRollBadge(`KR ${dueEvent.dueRound}`));
    head.appendChild(badgesEl);
    row.appendChild(head);

    const statusEl = document.createElement("p");
    statusEl.className = "pixels-roll-row-status";
    statusEl.textContent = `Fällig seit Beginn von KR ${dueEvent.dueRound}.`;
    row.appendChild(statusEl);

    const detailEl = document.createElement("p");
    detailEl.className = "pixels-roll-row-detail";
    detailEl.textContent = "Nach Kenntnisnahme als erledigt markieren.";
    row.appendChild(detailEl);

    const controlsEl = document.createElement("div");
    controlsEl.className = "pixels-roll-row-controls";
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.textContent = "Erledigt";
    doneBtn.addEventListener("click", async () => {
      try {
        await performTrackedCombatAction(
          () => sendCommand({ type: "remove-event", eventId: dueEvent.id }),
          "Ereignis erledigt"
        );
      } catch (error) {
        setStatus(`Ereignis konnte nicht abgeschlossen werden: ${error.message}`);
      }
    });
    controlsEl.appendChild(doneBtn);
    row.appendChild(controlsEl);
    initiativeRollListEl.appendChild(row);
  }

  for (const entry of entries) {
    const { character, mode } = entry;
    const progress = (state.pixelsRollProgress || []).find((item) => item.characterId === character.id) || null;
    const row = document.createElement("div");
    row.className = `pixels-roll-row ${mode === "pixels" ? "waiting" : "pending"}`;

    const head = document.createElement("div");
    head.className = "pixels-roll-row-head";
    const nameEl = document.createElement("strong");
    nameEl.textContent = character.name;
    head.appendChild(nameEl);

    const badgesEl = document.createElement("div");
    badgesEl.className = "pixels-roll-row-badges";
    badgesEl.appendChild(createInitiativeRollBadge(mode === "manual" ? "Manuell" : "Pixels", mode));
    badgesEl.appendChild(createInitiativeRollBadge(character.type === "NPC" ? "NSC" : "SC"));
    head.appendChild(badgesEl);
    row.appendChild(head);

    const statusEl = document.createElement("p");
    statusEl.className = "pixels-roll-row-status";
    statusEl.textContent =
      mode === "manual"
        ? "3W6 eintragen und übernehmen."
        : progress?.collected?.length
          ? `Pixels-Wurf läuft: ${progress.collected.length}/${progress.requiredDice}`
          : "Warte auf Pixels-Wurf.";
    row.appendChild(statusEl);

    const detailEl = document.createElement("p");
    detailEl.className = "pixels-roll-row-detail";
    if (mode === "pixels") {
      detailEl.textContent = progress?.collected?.length
        ? progress.collected.map((item) => `${item.label}: ${item.value}`).join(" | ")
        : "Die zugewiesenen Pixels für diesen Charakter jetzt würfeln.";
    } else {
      detailEl.textContent = "Bei kritischer 18 zusätzlich den Krit-W6 eintragen.";
    }
    row.appendChild(detailEl);

    const controlsEl = document.createElement("div");
    controlsEl.className = "pixels-roll-row-controls";
    if (mode === "manual") {
      const inputState = getInitiativeDialogInputState(character.id);

      const totalWrap = document.createElement("label");
      totalWrap.className = "pixels-roll-input-wrap";
      totalWrap.textContent = "3W6";
      const totalInput = document.createElement("input");
      totalInput.type = "number";
      totalInput.min = "3";
      totalInput.max = "18";
      totalInput.step = "1";
      totalInput.placeholder = "3-18";
      totalInput.value = inputState.total;
      totalWrap.appendChild(totalInput);
      controlsEl.appendChild(totalWrap);

      const critWrap = document.createElement("label");
      critWrap.className = "pixels-roll-input-wrap";
      critWrap.textContent = "Krit-W6";
      const critInput = document.createElement("input");
      critInput.type = "number";
      critInput.min = "1";
      critInput.max = "6";
      critInput.step = "1";
      critInput.placeholder = "1-6";
      critInput.value = inputState.critBonus;
      critInput.disabled = String(totalInput.value).trim() !== "18";
      critWrap.appendChild(critInput);
      controlsEl.appendChild(critWrap);

      totalInput.addEventListener("input", () => {
        inputState.total = totalInput.value;
        critInput.disabled = String(totalInput.value).trim() !== "18";
      });
      critInput.addEventListener("input", () => {
        inputState.critBonus = critInput.value;
      });

      const submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.textContent = "Übernehmen";
      submitBtn.addEventListener("click", async () => {
        const total = parsePromptNumber(totalInput.value, 3, 18);
        if (total === null) {
          setStatus(`Ungültiger 3W6-Wert für ${character.name}.`);
          return;
        }
        let critBonusRoll = null;
        if (total === 18) {
          critBonusRoll = parsePromptNumber(critInput.value, 1, 6);
          if (critBonusRoll === null) {
            setStatus(`Ungültiger Krit-W6-Wert für ${character.name}.`);
            return;
          }
        }
        try {
          await sendCommand({
            type: "resolve-initiative-roll",
            characterId: character.id,
            total,
            critBonusRoll
          });
          delete state.initiativeDialogInputs[String(character.id)];
          setStatus(`INI-Wurf übernommen: ${character.name}.`);
        } catch (error) {
          setStatus(`INI-Wurf fehlgeschlagen: ${error.message}`);
        }
      });
      controlsEl.appendChild(submitBtn);
    }
    row.appendChild(controlsEl);
    initiativeRollListEl.appendChild(row);
  }

  if (state.initiativeDialogRequested || initiativeRollDialogEl?.open) {
    openInitiativeRollDialog();
  }
}

function renderTimedEvents() {
  if (!eventsEl) {
    return;
  }
  eventsEl.innerHTML = "";
  if (!state.view?.events?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Noch keine Ereignisse angelegt.";
    eventsEl.appendChild(empty);
    return;
  }

  for (const timedEvent of state.view.events) {
    const isDue = Number(state.view?.round || 0) > 0 && timedEvent.dueRound <= Number(state.view?.round || 0);
    const card = document.createElement("article");
    card.className = `event-card${isDue ? " due" : ""}`;

    const topLine = document.createElement("div");
    topLine.className = "character-topline";
    const title = document.createElement("h3");
    title.className = "character-name";
    title.textContent = timedEvent.description;
    topLine.appendChild(title);

    const dueBadge = document.createElement("span");
    dueBadge.className = "type-badge npc";
    dueBadge.textContent = isDue ? "fällig" : "Ereignis";
    topLine.appendChild(dueBadge);

    const entryActions = document.createElement("div");
    entryActions.className = "entry-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ghost";
    removeBtn.title = "Entfernen";
    removeBtn.textContent = "x";
    removeBtn.addEventListener("click", async () => {
      try {
        await performTrackedCombatAction(
          () => sendCommand({ type: "remove-event", eventId: timedEvent.id }),
          "Ereignis entfernen"
        );
        setStatus(`Ereignis entfernt: ${timedEvent.description}.`);
      } catch (error) {
        setStatus(`Ereignis konnte nicht entfernt werden: ${error.message}`);
      }
    });
    entryActions.appendChild(removeBtn);
    topLine.appendChild(entryActions);
    card.appendChild(topLine);

    const meta = document.createElement("p");
    meta.className = "character-meta";
    const parts = [`Erstellt in KR ${timedEvent.createdAtRound || 0}`];
    if (isDue) {
      parts.push(`fällig seit KR ${timedEvent.dueRound}`);
    } else {
      parts.push(`fällig zu Beginn von KR ${timedEvent.dueRound}`);
    }
    meta.innerHTML = isDue
      ? `${escapeHtml(parts[0])} | <span class="event-meta-strong">${escapeHtml(parts[1])}</span>`
      : escapeHtml(parts.join(" | "));
    card.appendChild(meta);

    eventsEl.appendChild(card);
  }
}

function renderView() {
  const view = state.view;
  if (!view) {
    turnOrderEl.innerHTML = "";
    charactersEl.innerHTML = "";
    roundStatusEl.textContent = "Kampfrunde: -";
    rawStateEl.textContent = "{}";
    renderLogs();
    renderImportExportPanel();
    renderBluetoothDevices();
    renderPixelsDevices();
    renderPixelsCharacterAssignments();
    renderPixelsMonitor();
    renderTimedEvents();
    renderInitiativeRollDialog();
    if (toggleAllPcSurprisedEl) {
      toggleAllPcSurprisedEl.checked = false;
      toggleAllPcSurprisedEl.indeterminate = false;
      toggleAllPcSurprisedEl.disabled = true;
    }
    if (toggleAllNpcSurprisedEl) {
      toggleAllNpcSurprisedEl.checked = false;
      toggleAllNpcSurprisedEl.indeterminate = false;
      toggleAllNpcSurprisedEl.disabled = true;
    }
    updateHistoryButtons();
    return;
  }

  const playerCharacters = getVisibleCharactersByType(view, "PC");
  const npcCharacters = getVisibleCharactersByType(view, "NPC");
  const syncBulkSurprisedToggle = (input, characters) => {
    if (!input) {
      return;
    }
    input.disabled = characters.length === 0;
    const surprisedCount = characters.filter((character) => Boolean(getCharacterDetail(character)?.surprised)).length;
    input.checked = characters.length > 0 && surprisedCount === characters.length;
    input.indeterminate = surprisedCount > 0 && surprisedCount < characters.length;
  };
  syncBulkSurprisedToggle(toggleAllPcSurprisedEl, playerCharacters);
  syncBulkSurprisedToggle(toggleAllNpcSurprisedEl, npcCharacters);

  turnOrderEl.innerHTML = "";
  roundStatusEl.textContent = `Kampfrunde: ${view.round || "-"}`;
  const turnGroups = getTurnGroups(view);
  if (!turnGroups.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Noch keine INI-Reihenfolge vorhanden.";
    turnOrderEl.appendChild(emptyItem);
  }
  for (const group of turnGroups) {
    const character = group.character;
    const trackerDetail = getCharacterDetail(character);
    const activeTurnEntryId = getActiveTurnEntryIdForCharacter(view, group.characterId);
    const item = document.createElement("li");
    item.className = `tracker-item ${character?.type === "NPC" ? "type-npc" : "type-pc"}${
      view.activeCharacterId === group.characterId ? " active" : ""
    }`;
    item.draggable = true;
    item.dataset.characterId = String(group.characterId);
    item.addEventListener("dragstart", (event) => {
      state.draggedTurnCharacterId = group.characterId;
      item.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(group.characterId));
      }
    });
    item.addEventListener("dragend", () => {
      state.draggedTurnCharacterId = null;
      item.classList.remove("dragging");
      item.classList.remove("drag-target");
    });
    item.addEventListener("dragover", (event) => {
      if (!state.draggedTurnCharacterId || state.draggedTurnCharacterId === group.characterId) {
        return;
      }
      event.preventDefault();
      item.classList.add("drag-target");
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-target");
    });
    item.addEventListener("drop", async (event) => {
      item.classList.remove("drag-target");
      const sourceId = state.draggedTurnCharacterId;
      state.draggedTurnCharacterId = null;
      if (!sourceId || sourceId === group.characterId) {
        return;
      }
      event.preventDefault();
      const orderedIds = moveIdBeforeTarget(
        turnGroups.map((turnGroup) => turnGroup.characterId),
        sourceId,
        group.characterId
      );
      try {
        await performTrackedCombatAction(
          () => sendCommand({ type: "reorder-turn-groups", characterIds: orderedIds }),
          "INI-Reihenfolge ändern"
        );
      } catch (error) {
        setStatus(`INI-Reihenfolge konnte nicht geändert werden: ${error.message}`);
      }
    });
    item.addEventListener("click", async () => {
      if (view.activeCharacterId === group.characterId) {
        return;
      }
      try {
        await performTrackedCombatAction(
          () => sendCommand({ type: "activate-character", characterId: group.characterId }),
          "Aktiver Charakter"
        );
      } catch (error) {
        setStatus(`Aktivieren fehlgeschlagen: ${error.message}`);
      }
    });

    const topRow = document.createElement("div");
    topRow.className = "tracker-row tracker-row-top";

    const topMain = document.createElement("div");
    topMain.className = "tracker-top-main";

    const initiativeBadge = document.createElement("span");
    initiativeBadge.className = `type-badge initiative-badge ${character?.type === "NPC" ? "npc" : "pc"}`;
    initiativeBadge.textContent = String(group.groupInitiative);
    topMain.appendChild(initiativeBadge);

    const typeBadge = document.createElement("span");
    typeBadge.className = `type-badge ${character?.type === "NPC" ? "npc" : "pc"}`;
    typeBadge.textContent = character?.type === "NPC" ? "NSC" : "SC";
    topMain.appendChild(typeBadge);

    const nameStrong = document.createElement("strong");
    nameStrong.className = "tracker-name";
    nameStrong.textContent = character?.name || entry.characterId;
    topMain.appendChild(nameStrong);

    topRow.appendChild(topMain);

    const topHints = document.createElement("div");
    topHints.className = "tracker-top-hints";
    if (group.critical === "success") {
      const chip = document.createElement("span");
      chip.className = "tracker-chip critical";
      chip.textContent = "krit. Erfolg";
      topHints.appendChild(chip);
    } else if (group.critical === "failure") {
      const chip = document.createElement("span");
      chip.className = "tracker-chip failure";
      chip.textContent = "krit. Fehlschlag";
      topHints.appendChild(chip);
    }
    if (trackerDetail) {
      const damagePenalty = computeDamagePenalty(trackerDetail);
      if (damagePenalty.qm > 0 || damagePenalty.bew > 0) {
        const chip = document.createElement("span");
        chip.className = "tracker-chip failure";
        chip.textContent = `QM/BEW -${damagePenalty.qm}/-${damagePenalty.bew}`;
        topHints.appendChild(chip);
      }
      if ((trackerDetail.unfreeDefensePenalty || 0) > 0) {
        const chip = document.createElement("span");
        chip.className = "tracker-chip failure";
        chip.textContent = `Nächste Parade -${trackerDetail.unfreeDefensePenalty}`;
        topHints.appendChild(chip);
      }
    }
    topRow.appendChild(topHints);
    item.appendChild(topRow);

    const bottomRow = document.createElement("div");
    bottomRow.className = "tracker-row tracker-row-bottom";

    const actionsLeft = document.createElement("div");
    actionsLeft.className = "tracker-actions-left";
    const actionChipWrap = document.createElement("span");
    actionChipWrap.className = "action-chip-wrap";
    for (const turnType of ["Bonus", "Main", "Move"]) {
      const entry = group.entries.find((candidate) => candidate.turnType === turnType);
      if (!entry) {
        continue;
      }
      const chipBtn = document.createElement("button");
      chipBtn.type = "button";
      chipBtn.className = `action-chip ${entry.used ? "used" : activeTurnEntryId === entry.id ? "active" : "pending"}`;
      chipBtn.textContent = getTurnTypeLabel(entry.turnType);
      chipBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
          await performTrackedCombatAction(
            () => sendCommand({ type: "toggle-turn-entry-used", entryId: entry.id }),
            getTurnTypeLabel(entry.turnType)
          );
        } catch (error) {
          setStatus(`${getTurnTypeLabel(entry.turnType)} fehlgeschlagen: ${error.message}`);
        }
      });
      actionChipWrap.appendChild(chipBtn);

      if (entry.turnType === "Main" && trackerDetail) {
        const paradeBtn = document.createElement("button");
        paradeBtn.type = "button";
        paradeBtn.className = "action-chip parade-action-btn";
        paradeBtn.textContent = `Parade (${trackerDetail.paradeClickCount || 0})`;
        paradeBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          try {
            await performTrackedCombatAction(
              () => sendCommand({ type: "trigger-parade", characterId: group.characterId }),
              "Parade"
            );
          } catch (error) {
            setStatus(`Parade fehlgeschlagen: ${error.message}`);
          }
        });
        actionChipWrap.appendChild(paradeBtn);
      }
    }

    actionsLeft.appendChild(actionChipWrap);
    bottomRow.appendChild(actionsLeft);

    const actionsRight = document.createElement("div");
    actionsRight.className = "tracker-actions-right";
    if (trackerDetail) {
      if (character?.specialAbility) {
        const abilityBtn = document.createElement("button");
        abilityBtn.type = "button";
        abilityBtn.className = `action-chip ability-action-btn${trackerDetail.specialAbilityActive ? " active" : ""}`;
        abilityBtn.textContent = getSpecialAbilityLabel(character.specialAbility);
        abilityBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          try {
            await performTrackedCombatAction(
              () => sendCommand({ type: "toggle-special-ability", characterId: group.characterId }),
              "Charaktervorteil"
            );
          } catch (error) {
            setStatus(`Ch.-Vorteil fehlgeschlagen: ${error.message}`);
          }
        });
        actionsRight.appendChild(abilityBtn);
      }

      const dazedBtn = document.createElement("button");
      dazedBtn.type = "button";
      dazedBtn.className = "action-chip";
      dazedBtn.textContent = "Ben.";
      dazedBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
          await performTrackedCombatAction(
            () => sendCommand({ type: "apply-dazed", characterId: group.characterId }),
            "Benommenheit"
          );
        } catch (error) {
          setStatus(`Benommenheit fehlgeschlagen: ${error.message}`);
        }
      });
      actionsRight.appendChild(dazedBtn);
    }
    bottomRow.appendChild(actionsRight);

    item.appendChild(bottomRow);
    turnOrderEl.appendChild(item);
  }

  charactersEl.innerHTML = "";
  const rosterBuckets = getRosterCharacterBuckets(view);
  const visibleRosterCharacters = [...rosterBuckets.visible.PC, ...rosterBuckets.visible.NPC];
  const hiddenRosterCharacters = [...rosterBuckets.hidden.PC, ...rosterBuckets.hidden.NPC];
  const renderRosterSection = (characters, options = {}) => {
    if (!characters.length && !options.emptyMessage) {
      return;
    }
    const section = document.createElement("section");
    section.className = `roster-section${options.hidden ? " roster-section-hidden" : ""}`;

    if (options.title) {
      const sectionTitle = document.createElement("h3");
      sectionTitle.className = "roster-section-title";
      sectionTitle.textContent = options.title;
      section.appendChild(sectionTitle);
    }

    if (options.dropHint) {
      const hint = document.createElement("p");
      hint.className = "character-meta";
      hint.textContent = options.dropHint;
      section.appendChild(hint);
    }

    section.addEventListener("dragover", (event) => {
      if (!state.draggedRosterCharacterId) {
        return;
      }
      event.preventDefault();
      section.classList.add("drag-target");
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });
    section.addEventListener("dragleave", () => {
      section.classList.remove("drag-target");
    });
    section.addEventListener("drop", async (event) => {
      section.classList.remove("drag-target");
      const sourceId = state.draggedRosterCharacterId;
      state.draggedRosterCharacterId = null;
      if (!sourceId) {
        return;
      }
      event.preventDefault();
      try {
        await moveCharacterToHiddenState(sourceId, Boolean(options.hidden));
      } catch (error) {
        setStatus(`Charakterstatus konnte nicht geändert werden: ${error.message}`);
      }
    });

    if (!characters.length && options.emptyMessage) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = options.emptyMessage;
      section.appendChild(empty);
      charactersEl.appendChild(section);
      return;
    }

    for (const character of characters) {
    const characterDetail = getCharacterDetail(character);
    const card = document.createElement("article");
    card.className = `character-card type-${character.type === "NPC" ? "npc" : "pc"}${character.isOwned ? " owned" : ""}${
      view.activeCharacterId === character.id ? " active" : ""
    }${isCharacterMinimized(character.id) ? " minimized" : ""}${isCharacterHidden(character) ? " hidden-character" : ""}`;
    card.draggable = true;
    card.dataset.characterId = String(character.id);
    card.addEventListener("dragstart", (event) => {
      state.draggedRosterCharacterId = character.id;
      card.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(character.id));
      }
    });
    card.addEventListener("dragend", () => {
      state.draggedRosterCharacterId = null;
      card.classList.remove("dragging");
      card.classList.remove("drag-target");
    });
    card.addEventListener("dragover", (event) => {
      if (!state.draggedRosterCharacterId || state.draggedRosterCharacterId === character.id) {
        return;
      }
      event.preventDefault();
      card.classList.add("drag-target");
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-target");
    });
    card.addEventListener("drop", async (event) => {
      card.classList.remove("drag-target");
      const sourceId = state.draggedRosterCharacterId;
      state.draggedRosterCharacterId = null;
      if (!sourceId || sourceId === character.id) {
        return;
      }
      event.preventDefault();
      const sourceCharacter = getCharacterById(view, sourceId);
      const sourceHidden = isCharacterHidden(sourceCharacter);
      const targetHidden = isCharacterHidden(character);
      if (sourceHidden !== targetHidden) {
        try {
          await moveCharacterToHiddenState(sourceId, targetHidden);
        } catch (error) {
          setStatus(`Charakterstatus konnte nicht geändert werden: ${error.message}`);
        }
        return;
      }
      const orderedIds = moveIdBeforeTarget(
        (view.characters || []).map((rosterCharacter) => rosterCharacter.id),
        sourceId,
        character.id
      );
      try {
        await performTrackedCombatAction(
          () => sendCommand({ type: "reorder-characters", characterIds: orderedIds }),
          "Charakter-Reihenfolge ändern"
        );
      } catch (error) {
        setStatus(`Charakter-Reihenfolge konnte nicht geändert werden: ${error.message}`);
      }
    });

    const topLine = document.createElement("div");
    topLine.className = "character-topline";

    const title = document.createElement("h3");
    title.className = "character-name";
    title.textContent = character.name;
    topLine.appendChild(title);

    const typeBadge = document.createElement("span");
    typeBadge.className = `type-badge ${character.type === "PC" ? "pc" : "npc"}`;
    typeBadge.textContent = character.type === "PC" ? "SC" : "NSC";
    topLine.appendChild(typeBadge);

    if (isCharacterHidden(character)) {
      const hiddenBadge = document.createElement("span");
      hiddenBadge.className = "type-badge";
      hiddenBadge.textContent = "Ausgeblendet";
      topLine.appendChild(hiddenBadge);
    }

    if (characterDetail) {
      const surpriseToggle = document.createElement("label");
      surpriseToggle.className = "panel-toggle";
      const surpriseInput = document.createElement("input");
      surpriseInput.type = "checkbox";
      surpriseInput.checked = Boolean(characterDetail.surprised);
      surpriseInput.addEventListener("change", async () => {
        await performTrackedCombatAction(
          () =>
            sendCommand({
              type: "toggle-surprised",
              characterId: character.id,
              surprised: surpriseInput.checked
            }),
          "Überrascht"
        );
      });
      const surpriseText = document.createElement("span");
      surpriseText.textContent = "Überr.";
      surpriseToggle.append(surpriseInput, surpriseText);
      topLine.appendChild(surpriseToggle);

      const incapacitatedToggle = document.createElement("label");
      incapacitatedToggle.className = "panel-toggle";
      const incapacitatedInput = document.createElement("input");
      incapacitatedInput.type = "checkbox";
      incapacitatedInput.checked = Boolean(characterDetail.incapacitated);
      incapacitatedInput.addEventListener("change", async () => {
        try {
          await performTrackedCombatAction(
            () =>
              sendCommand({
                type: "toggle-incapacitated",
                characterId: character.id,
                incapacitated: incapacitatedInput.checked
              }),
            "Aktionsunfähig"
          );
        } catch (error) {
          setStatus(`Aktionsunfähig konnte nicht geändert werden: ${error.message}`);
        }
      });
      const incapacitatedText = document.createElement("span");
      incapacitatedText.textContent = "Akt.-unf.";
      incapacitatedToggle.append(incapacitatedInput, incapacitatedText);
      topLine.appendChild(incapacitatedToggle);
    }

    const entryActions = document.createElement("div");
    entryActions.className = "entry-actions";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ghost";
    editBtn.title = "Bearbeiten";
    editBtn.textContent = "⚙";
    editBtn.addEventListener("click", () => {
      openCharacterEditDialog(character);
    });
    entryActions.appendChild(editBtn);

    const minimizeBtn = document.createElement("button");
    minimizeBtn.type = "button";
    minimizeBtn.className = "ghost";
    minimizeBtn.title = isCharacterMinimized(character.id) ? "Ausklappen" : "Minimieren";
    minimizeBtn.textContent = isCharacterMinimized(character.id) ? "+" : "−";
    minimizeBtn.addEventListener("click", () => {
      toggleCharacterMinimized(character.id);
    });
    entryActions.appendChild(minimizeBtn);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ghost";
    removeBtn.title = "Entfernen";
    removeBtn.textContent = "x";
    removeBtn.addEventListener("click", async () => {
      const confirmed = await openWarningDialog(`Soll ${character.name} wirklich entfernt werden?`, "Charakter entfernen");
      if (!confirmed) {
        return;
      }
      try {
        await performTrackedCombatAction(
          () => sendCommand({ type: "remove-character", characterId: character.id }),
          "Charakter entfernen"
        );
        state.minimizedCharacterIds = state.minimizedCharacterIds.filter((entry) => entry !== character.id);
        setStatus(`Charakter entfernt: ${character.name}.`);
      } catch (error) {
        setStatus(`Charakter konnte nicht entfernt werden: ${error.message}`);
      }
    });
    entryActions.appendChild(removeBtn);
    topLine.appendChild(entryActions);

    card.appendChild(topLine);

    const meta = document.createElement("p");
    meta.className = "character-meta";
    const specialAbilityLabel = getSpecialAbilityLabel(character.specialAbility);
    const damagePenalty = characterDetail ? computeDamagePenalty(characterDetail) : { qm: 0, bew: 0 };
    const dazedPenalty = characterDetail && isCharacterDazed(characterDetail, view.round) ? 3 : 0;
    const effectiveQmPenalty = damagePenalty.qm + dazedPenalty;
    const shouldShowDamagePenalty =
      Boolean(characterDetail) &&
      (dazedPenalty > 0 || normalizeDamageMonitorMarks(characterDetail.damageMonitorMarks).some((active) => active));
    const unfreeDefensePenalty = Math.max(0, Math.round(Number(characterDetail?.unfreeDefensePenalty) || 0));
    const penaltyTexts = [];
    const metaBits = [];
    if (characterDetail) {
      metaBits.push(`INI ${characterDetail.initiativeBase ?? "-"}`);
      let rollText = `3w6=${characterDetail.lastRoll ?? "-"}, ges.=${character.totalInitiative ?? "-"}`;
      if (specialAbilityLabel) {
        rollText += ` | Ch.-Vorteil=${specialAbilityLabel}`;
      }
      metaBits.push(rollText);
      if (isCharacterDazed(characterDetail, view.round)) {
        metaBits.push(`Ben. bis Ende KR ${characterDetail.dazedUntilRound}`);
      }
    } else {
      metaBits.push(`INI ${character.initiativeBase ?? "-"}`);
      let rollText = `3w6=-, ges.=${character.totalInitiative ?? "-"}`;
      if (specialAbilityLabel) {
        rollText += ` | Ch.-Vorteil=${specialAbilityLabel}`;
      }
      metaBits.push(rollText);
    }
    if (shouldShowDamagePenalty) {
      penaltyTexts.push(`QM/BEW: -${effectiveQmPenalty}/-${damagePenalty.bew}`);
    }
    if (unfreeDefensePenalty > 0) {
      penaltyTexts.push(`Nächste Parade -${unfreeDefensePenalty}`);
    }
    if (penaltyTexts.length) {
      meta.innerHTML = `${escapeHtml(metaBits.join(" | "))} | <span class="character-meta-penalty">${escapeHtml(
        penaltyTexts.join(" | ")
      )}</span>`;
    } else {
      meta.textContent = metaBits.join(" | ");
    }
    card.appendChild(meta);

    if (characterDetail) {
      const damageMonitor = document.createElement("details");
      damageMonitor.className = "damage-monitor";
      const damageSummary = document.createElement("summary");
      damageSummary.className = "damage-monitor-summary";
      damageSummary.textContent = "Schadensmonitor";
      damageMonitor.appendChild(damageSummary);

      const damageWrap = document.createElement("div");
      damageWrap.className = "damage-monitor-wrap";
      const damageTable = document.createElement("table");
      damageTable.className = "damage-monitor-table";
      const colgroup = document.createElement("colgroup");
      const labelCol = document.createElement("col");
      labelCol.className = "damage-label-col";
      colgroup.appendChild(labelCol);
      for (let index = 0; index < 16; index += 1) {
        const col = document.createElement("col");
        col.className = "damage-data-col";
        colgroup.appendChild(col);
      }
      damageTable.appendChild(colgroup);

      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      const emptyHead = document.createElement("th");
      headRow.appendChild(emptyHead);
      const groupedHeaders = [
        { label: "Kratzer", span: 5 },
        { label: "LW", span: 3 },
        { label: "MW", span: 3 },
        { label: "SW", span: 3 }
      ];
      for (const header of groupedHeaders) {
        const th = document.createElement("th");
        th.colSpan = header.span;
        th.textContent = header.label;
        headRow.appendChild(th);
      }
      const twHead = document.createElement("th");
      twHead.className = "damage-single-head";
      twHead.textContent = "TW";
      headRow.appendChild(twHead);
      const tdHead = document.createElement("th");
      tdHead.className = "damage-single-head";
      tdHead.textContent = "T†";
      headRow.appendChild(tdHead);
      thead.appendChild(headRow);
      damageTable.appendChild(thead);

      const tbody = document.createElement("tbody");
      const woundRow = document.createElement("tr");
      const woundLabel = document.createElement("th");
      woundLabel.textContent = "Wunden";
      woundRow.appendChild(woundLabel);
      const marks = normalizeDamageMonitorMarks(characterDetail.damageMonitorMarks);
      for (let index = 0; index < 16; index += 1) {
        const woundCell = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.className = "damage-wound-input";
        checkbox.type = "checkbox";
        checkbox.checked = marks[index];
        checkbox.addEventListener("change", async () => {
          try {
            await performTrackedCombatAction(
              () =>
                sendCommand({
                  type: "set-damage-mark",
                  characterId: character.id,
                  index,
                  checked: checkbox.checked
                }),
              "Schadensmonitor"
            );
          } catch (error) {
            setStatus(`Schadensmonitor fehlgeschlagen: ${error.message}`);
          }
        });
        woundCell.appendChild(checkbox);
        woundRow.appendChild(woundCell);
      }
      tbody.appendChild(woundRow);

      const qmRow = document.createElement("tr");
      const qmLabel = document.createElement("th");
      qmLabel.textContent = "QM";
      qmRow.appendChild(qmLabel);
      for (const value of DAMAGE_QM_VALUES) {
        const cell = document.createElement("td");
        cell.textContent = value;
        qmRow.appendChild(cell);
      }
      tbody.appendChild(qmRow);

      const bewRow = document.createElement("tr");
      const bewLabel = document.createElement("th");
      bewLabel.textContent = "BEW";
      bewRow.appendChild(bewLabel);
      for (const value of DAMAGE_BEW_VALUES) {
        const cell = document.createElement("td");
        cell.textContent = value;
        bewRow.appendChild(cell);
      }
      tbody.appendChild(bewRow);

      const incapRow = document.createElement("tr");
      const incapLabel = document.createElement("th");
      incapLabel.textContent = "Aktionsunfähig";
      incapRow.appendChild(incapLabel);
      const incapCells = [
        { text: "(25)\u00b9", span: 5 },
        { text: "30", span: 3 },
        { text: "35", span: 3 },
        { text: "40", span: 3 },
        { text: "A", span: 1 },
        { text: "A", span: 1 }
      ];
      for (const cellData of incapCells) {
        const cell = document.createElement("td");
        cell.colSpan = cellData.span;
        cell.textContent = cellData.text;
        incapRow.appendChild(cell);
      }
      tbody.appendChild(incapRow);

      damageTable.appendChild(tbody);
      damageWrap.appendChild(damageTable);
      const damageNote = document.createElement("p");
      damageNote.className = "damage-monitor-note";
      damageNote.textContent = "Anmerkungen: ¹ Nur bei Kopftreffern, † der Charakter stirbt am Ende der nächsten KR.";
      damageWrap.appendChild(damageNote);
      damageMonitor.appendChild(damageWrap);
      card.appendChild(damageMonitor);
    }

      section.appendChild(card);
    }

    charactersEl.appendChild(section);
  };

  renderRosterSection(visibleRosterCharacters, {
    emptyMessage: "Noch keine sichtbaren Charaktere/NSC.",
    hidden: false,
    dropHint: "Charaktere hierher ziehen, um sie im aktiven Kampf anzuzeigen."
  });
  renderRosterSection(hiddenRosterCharacters, {
    title: "Ausgeblendet",
    emptyMessage: "Keine ausgeblendeten Charaktere.",
    hidden: true,
    dropHint: "Ausgeblendete Charaktere erscheinen hier und werden bei der INI ignoriert."
  });

  startRoundBtn.disabled = false;
  startRoundBtn.textContent = Number(view.round || 0) > 0 ? "Nächste KR" : "Kampf starten";
  activateCharacterUpBtn.disabled = !(view.turnEntries || []).length;
  activateCharacterDownBtn.disabled = !(view.turnEntries || []).length;
  rawStateEl.textContent = JSON.stringify(view, null, 2);
  renderLogs();
  renderImportExportPanel();
  renderBluetoothDevices();
  renderPixelsDevices();
  renderPixelsCharacterAssignments();
  renderPixelsMonitor();
  renderTimedEvents();
  renderInitiativeRollDialog();
  updateHistoryButtons();
}

function renderBluetoothDevices() {
  bluetoothDevicesEl.innerHTML = "";
  if (!state.session || state.session.role !== "gm") {
    const item = document.createElement("li");
    item.textContent = "Bluetooth-Verwaltung ist nur im Spielleiter-Login sichtbar.";
    bluetoothDevicesEl.appendChild(item);
    return;
  }

  if (!state.bluetoothDevices.length) {
    const item = document.createElement("li");
    item.textContent = "Noch keine Bluetooth-Geräte geladen.";
    bluetoothDevicesEl.appendChild(item);
    return;
  }

  for (const device of state.bluetoothDevices) {
    const item = document.createElement("li");
    item.className = "compact-device-item";
    const selectedPixel = (state.selectedPixelsDevices || []).find((entry) => entry.address === device.address);
    const title = document.createElement("strong");
    title.className = "compact-device-name";
    title.textContent = device.name || device.address;
    item.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "device-actions compact-device-actions";

    const selectPixelsBtn = document.createElement("button");
    selectPixelsBtn.type = "button";
    selectPixelsBtn.className = "compact-device-button";
    selectPixelsBtn.textContent = selectedPixel ? "Gemerkt" : "Merken";
    selectPixelsBtn.addEventListener("click", async () => {
      try {
        const payload = await requestJson("/api/pixels/selected", {
          method: "POST",
          body: JSON.stringify({
            address: device.address,
            name: device.name,
            selected: !selectedPixel
          })
        });
        state.selectedPixelsDevices = payload.selectedDevices || [];
        renderBluetoothDevices();
        await loadPixelsDevices();
        setStatus(`Pixels-Auswahl für ${device.name} ${selectedPixel ? "entfernt" : "gespeichert"}.`);
      } catch (error) {
        setStatus(`Pixels-Auswahl fehlgeschlagen: ${error.message}`);
      }
    });
    actions.appendChild(selectPixelsBtn);

    item.appendChild(actions);
    bluetoothDevicesEl.appendChild(item);
  }
}

function renderPixelsDevices() {
  pixelsDevicesEl.innerHTML = "";
  if (!state.session || state.session.role !== "gm") {
    const item = document.createElement("li");
    item.textContent = "Pixels-Steuerung ist nur im Spielleiter-Login sichtbar.";
    pixelsDevicesEl.appendChild(item);
    return;
  }

  if (!state.pixelsDevices.length) {
    const item = document.createElement("li");
    item.textContent = "Noch keine als Pixels markierten BLE-Geräte geladen.";
    pixelsDevicesEl.appendChild(item);
    return;
  }

  for (const device of state.pixelsDevices) {
    const item = document.createElement("li");
    const assignment = (state.pixelsAssignments || []).find((entry) => entry.address === device.address);

    const title = document.createElement("strong");
    title.textContent = `${device.name} (${device.address})`;
    item.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "character-meta";
    const activeMonitor = (state.pixelsMonitor?.monitors || []).find((entry) => entry.address === device.address);
    const assignmentText = assignment?.characterId
      ? ` | Zuordnung: ${
          (state.view?.characters || []).find((entry) => entry.id === assignment.characterId)?.name || assignment.characterId
        } / Wuerfel ${assignment.slot}`
      : "";
    const effectiveConnected = Boolean(device.effectiveConnected ?? (device.connected || device.gattReady));
    meta.textContent =
      `Verbunden: ${effectiveConnected ? "ja" : "nein"} | Bereit: ${device.gattReady ? "ja" : "nein"} | Verfuegbar: ${device.available ? "ja" : "nein"} | BlueZ verbunden: ${device.connected ? "ja" : "nein"} | Gepairt: ${device.paired ? "ja" : "nein"} | Protokoll: ${device.protocol} | Pixels-Kandidat: ${device.pixelsLikely ? "ja" : "nein"} | Watch: ${activeMonitor?.status || "aus"}${assignmentText}`;
    item.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "device-actions";

    const connectBtn = document.createElement("button");
    connectBtn.type = "button";
    connectBtn.textContent = "Verbinden";
    connectBtn.disabled = effectiveConnected;
    connectBtn.addEventListener("click", async () => {
      try {
        setStatus(`Verbinde ${device.name}...`);
        const payload = await requestJson("/api/bluetooth/connect", {
          method: "POST",
          body: JSON.stringify({ address: device.address })
        });
        await loadBluetoothDevices();
        await loadPixelsDevices();
        const refreshedDevice = (state.pixelsDevices || []).find((entry) => entry.address === device.address);
        const debug = payload.device?.debug;
        const debugSuffix = debug
          ? ` | pair: ${debug.pairOutput || "-"} | trust: ${debug.trustOutput || "-"} | connect: ${debug.connectOutput || "-"}`
          : "";
        const readiness = refreshedDevice?.gattReady ? " bereit." : " noch nicht bereit.";
        setStatus(`${device.name} verbunden oder Pair/Trust versucht; Pixels${readiness}${debugSuffix}`);
      } catch (error) {
        setStatus(`Verbinden fehlgeschlagen: ${error.message}`);
      }
    });
    actions.appendChild(connectBtn);

    const disconnectBtn = document.createElement("button");
    disconnectBtn.type = "button";
    disconnectBtn.textContent = "Trennen";
    disconnectBtn.disabled = !effectiveConnected;
    disconnectBtn.addEventListener("click", async () => {
      try {
        await requestJson("/api/bluetooth/disconnect", {
          method: "POST",
          body: JSON.stringify({ address: device.address })
        });
        await loadBluetoothDevices();
        await loadPixelsDevices();
        setStatus(`${device.name} getrennt.`);
      } catch (error) {
        setStatus(`Trennen fehlgeschlagen: ${error.message}`);
      }
    });
    actions.appendChild(disconnectBtn);

    const identifyBtn = document.createElement("button");
    identifyBtn.type = "button";
    identifyBtn.textContent = "Identifizieren";
    identifyBtn.disabled = false;
    identifyBtn.addEventListener("click", async () => {
      try {
        const payload = await requestJson("/api/pixels/blink", {
          method: "POST",
          body: JSON.stringify({
            address: device.address,
            color: "#00ff00",
            count: 1,
            duration: 420,
            loopCount: 1
          })
        });
        setStatus(
          `Pixels-Test an ${device.name} gesendet. | path: ${payload.device?.writeCharacteristicPath || "-"} | hex: ${payload.device?.requestHex || "-"}`
        );
      } catch (error) {
        setStatus(`Pixels-Test fehlgeschlagen: ${error.message}`);
      }
    });
    actions.appendChild(identifyBtn);

    const watchBtn = document.createElement("button");
    watchBtn.type = "button";
    watchBtn.textContent = activeMonitor ? "Watch stoppen" : "Watch starten";
    watchBtn.disabled = false;
    watchBtn.addEventListener("click", async () => {
      try {
        await requestJson(activeMonitor ? "/api/pixels/watch/stop" : "/api/pixels/watch/start", {
          method: "POST",
          body: JSON.stringify({ address: device.address })
        });
        await loadPixelsMonitor();
        await loadPixelsDevices();
        setStatus(`Pixels-Watch für ${device.name} ${activeMonitor ? "gestoppt" : "gestartet"}.`);
      } catch (error) {
        setStatus(`Pixels-Watch fehlgeschlagen: ${error.message}`);
      }
    });
    actions.appendChild(watchBtn);

    item.appendChild(actions);

    if (device.writeCharacteristicPath || device.notifyCharacteristicPath) {
      const detail = document.createElement("p");
      detail.className = "device-path";
      detail.textContent =
        `Write: ${device.writeCharacteristicPath || "-"} | Notify: ${device.notifyCharacteristicPath || "-"}`;
      item.appendChild(detail);
    }

    pixelsDevicesEl.appendChild(item);
  }
}

function buildPixelsDeviceSelect(slot, selectedAddress = "") {
  const select = document.createElement("select");
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = `W${slot} zuordnen`;
  select.appendChild(emptyOption);

  for (const device of state.selectedPixelsDevices || []) {
    const option = document.createElement("option");
    option.value = device.address;
    option.textContent = device.name || device.address;
    select.appendChild(option);
  }

  select.value = selectedAddress || "";
  return select;
}

function buildPixelsSingleDeviceSelect(label, selectedAddress = "") {
  const select = document.createElement("select");
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = label;
  select.appendChild(emptyOption);

  for (const device of state.selectedPixelsDevices || []) {
    const option = document.createElement("option");
    option.value = device.address;
    option.textContent = device.name || device.address;
    select.appendChild(option);
  }

  select.value = selectedAddress || "";
  return select;
}

function getReservedPixelAddresses(exclusions = []) {
  const excludedSet = new Set(exclusions.filter(Boolean));
  const reserved = new Set();

  for (const assignment of state.pixelsAssignments || []) {
    if (!excludedSet.has(assignment.address)) {
      reserved.add(assignment.address);
    }
  }

  for (const address of normalizeSharedSet(state.pixelsConfig?.sharedSet)) {
    if (address && !excludedSet.has(address)) {
      reserved.add(address);
    }
  }

  return reserved;
}

function getSharedReservedPixelAddresses(exclusions = []) {
  const excludedSet = new Set(exclusions.filter(Boolean));
  const reserved = new Set();
  for (const address of normalizeSharedSet(state.pixelsConfig?.sharedSet)) {
    if (address && !excludedSet.has(address)) {
      reserved.add(address);
    }
  }
  return reserved;
}

function applyPixelSelectAvailability(selectEntries, characterId) {
  for (const currentEntry of selectEntries) {
    const currentValue = currentEntry.select.value || "";
    const siblingValues = selectEntries
      .filter((entry) => entry !== currentEntry)
      .map((entry) => entry.select.value)
      .filter(Boolean);

    const reserved = getReservedPixelAddresses([
      currentValue,
      ...siblingValues,
      ...(state.pixelsAssignments || [])
        .filter((assignment) => assignment.characterId === characterId)
        .map((assignment) => assignment.address)
    ]);

    for (const option of currentEntry.select.options) {
      if (!option.value) {
        option.disabled = false;
        continue;
      }

      const usedInCurrentCharacter = siblingValues.includes(option.value);
      const usedElsewhere = reserved.has(option.value) && option.value !== currentValue;
      option.disabled = usedInCurrentCharacter || usedElsewhere;
    }
  }
}

function renderPixelsCharacterAssignments() {
  pixelsCharacterAssignmentsEl.innerHTML = "";
  if (!state.session || state.session.role !== "gm") {
    return;
  }
  const pixelsMode = normalizePixelsMode(state.pixelsConfig?.mode);
  if (pixelsModeSelectEl) {
    pixelsModeSelectEl.value = pixelsMode;
  }
  if (pixelsModeHelpEl) {
    pixelsModeHelpEl.textContent = getPixelsModeDescription(pixelsMode);
  }

  const playerCharacters = (state.view?.characters || []).filter((character) => character.type === "PC");
  if (!playerCharacters.length) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Keine SCs geladen.";
    pixelsCharacterAssignmentsEl.appendChild(note);
    return;
  }

  if (!(state.selectedPixelsDevices || []).length) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Noch keine BLE-Geraete als Pixels gemerkt.";
    pixelsCharacterAssignmentsEl.appendChild(note);
    return;
  }

  if (pixelsMode === PIXELS_MODE.SHARED_SET_3) {
    const row = document.createElement("article");
    row.className = "character-card";

    const title = document.createElement("strong");
    title.textContent = "Gemeinsames Set";
    row.appendChild(title);

    const orderHint = document.createElement("p");
    orderHint.className = "hint";
    orderHint.textContent = `Reihenfolge: ${playerCharacters.map((character) => character.name).join(" → ")}`;
    row.appendChild(orderHint);

    const controls = document.createElement("div");
    controls.className = "device-actions";
    const slotSelections = [];
    const sharedSet = normalizeSharedSet(state.pixelsConfig?.sharedSet);
    for (const slot of [1, 2, 3]) {
      const select = buildPixelsDeviceSelect(slot, sharedSet[slot - 1] || "");
      select.addEventListener("change", () => {
        for (const currentEntry of slotSelections) {
          const currentValue = currentEntry.select.value || "";
          const siblingValues = slotSelections
            .filter((entry) => entry !== currentEntry)
            .map((entry) => entry.select.value)
            .filter(Boolean);
          for (const option of currentEntry.select.options) {
            if (!option.value) {
              option.disabled = false;
              continue;
            }
            const usedInSharedSet = siblingValues.includes(option.value);
            option.disabled = usedInSharedSet && option.value !== currentValue;
          }
        }
      });
      slotSelections.push({ slot, select });
      controls.appendChild(select);
    }
    slotSelections[0]?.select.dispatchEvent(new Event("change"));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Zuordnungen speichern";
    saveBtn.addEventListener("click", async () => {
      try {
        const sharedSetPayload = slotSelections.map((entry) => entry.select.value || null);
        const payload = await requestJson("/api/pixels/config", {
          method: "POST",
          body: JSON.stringify({
            mode: pixelsMode,
            sharedSet: sharedSetPayload
          })
        });
        state.pixelsConfig = {
          mode: normalizePixelsMode(payload?.config?.mode),
          sharedSet: normalizeSharedSet(payload?.config?.sharedSet)
        };
        renderPixelsCharacterAssignments();
        setStatus("Gemeinsames Pixels-Set gespeichert.");
      } catch (error) {
        setStatus(`Pixels-Zuordnungen fehlgeschlagen: ${error.message}`);
      }
    });
    controls.appendChild(saveBtn);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Zuordnung loeschen";
    clearBtn.addEventListener("click", async () => {
      try {
        const payload = await requestJson("/api/pixels/config", {
          method: "POST",
          body: JSON.stringify({
            mode: pixelsMode,
            sharedSet: [null, null, null]
          })
        });
        state.pixelsConfig = {
          mode: normalizePixelsMode(payload?.config?.mode),
          sharedSet: normalizeSharedSet(payload?.config?.sharedSet)
        };
        renderPixelsCharacterAssignments();
        setStatus("Gemeinsames Pixels-Set geloescht.");
      } catch (error) {
        setStatus(`Pixels-Zuordnungen konnten nicht geloescht werden: ${error.message}`);
      }
    });
    controls.appendChild(clearBtn);
    row.appendChild(controls);
    pixelsCharacterAssignmentsEl.appendChild(row);
    return;
  }

  for (const character of playerCharacters) {
    const row = document.createElement("article");
    row.className = "character-card";

    const title = document.createElement("strong");
    title.textContent = character.name;
    row.appendChild(title);

    const assignmentsForCharacter = (state.pixelsAssignments || []).filter((entry) => entry.characterId === character.id);
    const controls = document.createElement("div");
    controls.className = "device-actions";

    const slotSelections = [];
    const slots = pixelsMode === PIXELS_MODE.PC_SINGLE_3X ? [1] : [1, 2, 3];
    for (const slot of slots) {
      const assignedEntry = assignmentsForCharacter.find((entry) => entry.slot === slot) || assignmentsForCharacter[0];
      const select =
        pixelsMode === PIXELS_MODE.PC_SINGLE_3X
          ? buildPixelsSingleDeviceSelect("Pixel zuordnen", assignedEntry?.address || "")
          : buildPixelsDeviceSelect(slot, assignedEntry?.address || "");
      select.addEventListener("change", () => {
        if (pixelsMode === PIXELS_MODE.PC_SINGLE_3X) {
          for (const currentEntry of slotSelections) {
            const currentValue = currentEntry.select.value || "";
            const reserved = getReservedPixelAddresses([
              currentValue,
              ...(state.pixelsAssignments || [])
                .filter((assignment) => assignment.characterId === character.id)
                .map((assignment) => assignment.address)
            ]);
            const sharedReserved = getSharedReservedPixelAddresses([currentValue]);
            for (const option of currentEntry.select.options) {
              if (!option.value) {
                option.disabled = false;
                continue;
              }
              option.disabled =
                (reserved.has(option.value) && option.value !== currentValue) ||
                (sharedReserved.has(option.value) && option.value !== currentValue);
            }
          }
        } else {
          applyPixelSelectAvailability(slotSelections, character.id);
        }
      });
      slotSelections.push({ slot, select });
      controls.appendChild(select);
    }

    if (pixelsMode === PIXELS_MODE.PC_SINGLE_3X) {
      slotSelections[0]?.select.dispatchEvent(new Event("change"));
    } else {
      applyPixelSelectAvailability(slotSelections, character.id);
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Zuordnungen speichern";
    saveBtn.addEventListener("click", async () => {
      try {
        const requestedAddresses = new Set(
          slotSelections.map((entry) => entry.select.value).filter(Boolean)
        );
        const currentAssignments = (state.pixelsAssignments || []).filter((entry) => entry.characterId === character.id);

        for (const assignment of currentAssignments) {
          if (!requestedAddresses.has(assignment.address)) {
            await requestJson("/api/pixels/assignments", {
              method: "POST",
              body: JSON.stringify({
                address: assignment.address,
                characterId: null,
                slot: null
              })
            });
          }
        }

        for (const entry of slotSelections) {
          if (!entry.select.value) {
            continue;
          }
          await requestJson("/api/pixels/assignments", {
            method: "POST",
            body: JSON.stringify({
              address: entry.select.value,
              characterId: character.id,
              slot: pixelsMode === PIXELS_MODE.PC_SINGLE_3X ? 1 : entry.slot
            })
          });
        }

        await loadPixelsAssignments();
        setStatus(`Pixels-Zuordnungen fuer ${character.name} gespeichert.`);
      } catch (error) {
        setStatus(`Pixels-Zuordnungen fehlgeschlagen: ${error.message}`);
      }
    });
    controls.appendChild(saveBtn);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Zuordnung loeschen";
    clearBtn.addEventListener("click", async () => {
      try {
        for (const assignment of assignmentsForCharacter) {
          await requestJson("/api/pixels/assignments", {
            method: "POST",
            body: JSON.stringify({
              address: assignment.address,
              characterId: null,
              slot: null
            })
          });
        }
        await loadPixelsAssignments();
        setStatus(`Pixels-Zuordnungen fuer ${character.name} geloescht.`);
      } catch (error) {
        setStatus(`Pixels-Zuordnungen konnten nicht geloescht werden: ${error.message}`);
      }
    });
    controls.appendChild(clearBtn);

    row.appendChild(controls);
    pixelsCharacterAssignmentsEl.appendChild(row);
  }
}

function renderPixelsMonitor() {
  pixelsMonitorEl.innerHTML = "";
  pixelsEventsEl.innerHTML = "";

  if (!state.session || state.session.role !== "gm") {
    const item = document.createElement("li");
    item.textContent = "Pixels-Liveansicht ist nur im Spielleiter-Login sichtbar.";
    pixelsMonitorEl.appendChild(item);
    return;
  }

  const monitors = state.pixelsMonitor?.monitors || [];
  if (!monitors.length) {
    const item = document.createElement("li");
    item.textContent = "Keine aktiven Pixels-Watches.";
    pixelsMonitorEl.appendChild(item);
  } else {
    for (const monitor of monitors) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `${monitor.deviceName || monitor.address} | ${monitor.status}`;
      item.appendChild(title);

      const meta = document.createElement("p");
      meta.className = "character-meta";
      meta.textContent =
        `Protokoll: ${monitor.protocol} | Letztes Event: ${monitor.lastEventAt || "-"}${monitor.lastError ? ` | Fehler: ${monitor.lastError}` : ""}`;
      item.appendChild(meta);
      pixelsMonitorEl.appendChild(item);
    }
  }

  const progressEntries = state.pixelsRollProgress || [];
  for (const progress of progressEntries.slice(0, 6)) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const characterName = (state.view?.characters || []).find((entry) => entry.id === progress.characterId)?.name || progress.characterId;
    title.textContent = `INI-Sammelwurf ${characterName}: ${progress.collected.length}/${progress.requiredDice}`;
    item.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "character-meta";
    meta.textContent = progress.assignedDice
      .map((entry) => {
        const collected = progress.collected.find((candidate) => candidate.address === entry.address);
        return `W${entry.slot}: ${collected?.value ?? "-"} (${entry.address})`;
      })
      .join(" | ");
    item.appendChild(meta);
    pixelsMonitorEl.appendChild(item);
  }

  const latestCompletedEventsByAddress = new Map();
  for (const event of state.pixelsMonitor?.recentEvents || []) {
    if (!event?.address || !event?.rollState || !["rolled", "onFace"].includes(event.rollState.state)) {
      continue;
    }
    if (!latestCompletedEventsByAddress.has(event.address)) {
      latestCompletedEventsByAddress.set(event.address, event);
    }
  }
  const completedRollEvents = Array.from(latestCompletedEventsByAddress.values()).sort((left, right) =>
    String(right.at || "").localeCompare(String(left.at || ""))
  );
  if (!completedRollEvents.length) {
    const item = document.createElement("li");
    item.textContent = "Noch keine abgeschlossenen Pixels-Würfe empfangen.";
    pixelsEventsEl.appendChild(item);
    return;
  }

  for (const event of completedRollEvents.slice(0, 12)) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const rollText = `${event.rollState.state} | FaceIndex ${event.rollState.faceIndex} | Face ${event.rollState.face}`;
    title.textContent = `${event.deviceName || event.address} | ${rollText}`;
    item.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "character-meta";
    meta.textContent = `${event.at || "-"} | ${event.rawHex || "-"}`;
    item.appendChild(meta);
    pixelsEventsEl.appendChild(item);
  }
}

async function loadBluetoothDevices(scan = false) {
  if (!state.session || state.session.role !== "gm") {
    state.bluetoothDevices = [];
    renderBluetoothDevices();
    return;
  }

  const path = scan ? "/api/bluetooth/scan" : "/api/bluetooth/devices";
  const payload = await requestJson(path, {
    method: scan ? "POST" : "GET",
    body: scan ? JSON.stringify({ seconds: 6 }) : undefined
  });
  state.bluetoothDevices = payload.devices || [];
  renderBluetoothDevices();
}

async function loadPixelsDevices(discover = false) {
  if (!state.session || state.session.role !== "gm") {
    state.pixelsDevices = [];
    renderPixelsDevices();
    return;
  }

  const payload = await requestJson(`/api/pixels/devices${discover ? "?discover=1" : ""}`);
  state.pixelsDevices = payload.devices || [];
  renderPixelsDevices();
}

async function loadPixelsAssignments() {
  if (!state.session || state.session.role !== "gm") {
    state.pixelsAssignments = [];
    renderPixelsDevices();
    return;
  }

  const payload = await requestJson("/api/pixels/assignments");
  state.pixelsAssignments = payload.assignments || [];
  renderPixelsDevices();
  renderPixelsCharacterAssignments();
}

async function loadPixelsConfig() {
  if (!state.token) {
    state.pixelsConfig = { mode: PIXELS_MODE.PC_SET_3, sharedSet: [null, null, null] };
    renderPixelsCharacterAssignments();
    return;
  }
  const payload = await requestJson("/api/pixels/config");
  state.pixelsConfig = {
    mode: normalizePixelsMode(payload?.config?.mode),
    sharedSet: normalizeSharedSet(payload?.config?.sharedSet)
  };
  renderPixelsCharacterAssignments();
}

async function loadSelectedPixels() {
  if (!state.session || state.session.role !== "gm") {
    state.selectedPixelsDevices = [];
    renderBluetoothDevices();
    renderPixelsDevices();
    return;
  }

  const payload = await requestJson("/api/pixels/selected");
  state.selectedPixelsDevices = payload.selectedDevices || [];
  renderBluetoothDevices();
  renderPixelsDevices();
  renderPixelsCharacterAssignments();
}

async function loadPixelsMonitor() {
  if (!state.session || state.session.role !== "gm") {
    state.pixelsMonitor = { monitors: [], recentEvents: [] };
    renderPixelsMonitor();
    return;
  }

  const payload = await requestJson("/api/pixels/monitor");
  state.pixelsMonitor = payload;
  renderPixelsMonitor();
}

async function refreshState() {
  if (!state.token) {
    return;
  }
  const payload = await requestJson("/api/state");
  state.session = payload.session;
  state.view = payload.view;
  await loadLibrary();
  renderAuthControls();
  setStatus(`Eingeloggt als ${getSessionDisplayName()} (${state.session.role === "gm" ? "SL" : state.session.role}).`);
  renderView();
}

async function sendCommand(command) {
  const payload = await requestJson("/api/command", {
    method: "POST",
    body: JSON.stringify(command)
  });
  state.view = payload.view;
  renderView();
  for (const event of payload.events || []) {
    const message = formatRuleEvent(event);
    if (message) {
      appendLogMessage(message);
    }
  }
}

async function finishGmLogin(payload) {
  saveToken(payload.token);
  state.session = payload.session;
  state.view = payload.view;
  await loadLibrary();
  renderAuthControls();
  closeDialog(loginDialogEl);
  setStatus(`Als ${getSessionDisplayName()} (SL) eingeloggt.`);
  renderView();
  connectLiveUpdates();
  await loadBluetoothDevices();
  await loadPixelsMonitor();
  await loadSelectedPixels();
  await loadPixelsConfig();
  await loadPixelsAssignments();
  await loadPixelsDevices();
}

loginFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await requestJson("/api/login", {
      method: "POST",
      body: JSON.stringify({
        role: "gm",
        name: loginNameEl?.value || "",
        password: loginPasswordEl?.value || ""
      })
    });
    await finishGmLogin(payload);
  } catch (error) {
    setStatus(`Login fehlgeschlagen: ${error.message}`);
  }
});

refreshStateBtn.addEventListener("click", async () => {
  try {
    await refreshState();
    await loadBluetoothDevices();
    await loadPixelsMonitor();
    await loadSelectedPixels();
    await loadPixelsConfig();
    await loadPixelsAssignments();
    await loadPixelsDevices();
  } catch (error) {
    setStatus(`Aktualisierung fehlgeschlagen: ${error.message}`);
  }
});

openPixelsSettingsBtn?.addEventListener("click", () => {
  openPixelsSettingsDialog();
});

headerSettingsMenuEl?.addEventListener("mouseleave", () => {
  if (headerSettingsCloseTimer) {
    window.clearTimeout(headerSettingsCloseTimer);
  }
  headerSettingsCloseTimer = window.setTimeout(() => {
    headerSettingsMenuEl.open = false;
    headerSettingsCloseTimer = null;
  }, HEADER_SETTINGS_CLOSE_DELAY_MS);
});

headerSettingsMenuEl?.addEventListener("mouseenter", () => {
  if (headerSettingsCloseTimer) {
    window.clearTimeout(headerSettingsCloseTimer);
    headerSettingsCloseTimer = null;
  }
});

accountMenuEl?.addEventListener("mouseleave", () => {
  if (accountMenuCloseTimer) {
    window.clearTimeout(accountMenuCloseTimer);
  }
  accountMenuCloseTimer = window.setTimeout(() => {
    accountMenuEl.open = false;
    accountMenuCloseTimer = null;
  }, HEADER_SETTINGS_CLOSE_DELAY_MS);
});

accountMenuEl?.addEventListener("mouseenter", () => {
  if (accountMenuCloseTimer) {
    window.clearTimeout(accountMenuCloseTimer);
    accountMenuCloseTimer = null;
  }
});

characterSettingsMenuEl?.addEventListener("mouseleave", () => {
  if (characterSettingsCloseTimer) {
    window.clearTimeout(characterSettingsCloseTimer);
  }
  characterSettingsCloseTimer = window.setTimeout(() => {
    characterSettingsMenuEl.open = false;
    characterSettingsCloseTimer = null;
  }, HEADER_SETTINGS_CLOSE_DELAY_MS);
});

characterSettingsMenuEl?.addEventListener("mouseenter", () => {
  if (characterSettingsCloseTimer) {
    window.clearTimeout(characterSettingsCloseTimer);
    characterSettingsCloseTimer = null;
  }
});

iniSettingsMenuEl?.addEventListener("mouseleave", () => {
  if (iniSettingsCloseTimer) {
    window.clearTimeout(iniSettingsCloseTimer);
  }
  iniSettingsCloseTimer = window.setTimeout(() => {
    iniSettingsMenuEl.open = false;
    iniSettingsCloseTimer = null;
  }, HEADER_SETTINGS_CLOSE_DELAY_MS);
});

iniSettingsMenuEl?.addEventListener("mouseenter", () => {
  if (iniSettingsCloseTimer) {
    window.clearTimeout(iniSettingsCloseTimer);
    iniSettingsCloseTimer = null;
  }
});

removeAllCharactersBtn?.addEventListener("click", async () => {
  await removeCharactersByType(null);
});

removePcCharactersBtn?.addEventListener("click", async () => {
  await removeCharactersByType("PC");
});

removeNpcCharactersBtn?.addEventListener("click", async () => {
  await removeCharactersByType("NPC");
});

pixelsSettingsCloseBtn?.addEventListener("click", () => {
  closePixelsSettingsDialog();
});

clearPixelsEventsBtn?.addEventListener("click", () => {
  state.pixelsMonitor = {
    ...(state.pixelsMonitor || { monitors: [] }),
    recentEvents: []
  };
  renderPixelsMonitor();
  setStatus("Alte Pixels-Events gelöscht.");
});

initiativeRollCloseBtn?.addEventListener("click", () => {
  state.initiativeDialogRequested = false;
  closeInitiativeRollDialog();
});

warningDialogCancelBtn?.addEventListener("click", () => {
  closeWarningDialog(false);
});

warningDialogConfirmBtn?.addEventListener("click", () => {
  closeWarningDialog(true);
});

openLoginDialogBtn?.addEventListener("click", () => {
  openDialog(loginDialogEl);
  loginNameEl?.focus();
});

loginDialogCloseBtn?.addEventListener("click", () => {
  closeDialog(loginDialogEl);
});

registerFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const name = String(registerNameEl?.value || "").trim();
    const password = String(registerPasswordEl?.value || "");
    const repeat = String(registerPasswordRepeatEl?.value || "");
    if (!name) {
      setStatus("Accountname fehlt.");
      return;
    }
    if (password !== repeat) {
      setStatus("Die Passwörter stimmen nicht überein.");
      return;
    }
    await requestJson("/api/accounts/register", {
      method: "POST",
      body: JSON.stringify({ name, password })
    });
    if (loginNameEl) {
      loginNameEl.value = name;
    }
    if (loginPasswordEl) {
      loginPasswordEl.value = password;
    }
    registerFormEl.reset();
    setStatus(`SL-Account erstellt: ${name}.`);
  } catch (error) {
    setStatus(`Account konnte nicht erstellt werden: ${error.message}`);
  }
});

openAccountDialogBtn?.addEventListener("click", async () => {
  try {
    const payload = await requestJson("/api/account");
    if (accountDialogDescriptionEl) {
      accountDialogDescriptionEl.textContent = `Eingeloggt als ${payload.account.name} (SL).`;
    }
    openDialog(accountDialogEl);
    if (accountMenuEl) {
      accountMenuEl.open = false;
    }
  } catch (error) {
    setStatus(`Accountdaten konnten nicht geladen werden: ${error.message}`);
  }
});

accountDialogCloseBtn?.addEventListener("click", () => {
  closeDialog(accountDialogEl);
});

accountPasswordFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const currentPassword = String(accountCurrentPasswordEl?.value || "");
    const newPassword = String(accountNewPasswordEl?.value || "");
    const repeat = String(accountNewPasswordRepeatEl?.value || "");
    if (newPassword !== repeat) {
      setStatus("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    await requestJson("/api/account/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
    accountPasswordFormEl.reset();
    closeDialog(accountDialogEl);
    setStatus("Passwort geändert.");
  } catch (error) {
    setStatus(`Passwort konnte nicht geändert werden: ${error.message}`);
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await requestJson("/api/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  } catch {
    // Even on a failing logout request we clear the local session to avoid a stuck UI.
  }
  clearSession();
  if (accountMenuEl) {
    accountMenuEl.open = false;
  }
  renderView();
  setStatus("Ausgeloggt.");
});

fontSizeSliderEl?.addEventListener("change", () => {
  const fontScale = clamp(Number(fontSizeSliderEl.value) / 100, 0.7, 1.3);
  applyUiSettings({
    fontScale,
    forceOneColumn: state.uiSettings.forceOneColumn,
    showSystemLogs: state.uiSettings.showSystemLogs
  });
  persistUiSettings();
});

forceOneColumnEl?.addEventListener("change", () => {
  applyUiSettings({
    fontScale: state.uiSettings.fontScale,
    forceOneColumn: Boolean(forceOneColumnEl.checked),
    showSystemLogs: state.uiSettings.showSystemLogs
  });
  persistUiSettings();
});

showSystemLogsEl?.addEventListener("change", () => {
  applyUiSettings({
    fontScale: state.uiSettings.fontScale,
    forceOneColumn: state.uiSettings.forceOneColumn,
    showSystemLogs: Boolean(showSystemLogsEl.checked)
  });
  persistUiSettings();
});

snapshotFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const name = String(snapshotNameEl?.value || "").trim();
    if (!name) {
      setStatus("Snapshot-Name fehlt.");
      return;
    }
    const payload = await requestJson("/api/library/snapshots/save", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    state.library = payload.library || { snapshots: [], groups: [] };
    snapshotFormEl.reset();
    renderImportExportPanel();
    setStatus(`Snapshot gespeichert: ${name}.`);
  } catch (error) {
    setStatus(`Snapshot konnte nicht gespeichert werden: ${error.message}`);
  }
});

pcGroupFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const name = String(pcGroupNameEl?.value || "").trim();
    if (!name) {
      setStatus("SC-Gruppenname fehlt.");
      return;
    }
    const payload = await requestJson("/api/library/groups/save", {
      method: "POST",
      body: JSON.stringify({ name, type: "PC" })
    });
    state.library = payload.library || { snapshots: [], groups: [] };
    pcGroupFormEl.reset();
    renderImportExportPanel();
    setStatus(`SC-Gruppe gespeichert: ${name}.`);
  } catch (error) {
    setStatus(`SC-Gruppe konnte nicht gespeichert werden: ${error.message}`);
  }
});

npcGroupFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const name = String(npcGroupNameEl?.value || "").trim();
    if (!name) {
      setStatus("NSC-Gruppenname fehlt.");
      return;
    }
    const payload = await requestJson("/api/library/groups/save", {
      method: "POST",
      body: JSON.stringify({ name, type: "NPC" })
    });
    state.library = payload.library || { snapshots: [], groups: [] };
    npcGroupFormEl.reset();
    renderImportExportPanel();
    setStatus(`NSC-Gruppe gespeichert: ${name}.`);
  } catch (error) {
    setStatus(`NSC-Gruppe konnte nicht gespeichert werden: ${error.message}`);
  }
});

libraryExportBtn?.addEventListener("click", async () => {
  try {
    const response = await requestBinary("/api/library/export");
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename=\"?([^"]+)\"?/i);
    const fileName = match?.[1] || "fatevi-library.zip";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`Bibliothek exportiert: ${fileName}.`);
  } catch (error) {
    setStatus(`Bibliothek konnte nicht exportiert werden: ${error.message}`);
  }
});

libraryImportTriggerBtn?.addEventListener("click", () => {
  libraryImportFileEl?.click();
});

libraryImportFileEl?.addEventListener("change", async () => {
  const file = libraryImportFileEl.files?.[0];
  if (!file) {
    return;
  }
  try {
    const payload = await requestJson("/api/library/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/zip"
      },
      body: await file.arrayBuffer()
    });
    state.library = payload.library || { snapshots: [], groups: [] };
    renderImportExportPanel();
    setStatus(`Bibliothek importiert: ${payload.importedSnapshots || 0} Snapshots, ${payload.importedGroups || 0} Gruppen.`);
  } catch (error) {
    setStatus(`Bibliothek konnte nicht importiert werden: ${error.message}`);
  } finally {
    libraryImportFileEl.value = "";
  }
});

resetAppStateBtn?.addEventListener("click", async () => {
  const confirmed = await openWarningDialog(
    "Der Tracker-Zustand wird zurückgesetzt. Charaktere, Kampfzustand und Ereignisse gehen verloren. Fortfahren?",
    "Tracker resetten"
  );
  if (!confirmed) {
    return;
  }
  try {
    const payload = await requestJson("/api/app/reset", {
      method: "POST",
      body: JSON.stringify({})
    });
    state.session = payload.session;
    renderAuthControls();
    state.view = payload.view;
    state.logEntries = [];
    state.undoStack = [];
    state.redoStack = [];
    state.minimizedCharacterIds = [];
    state.pixelsAssignments = payload.assignments || state.pixelsAssignments;
    state.selectedPixelsDevices = payload.selectedDevices || state.selectedPixelsDevices;
    state.pixelsConfig = payload.config
      ? {
          mode: normalizePixelsMode(payload.config.mode),
          sharedSet: normalizeSharedSet(payload.config.sharedSet)
        }
      : state.pixelsConfig;
    renderView();
    setStatus("Tracker wurde zurückgesetzt.");
  } catch (error) {
    setStatus(`Tracker-Reset fehlgeschlagen: ${error.message}`);
  }
});

pixelsRefreshBtn.addEventListener("click", async () => {
  try {
    setStatus("Pixels-Geräte werden geladen...");
    await loadPixelsMonitor();
    await loadSelectedPixels();
    await loadPixelsConfig();
    await loadPixelsAssignments();
    await loadPixelsDevices(true);
    setStatus("Pixels-Geräte aktualisiert.");
  } catch (error) {
    setStatus(`Pixels-Aktualisierung fehlgeschlagen: ${error.message}`);
  }
});

bluetoothScanBtn.addEventListener("click", async () => {
  try {
    setStatus("Bluetooth-Scan läuft...");
    await loadBluetoothDevices(true);
    await loadPixelsConfig();
    setStatus("Bluetooth-Scan abgeschlossen.");
  } catch (error) {
    setStatus(`Bluetooth-Scan fehlgeschlagen: ${error.message}`);
  }
});

startRoundBtn.addEventListener("click", async () => {
  try {
    state.initiativeDialogRequested = true;
    await performTrackedCombatAction(async () => {
      await sendCommand({ type: "start-round" });
    }, Number(state.view?.round || 0) > 0 ? "Nächste KR" : "Kampf starten");
    renderInitiativeRollDialog();
  } catch (error) {
    setStatus(`Start fehlgeschlagen: ${error.message}`);
  }
});

endCombatBtn?.addEventListener("click", async () => {
  const confirmed = await openWarningDialog("Kampf beenden und aktuellen KR-Status löschen?", "Kampf beenden");
  if (!confirmed) {
    return;
  }
  try {
    state.initiativeDialogRequested = false;
    await performTrackedCombatAction(async () => {
      await sendCommand({ type: "end-combat" });
    }, "Kampf beenden");
    if (iniSettingsMenuEl) {
      iniSettingsMenuEl.open = false;
    }
    setStatus("Kampf beendet.");
  } catch (error) {
    setStatus(`Kampf beenden fehlgeschlagen: ${error.message}`);
  }
});

toggleAllPcSurprisedEl?.addEventListener("change", async () => {
  try {
    await performTrackedCombatAction(
      () => setAllCharactersSurprised("PC", toggleAllPcSurprisedEl.checked),
      "Alle SC überrascht"
    );
    setStatus(`Alle SC ${toggleAllPcSurprisedEl.checked ? "überrascht" : "nicht überrascht"}.`);
  } catch (error) {
    setStatus(`SC-Überraschung fehlgeschlagen: ${error.message}`);
  }
});

toggleAllNpcSurprisedEl?.addEventListener("change", async () => {
  try {
    await performTrackedCombatAction(
      () => setAllCharactersSurprised("NPC", toggleAllNpcSurprisedEl.checked),
      "Alle NSC überrascht"
    );
    setStatus(`Alle NSC ${toggleAllNpcSurprisedEl.checked ? "überrascht" : "nicht überrascht"}.`);
  } catch (error) {
    setStatus(`NSC-Überraschung fehlgeschlagen: ${error.message}`);
  }
});

pixelsModeSelectEl?.addEventListener("change", async () => {
  try {
    const payload = await requestJson("/api/pixels/config", {
      method: "POST",
      body: JSON.stringify({
        mode: normalizePixelsMode(pixelsModeSelectEl.value),
        sharedSet: normalizeSharedSet(state.pixelsConfig?.sharedSet)
      })
    });
    state.pixelsConfig = {
      mode: normalizePixelsMode(payload?.config?.mode),
      sharedSet: normalizeSharedSet(payload?.config?.sharedSet)
    };
    renderPixelsCharacterAssignments();
    setStatus("Pixels-Modus gespeichert.");
  } catch (error) {
    setStatus(`Pixels-Modus fehlgeschlagen: ${error.message}`);
  }
});

addFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const name = addNameEl.value.trim();
    if (!name) {
      setStatus("Charaktername fehlt.");
      return;
    }
    const type = addTypeEl.value === "NPC" ? "NPC" : "PC";
    const initiativeBase = Math.max(1, Math.min(30, Math.round(Number(addIniEl.value) || 10)));
    const specialAbility = String(addSpecialAbilityEl.value || "").trim() || null;
    await performTrackedCombatAction(
      () =>
        sendCommand({
          type: "add-character",
          character: {
            id: createCharacterId(name, type),
            name,
            type,
            initiativeBase,
            specialAbility,
            ownerUserId: null
          }
        }),
      "Charakter hinzufügen"
    );
    addFormEl.reset();
    addTypeEl.value = "PC";
    addIniEl.value = "10";
    setStatus(`Charakter hinzugefügt: ${name}.`);
  } catch (error) {
    setStatus(`Charakter konnte nicht hinzugefügt werden: ${error.message}`);
  }
});

eventFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const description = String(eventDescriptionEl?.value || "").trim();
    const dueOffset = Math.max(1, Math.round(Number(eventDueOffsetEl?.value) || 1));
    if (!description) {
      setStatus("Ereignisbeschreibung fehlt.");
      return;
    }
    const currentRound = Math.max(0, Number(state.view?.round || 0));
    const dueRound = currentRound + dueOffset;
    await performTrackedCombatAction(
      () =>
        sendCommand({
          type: "add-event",
          event: {
            id: `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            description,
            createdAtRound: currentRound,
            dueRound
          }
        }),
      "Ereignis hinzufügen"
    );
    eventFormEl.reset();
    if (eventDueOffsetEl) {
      eventDueOffsetEl.value = "1";
    }
    setStatus(`Ereignis hinzugefügt: ${description}.`);
  } catch (error) {
    setStatus(`Ereignis konnte nicht hinzugefügt werden: ${error.message}`);
  }
});

editCharacterCancelBtn?.addEventListener("click", () => {
  closeCharacterEditDialog();
});

editCharacterFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const characterId = state.editingCharacterId;
    if (!characterId) {
      return;
    }
    const name = editNameEl.value.trim();
    if (!name) {
      setStatus("Charaktername fehlt.");
      return;
    }
    const type = editTypeEl.value === "NPC" ? "NPC" : "PC";
    const initiativeBase = Math.max(1, Math.min(30, Math.round(Number(editIniEl.value) || 10)));
    const specialAbility = String(editSpecialAbilityEl.value || "").trim() || null;
    const initiativeRollMode = normalizeInitiativeRollMode(editInitiativeRollModeEl?.value, type);
    const hidden = Boolean(editHiddenEl?.checked);
    await performTrackedCombatAction(
      () =>
        sendCommand({
          type: "update-character",
          characterId,
          patch: {
            name,
            type,
            hidden,
            initiativeBase,
            specialAbility,
            initiativeRollMode
          }
        }),
      "Charakter bearbeiten"
    );
    closeCharacterEditDialog();
    setStatus(`Charakter bearbeitet: ${name}.`);
  } catch (error) {
    setStatus(`Charakter konnte nicht bearbeitet werden: ${error.message}`);
  }
});

activateCharacterUpBtn.addEventListener("click", async () => {
  try {
    await performTrackedCombatAction(
      () => sendCommand({ type: "step-active-character", direction: "previous" }),
      "Vorheriger Charakter"
    );
  } catch (error) {
    setStatus(`Vorheriger Charakter fehlgeschlagen: ${error.message}`);
  }
});

activateCharacterDownBtn.addEventListener("click", async () => {
  try {
    await performTrackedCombatAction(
      () => sendCommand({ type: "step-active-character", direction: "next" }),
      "Nächster Charakter"
    );
  } catch (error) {
    setStatus(`Nächster Charakter fehlgeschlagen: ${error.message}`);
  }
});

undoActionBtn?.addEventListener("click", async () => {
  const entry = state.undoStack[0];
  if (!entry) {
    return;
  }
  try {
    await restoreCombatState(entry.before, `undo:${entry.label}`);
    state.undoStack = state.undoStack.slice(1);
    state.redoStack = [{ ...entry }, ...state.redoStack].slice(0, 100);
    updateHistoryButtons();
    setStatus(`Rückgängig: ${entry.label}.`);
  } catch (error) {
    setStatus(`Rückgängig fehlgeschlagen: ${error.message}`);
  }
});

redoActionBtn?.addEventListener("click", async () => {
  const entry = state.redoStack[0];
  if (!entry) {
    return;
  }
  try {
    await restoreCombatState(entry.after, `redo:${entry.label}`);
    state.redoStack = state.redoStack.slice(1);
    state.undoStack = [{ ...entry }, ...state.undoStack].slice(0, 100);
    updateHistoryButtons();
    setStatus(`Wiederhergestellt: ${entry.label}.`);
  } catch (error) {
    setStatus(`Wiederherstellen fehlgeschlagen: ${error.message}`);
  }
});

async function init() {
  state.token = window.localStorage.getItem(SESSION_TOKEN_KEY);
  try {
    const persistedUiSettings = JSON.parse(window.localStorage.getItem(UI_SETTINGS_KEY) || "null");
    applyUiSettings(persistedUiSettings || state.uiSettings);
  } catch {
    applyUiSettings(state.uiSettings);
  }
  state.bootstrap = await requestJson("/api/bootstrap");
  renderBootstrap();
  if (state.token) {
    try {
      await refreshState();
      if (state.session?.role !== "gm") {
        clearSession();
        setStatus("Gespeicherte Spieler-Sitzung verworfen. Dieser Client ist nur für Spielleiter.");
        renderView();
        return;
      }
      connectLiveUpdates();
      await loadBluetoothDevices();
      await loadPixelsMonitor();
      await loadSelectedPixels();
      await loadPixelsConfig();
      await loadPixelsAssignments();
      await loadPixelsDevices();
    } catch (error) {
      setStatus(`Gespeicherte Sitzung ungültig: ${error.message}`);
    }
  }
  renderAuthControls();
  renderView();
}

void init().catch((error) => {
  setStatus(`Initialisierung fehlgeschlagen: ${error.message}`);
});
