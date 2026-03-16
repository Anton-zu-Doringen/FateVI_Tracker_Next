const state = {
  token: null,
  session: null,
  view: null,
  bootstrap: null,
  eventSource: null,
  bluetoothDevices: [],
  pixelsDevices: [],
  pixelsMonitor: { monitors: [], recentEvents: [] },
  selectedPixelsDevices: [],
  pixelsAssignments: [],
  pixelsConfig: { mode: "pc-set-3", sharedSet: [null, null, null] },
  pixelsRollProgress: [],
  logEntries: [],
  minimizedCharacterIds: [],
  editingCharacterId: null,
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
const gmLoginBtn = document.getElementById("gm-login");
const gmPasswordEl = document.getElementById("gm-password");
const addFormEl = document.getElementById("add-form");
const addNameEl = document.getElementById("name");
const addTypeEl = document.getElementById("type");
const addIniEl = document.getElementById("ini");
const addSpecialAbilityEl = document.getElementById("special-ability");
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
const removeAllCharactersBtn = document.getElementById("remove-all-characters");
const removePcCharactersBtn = document.getElementById("remove-pc-characters");
const removeNpcCharactersBtn = document.getElementById("remove-npc-characters");
const openPixelsSettingsBtn = document.getElementById("open-pixels-settings");
const pixelsSettingsDialogEl = document.getElementById("pixels-settings-dialog");
const pixelsSettingsCloseBtn = document.getElementById("pixels-settings-close");
const startRoundBtn = document.getElementById("start-round");
const toggleAllPcSurprisedEl = document.getElementById("toggle-all-pc-surprised");
const toggleAllNpcSurprisedEl = document.getElementById("toggle-all-npc-surprised");
const turnOrderEl = document.getElementById("turn-order");
const charactersEl = document.getElementById("characters");
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
const editCharacterDialogEl = document.getElementById("edit-character-dialog");
const editCharacterFormEl = document.getElementById("edit-character-form");
const editCharacterTitleEl = document.getElementById("edit-character-title");
const editNameEl = document.getElementById("edit-name");
const editTypeEl = document.getElementById("edit-type");
const editIniEl = document.getElementById("edit-ini");
const editSpecialAbilityEl = document.getElementById("edit-special-ability");
const editInitiativeRollModeEl = document.getElementById("edit-initiative-roll-mode");
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
let characterSettingsCloseTimer = null;

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

function setStatus(message) {
  sessionStatusEl.textContent = message;
  state.logEntries = [...state.logEntries, createLogEntry(message, { kind: "system" }, state.logEntries)].slice(0, 60);
  renderLogs();
}

function appendLogMessage(message, options = {}) {
  state.logEntries = [...state.logEntries, createLogEntry(message, { ...options, kind: "combat" }, state.logEntries)].slice(0, 60);
  renderLogs();
}

function getCharacterNameById(characterId) {
  return getCharacterById(state.view, characterId)?.name || characterId || "Unbekannt";
}

function formatRuleEvent(event) {
  const characterName = event?.characterId ? getCharacterNameById(event.characterId) : null;
  switch (event?.type) {
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
  state.view = null;
  state.bluetoothDevices = [];
  state.pixelsDevices = [];
  state.pixelsMonitor = { monitors: [], recentEvents: [] };
  state.selectedPixelsDevices = [];
  state.pixelsAssignments = [];
  state.pixelsConfig = { mode: PIXELS_MODE.PC_SET_3, sharedSet: [null, null, null] };
  state.pixelsRollProgress = [];
  state.undoStack = [];
  state.redoStack = [];
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

function getCharacterById(view, characterId) {
  return (view?.characters || []).find((entry) => entry.id === characterId) || null;
}

function getCharactersByType(view, type) {
  return (view?.characters || []).filter((character) => character.type === type);
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

  const confirmed = window.confirm(confirmText);
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
}

function connectLiveUpdates() {
  disconnectLiveUpdates();
  if (!state.token) {
    return;
  }

  const eventSource = new EventSource(`/api/events?token=${encodeURIComponent(state.token)}`);
  eventSource.addEventListener("state", (event) => {
    const payload = JSON.parse(event.data);
    state.session = payload.session;
    state.view = payload.view;
    setStatus(
      `Live verbunden als ${state.session.role}${state.session.controlledCharacterId ? ` (${state.session.controlledCharacterId})` : ""}.`
    );
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
    setStatus("Live-Update-Verbindung unterbrochen. Browser versucht Wiederverbindung.");
  };
  state.eventSource = eventSource;
}

function renderBootstrap() {
  loginHintEl.textContent = state.bootstrap?.gmLoginHint || "";
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

function renderView() {
  const view = state.view;
  if (!view) {
    turnOrderEl.innerHTML = "";
    charactersEl.innerHTML = "";
    roundStatusEl.textContent = "Kampfrunde: -";
    rawStateEl.textContent = "{}";
    renderLogs();
    renderBluetoothDevices();
    renderPixelsDevices();
    renderPixelsCharacterAssignments();
    renderPixelsMonitor();
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

  const playerCharacters = getCharactersByType(view, "PC");
  const npcCharacters = getCharactersByType(view, "NPC");
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
  for (const character of view.characters || []) {
    const characterDetail = getCharacterDetail(character);
    const card = document.createElement("article");
    card.className = `character-card type-${character.type === "NPC" ? "npc" : "pc"}${character.isOwned ? " owned" : ""}${
      view.activeCharacterId === character.id ? " active" : ""
    }${isCharacterMinimized(character.id) ? " minimized" : ""}`;

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
      const confirmed = window.confirm(`Soll ${character.name} wirklich entfernt werden?`);
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
    const metaBits = [];
    const specialAbilityLabel = getSpecialAbilityLabel(character.specialAbility);
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
    meta.textContent = metaBits.join(" | ");
    card.appendChild(meta);

    if (characterDetail) {
      const damageMonitor = document.createElement("details");
      damageMonitor.className = "damage-monitor";
      const damageSummary = document.createElement("summary");
      damageSummary.textContent = "Schadensmonitor";
      damageMonitor.appendChild(damageSummary);

      const damageWrap = document.createElement("div");
      damageWrap.className = "damage-monitor-wrap";
      const damageGrid = document.createElement("div");
      damageGrid.className = "damage-monitor-grid";
      const marks = normalizeDamageMonitorMarks(characterDetail.damageMonitorMarks);
      for (let index = 0; index < 16; index += 1) {
        const markLabel = document.createElement("label");
        markLabel.className = "damage-mark";
        const checkbox = document.createElement("input");
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
        const labelText = document.createElement("span");
        labelText.textContent = String(index + 1);
        markLabel.append(checkbox, labelText);
        damageGrid.appendChild(markLabel);
      }
      damageWrap.appendChild(damageGrid);
      const damageNote = document.createElement("p");
      damageNote.className = "damage-monitor-note";
      damageNote.textContent = `QM: ${DAMAGE_QM_VALUES.join(" ")} | BEW: ${DAMAGE_BEW_VALUES.join(" ")}`;
      damageWrap.appendChild(damageNote);
      damageMonitor.appendChild(damageWrap);
      card.appendChild(damageMonitor);
    }

    charactersEl.appendChild(card);
  }

  const pendingInputs = getPendingInitiativeInputs(view);
  startRoundBtn.disabled = pendingInputs.length > 0;
  activateCharacterUpBtn.disabled = !(view.turnEntries || []).length;
  activateCharacterDownBtn.disabled = !(view.turnEntries || []).length;
  rawStateEl.textContent = JSON.stringify(view, null, 2);
  renderLogs();
  renderBluetoothDevices();
  renderPixelsDevices();
  renderPixelsCharacterAssignments();
  renderPixelsMonitor();
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
        const payload = await requestJson("/api/pixels/identify", {
          method: "POST",
          body: JSON.stringify({ address: device.address })
        });
        const identity = payload.device?.identity;
        const pixelId = identity?.pixelId != null ? ` Pixel-ID ${identity.pixelId}` : "";
        const ledCount = identity?.ledCount != null ? `, LEDs ${identity.ledCount}` : "";
        setStatus(`Pixels-Identify gesendet an ${device.name}.${pixelId}${ledCount}`);
        await loadPixelsDevices();
      } catch (error) {
        setStatus(`Pixels-Identify fehlgeschlagen: ${error.message}`);
      }
    });
    actions.appendChild(identifyBtn);

    const blinkBtn = document.createElement("button");
    blinkBtn.type = "button";
    blinkBtn.textContent = "Grün blinken";
    blinkBtn.disabled = false;
    blinkBtn.addEventListener("click", async () => {
      try {
        const payload = await requestJson("/api/pixels/blink", {
          method: "POST",
          body: JSON.stringify({
            address: device.address,
            color: "#00ff00",
            count: 6,
            duration: 180,
            loopCount: 2
          })
        });
        setStatus(
          `Pixels-Blinken an ${device.name} gesendet. | path: ${payload.device?.writeCharacteristicPath || "-"} | hex: ${payload.device?.requestHex || "-"}`
        );
      } catch (error) {
        setStatus(`Pixels-Blinken fehlgeschlagen: ${error.message}`);
      }
    });
    actions.appendChild(blinkBtn);

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

  const recentEvents = state.pixelsMonitor?.recentEvents || [];
  if (!recentEvents.length) {
    const item = document.createElement("li");
    item.textContent = "Noch keine Pixels-Events empfangen.";
    pixelsEventsEl.appendChild(item);
    return;
  }

  for (const event of recentEvents.slice(0, 12)) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const rollText = event.rollState
      ? `${event.rollState.state} | FaceIndex ${event.rollState.faceIndex} | Face ${event.rollState.face}`
      : "Rohnachricht";
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
  setStatus(`Eingeloggt als ${state.session.role}${state.session.controlledCharacterId ? ` (${state.session.controlledCharacterId})` : ""}.`);
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

gmLoginBtn.addEventListener("click", async () => {
  try {
    const payload = await requestJson("/api/login", {
      method: "POST",
      body: JSON.stringify({
        role: "gm",
        password: gmPasswordEl.value
      })
    });
    saveToken(payload.token);
    state.session = payload.session;
    state.view = payload.view;
    setStatus("Als Spielleiter eingeloggt.");
    renderView();
    connectLiveUpdates();
    await loadBluetoothDevices();
    await loadPixelsMonitor();
    await loadSelectedPixels();
    await loadPixelsConfig();
    await loadPixelsAssignments();
    await loadPixelsDevices();
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

resetAppStateBtn?.addEventListener("click", async () => {
  const confirmed = window.confirm("Die gesamte App wird zurückgesetzt. Alle Kampf- und Pixels-Daten gehen verloren. Fortfahren?");
  if (!confirmed) {
    return;
  }
  try {
    const payload = await requestJson("/api/app/reset", {
      method: "POST",
      body: JSON.stringify({})
    });
    state.session = payload.session;
    state.view = payload.view;
    state.logEntries = [];
    state.undoStack = [];
    state.redoStack = [];
    state.minimizedCharacterIds = [];
    state.pixelsAssignments = [];
    state.selectedPixelsDevices = [];
    state.pixelsDevices = [];
    state.pixelsMonitor = { monitors: [], recentEvents: [] };
    state.pixelsConfig = { mode: PIXELS_MODE.PC_SET_3, sharedSet: [null, null, null] };
    applyUiSettings({ fontScale: 1, forceOneColumn: false, showSystemLogs: true });
    window.localStorage.removeItem(UI_SETTINGS_KEY);
    renderView();
    setStatus("App wurde zurückgesetzt.");
  } catch (error) {
    setStatus(`App-Reset fehlgeschlagen: ${error.message}`);
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
    await performTrackedCombatAction(async () => {
      await sendCommand({ type: "start-round" });
      await resolvePendingManualInitiativeRolls();
    }, "Runde starten");
  } catch (error) {
    setStatus(`Start fehlgeschlagen: ${error.message}`);
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
    await performTrackedCombatAction(
      () =>
        sendCommand({
          type: "update-character",
          characterId,
          patch: {
            name,
            type,
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
  renderView();
}

void init().catch((error) => {
  setStatus(`Initialisierung fehlgeschlagen: ${error.message}`);
});
