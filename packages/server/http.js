import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TrackerServer } from "./dist/server.js";
import { connectBluetoothDevice, disconnectBluetoothDevice, listBluetoothDevices, scanBluetoothDevices } from "./bluetooth.js";
import { blinkPixelsDevice, createPixelsMonitorManager, forgetPixelsGatt, identifyPixelsDevice, listPixelsDevices } from "./pixels.js";

const GM_PASSWORD = process.env.FATEVI_GM_PASSWORD ?? "gm";
const PORT = Number(process.env.PORT || 8787);
const serverState = new TrackerServer();
const sessions = new Map();
const eventStreams = new Map();
const pixelsAssignments = new Map();
const selectedPixelsDevices = new Map();
const pendingPixelRolls = new Map();
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientPublicDir = path.resolve(currentDir, "../client/public");
const dataDir = path.resolve(currentDir, "data");
const runtimeFile = path.join(dataDir, "runtime.json");
const PIXELS_SLOT_VALUES = [1, 2, 3];
const PIXELS_ROLL_DEBOUNCE_MS = 1200;
const PIXELS_MODE = {
  PC_SET_3: "pc-set-3",
  SHARED_SET_3: "shared-set-3",
  PC_SINGLE_3X: "pc-single-3x"
};
const pixelsConfig = {
  mode: PIXELS_MODE.PC_SET_3,
  sharedSet: [null, null, null]
};
const pixelsMonitor = createPixelsMonitorManager({
  onEvent: (event) => {
    broadcastPixelsEvent("pixels-roll", event);
    void handlePixelsRollIntegration(event).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      broadcastPixelsEvent("pixels-roll-integration-error", {
        address: event.address,
        error: message
      });
    });
  },
  onStatus: (payload) => {
    broadcastPixelsEvent("pixels-status", payload);
  }
});

async function saveRuntime() {
  await mkdir(dataDir, { recursive: true });
  const payload = {
    state: serverState.getState(),
    sessions: Array.from(sessions.entries()).map(([token, session]) => ({ token, session })),
    pixelsAssignments: getAssignmentsPayload(),
    selectedPixelsDevices: getSelectedPixelsPayload(),
    pixelsConfig: getPixelsConfigPayload()
  };
  await writeFile(runtimeFile, JSON.stringify(payload, null, 2), "utf8");
}

async function loadRuntime() {
  try {
    const content = await readFile(runtimeFile, "utf8");
    const payload = JSON.parse(content);
    if (payload?.state) {
      serverState.setState(payload.state);
    }
    sessions.clear();
    for (const entry of payload?.sessions || []) {
      if (entry?.token && entry?.session) {
        sessions.set(entry.token, entry.session);
      }
    }
    pixelsAssignments.clear();
    for (const entry of payload?.pixelsAssignments || []) {
      if (!entry?.address || typeof entry.characterId !== "string") {
        continue;
      }
      const normalizedSlot = normalizeAssignmentSlot(entry.slot);
      pixelsAssignments.set(entry.address, {
        characterId: entry.characterId,
        slot: normalizedSlot ?? findFirstFreeSlot(entry.characterId) ?? 1
      });
    }
    selectedPixelsDevices.clear();
    for (const entry of payload?.selectedPixelsDevices || []) {
      if (!entry?.address) {
        continue;
      }
      selectedPixelsDevices.set(entry.address, {
        address: entry.address,
        name: entry.name || entry.address
      });
    }
    pixelsConfig.mode = normalizePixelsMode(payload?.pixelsConfig?.mode);
    pixelsConfig.sharedSet = normalizeSharedSet(payload?.pixelsConfig?.sharedSet);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function getGmSession() {
  return { userId: "gm", role: "gm", controlledCharacterId: null };
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
    return typeof entry === "string" && entry ? entry : null;
  });
}

function getPixelsConfigPayload() {
  return {
    mode: normalizePixelsMode(pixelsConfig.mode),
    sharedSet: normalizeSharedSet(pixelsConfig.sharedSet)
  };
}

function normalizeAssignmentSlot(value) {
  const slot = Math.round(Number(value));
  return PIXELS_SLOT_VALUES.includes(slot) ? slot : null;
}

function findFirstFreeSlot(characterId, excludingAddress = null) {
  for (const slot of PIXELS_SLOT_VALUES) {
    const inUse = Array.from(pixelsAssignments.entries()).some(([address, assignment]) => {
      if (excludingAddress && address === excludingAddress) {
        return false;
      }
      return assignment.characterId === characterId && assignment.slot === slot;
    });
    if (!inUse) {
      return slot;
    }
  }
  return null;
}

function getAssignedCharacterEntry(address) {
  return pixelsAssignments.get(address) ?? null;
}

function getSharedSlotForAddress(address) {
  const sharedSet = normalizeSharedSet(pixelsConfig.sharedSet);
  const index = sharedSet.findIndex((entry) => entry === address);
  if (index < 0) {
    return null;
  }
  return index + 1;
}

function getAssignmentsPayload() {
  return Array.from(pixelsAssignments.entries())
    .map(([address, assignment]) => ({
      address,
      characterId: assignment.characterId,
      slot: assignment.slot
    }))
    .sort(
      (left, right) =>
        left.characterId.localeCompare(right.characterId) ||
        left.slot - right.slot ||
        left.address.localeCompare(right.address)
    );
}

function getSelectedPixelsPayload() {
  return Array.from(selectedPixelsDevices.values()).sort(
    (left, right) => (left.name || left.address).localeCompare(right.name || right.address)
  );
}

function getAssignedDiceAssignments(characterId) {
  return Array.from(pixelsAssignments.entries())
    .filter(([, assignment]) => assignment.characterId === characterId)
    .map(([address, assignment]) => ({
      address,
      characterId: assignment.characterId,
      slot: assignment.slot
    }))
    .sort((left, right) => left.slot - right.slot || left.address.localeCompare(right.address));
}

function getAssignedDiceAddresses(characterId) {
  return getAssignedDiceAssignments(characterId).map((entry) => entry.address);
}

function getAssignedDiceCount(characterId) {
  return getAssignedDiceAssignments(characterId).length;
}

function getCharacterById(characterId) {
  return serverState.getState().characters.find((entry) => entry.id === characterId) ?? null;
}

function getPixelsCharactersInRosterOrder() {
  return serverState
    .getState()
    .characters.filter((character) => !character.incapacitated && getInitiativeRollMode(character) === "pixels");
}

function getInitiativeRollMode(character) {
  if (!character) {
    return "manual";
  }
  if (character.initiativeRollMode === "automatic" || character.initiativeRollMode === "manual" || character.initiativeRollMode === "pixels") {
    return character.initiativeRollMode;
  }
  return character.type === "NPC" ? "automatic" : "manual";
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function roll3d6() {
  return rollD6() + rollD6() + rollD6();
}

function computeCriticalState(total) {
  if (total === 18) {
    return "success";
  }
  if (total === 3) {
    return "failure";
  }
  return null;
}

async function triggerPixelsBlinkForAddresses(addresses, options) {
  const uniqueAddresses = [...new Set(addresses.filter(Boolean))];
  await Promise.all(
    uniqueAddresses.map((address) =>
      blinkPixelsDevice(address, options).catch((error) => {
        broadcastPixelsEvent("pixels-led-error", {
          address,
          error: error instanceof Error ? error.message : String(error)
        });
      })
    )
  );
}

async function triggerPixelsBlinkSequenceForAddresses(addresses, steps = []) {
  for (const step of steps) {
    await triggerPixelsBlinkForAddresses(addresses, step.options || {});
    if (step.pauseMs) {
      await new Promise((resolve) => setTimeout(resolve, step.pauseMs));
    }
  }
}

async function triggerWaitLedEffectsForPendingRolls() {
  const targets = Array.from(pendingPixelRolls.values()).flatMap((entry) => entry.assignedAddresses || []);
  if (!targets.length) {
    return;
  }
  await triggerPixelsBlinkForAddresses(targets, {
    color: "#ffffff",
    count: 2,
    duration: 700,
    loopCount: 3
  });
}

async function triggerCriticalLedEffect(characterId, total) {
  const critical = computeCriticalState(total);
  if (!critical) {
    return;
  }
  const addresses = getAssignedDiceAddresses(characterId);
  if (!addresses.length) {
    return;
  }
  if (critical === "success") {
    await triggerPixelsBlinkForAddresses(addresses, {
      color: "#00ff00",
      count: 2,
      duration: 500,
      loopCount: 1
    });
    return;
  }
  await triggerPixelsBlinkSequenceForAddresses(addresses, [
    {
      options: {
        color: "#ff0000",
        count: 1,
        duration: 160,
        loopCount: 1
      },
      pauseMs: 90
    },
    {
      options: {
        color: "#ff7a00",
        count: 1,
        duration: 160,
        loopCount: 1
      },
      pauseMs: 90
    },
    {
      options: {
        color: "#ff0000",
        count: 1,
        duration: 160,
        loopCount: 1
      },
      pauseMs: 90
    },
    {
      options: {
        color: "#ff7a00",
        count: 1,
        duration: 160,
        loopCount: 1
      }
    }
  ]);
}

function rebuildPendingPixelRolls() {
  const previousRolls = new Map(pendingPixelRolls.entries());
  pendingPixelRolls.clear();
  const state = serverState.getState();
  for (const input of state.pendingInputs) {
    if (input.type !== "roll" || input.request.kind !== "initiative-roll") {
      continue;
    }
    const character = getCharacterById(input.request.characterId);
    if (getInitiativeRollMode(character) !== "pixels") {
      continue;
    }
    const mode = normalizePixelsMode(pixelsConfig.mode);
    const previous = previousRolls.get(input.request.characterId);
    let assignedDice = [];
    if (mode === PIXELS_MODE.SHARED_SET_3) {
      assignedDice = normalizeSharedSet(pixelsConfig.sharedSet)
        .map((address, index) => ({
          address,
          slot: index + 1,
          label: `W${index + 1}`
        }))
        .filter((entry) => Boolean(entry.address));
    } else if (mode === PIXELS_MODE.PC_SINGLE_3X) {
      const firstAssigned = getAssignedDiceAssignments(input.request.characterId)[0] ?? null;
      assignedDice = firstAssigned
        ? Array.from({ length: 3 }, (_, index) => ({
            address: firstAssigned.address,
            slot: index + 1,
            label: `W${index + 1}`
          }))
        : [];
    } else {
      assignedDice = getAssignedDiceAssignments(input.request.characterId).map((entry) => ({
        ...entry,
        label: `W${entry.slot}`
      }));
    }
    pendingPixelRolls.set(input.request.characterId, {
      characterId: input.request.characterId,
      mode,
      phase: previous?.phase === "crit" ? "crit" : "main",
      requiredDice: previous?.phase === "crit" ? 1 : input.request.dice === "3d6" ? 3 : 1,
      assignedDice,
      assignedAddresses: [...new Set(assignedDice.map((entry) => entry.address).filter(Boolean))],
      results: Array.isArray(previous?.results) ? previous.results.slice() : [],
      mainTotal: Number.isFinite(Number(previous?.mainTotal)) ? Number(previous.mainTotal) : null,
      mainFaces: Array.isArray(previous?.mainFaces) ? previous.mainFaces.slice() : [],
      acceptedAtByAddress: previous?.acceptedAtByAddress instanceof Map ? previous.acceptedAtByAddress : new Map(),
      createdAt: previous?.createdAt || new Date().toISOString()
    });
  }
}

function resolveAutomaticInitiativeRolls() {
  const state = serverState.getState();
  const autoCharacters = state.characters.filter(
    (character) => !character.incapacitated && getInitiativeRollMode(character) === "automatic"
  );

  for (const character of autoCharacters) {
    const total = roll3d6();
    serverState.execute(getGmSession(), {
      type: "resolve-initiative-roll",
      characterId: character.id,
      total,
      critBonusRoll: total === 18 ? rollD6() : null
    });
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getBearerToken(request) {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

function getSessionFromRequest(request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }
  return sessions.get(token) ?? null;
}

function requireGmSession(request, response) {
  const session = getSessionFromRequest(request);
  if (!session) {
    sendError(response, 401, "missing or invalid session");
    return null;
  }
  if (session.role !== "gm") {
    sendError(response, 403, "gm role required");
    return null;
  }
  return session;
}

function sendSseEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastStateUpdate(reason = "state-updated") {
  for (const [token, response] of eventStreams.entries()) {
    const session = sessions.get(token);
    if (!session) {
      response.end();
      eventStreams.delete(token);
      continue;
    }
    sendSseEvent(response, "state", {
      reason,
      session,
      view: serverState.getStateForSession(session)
    });
  }
}

function broadcastPixelsEvent(eventName, payload) {
  for (const [token, response] of eventStreams.entries()) {
    const session = sessions.get(token);
    if (!session) {
      response.end();
      eventStreams.delete(token);
      continue;
    }
    if (session.role !== "gm") {
      continue;
    }
    sendSseEvent(response, eventName, payload);
  }
}

async function persistPixelsConfigAndBroadcast(reason = "pixels-config-updated") {
  await saveRuntime();
  broadcastPixelsEvent("pixels-config", {
    reason,
    config: getPixelsConfigPayload()
  });
}

async function persistPixelsAssignmentsAndBroadcast(reason = "pixels-assignments-updated") {
  await saveRuntime();
  broadcastPixelsEvent("pixels-assignments", {
    reason,
    assignments: getAssignmentsPayload()
  });
}

async function persistSelectedPixelsAndBroadcast(reason = "pixels-selection-updated") {
  await saveRuntime();
  broadcastPixelsEvent("pixels-selection", {
    reason,
    selectedDevices: getSelectedPixelsPayload()
  });
}

function getBootstrap() {
  const state = serverState.getState();
  return {
    appName: "FateVI Tracker Next",
    gmLoginHint: "Passwort ist standardmäßig 'gm' und per FATEVI_GM_PASSWORD änderbar.",
    playerCharacters: state.characters
      .filter((character) => character.type === "PC" && character.ownerUserId)
      .map((character) => ({
        id: character.id,
        name: character.name,
        ownerUserId: character.ownerUserId
      }))
  };
}

async function handleLogin(request, response) {
  const body = await readJsonBody(request);
  if (body.role === "gm") {
    if (body.password !== GM_PASSWORD) {
      sendError(response, 401, "invalid gm password");
      return;
    }
    const session = { userId: "gm", role: "gm", controlledCharacterId: null };
    const token = randomUUID();
    sessions.set(token, session);
    await saveRuntime();
    sendJson(response, 200, { token, session, view: serverState.getStateForSession(session) });
    return;
  }

  if (body.role === "player") {
    const state = serverState.getState();
    const character = state.characters.find((entry) => entry.id === body.characterId && entry.type === "PC");
    if (!character || !character.ownerUserId) {
      sendError(response, 400, "unknown player character");
      return;
    }
    const session = {
      userId: character.ownerUserId,
      role: "player",
      controlledCharacterId: character.id
    };
    const token = randomUUID();
    sessions.set(token, session);
    await saveRuntime();
    sendJson(response, 200, { token, session, view: serverState.getStateForSession(session) });
    return;
  }

  sendError(response, 400, "unsupported role");
}

async function handleState(request, response) {
  const session = getSessionFromRequest(request);
  if (!session) {
    sendError(response, 401, "missing or invalid session");
    return;
  }
  sendJson(response, 200, { session, view: serverState.getStateForSession(session) });
}

async function handleStateRestore(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body?.state || !Array.isArray(body.state.characters) || !Array.isArray(body.state.turnEntries) || !Array.isArray(body.state.pendingInputs)) {
    sendError(response, 400, "invalid combat state snapshot");
    return;
  }
  serverState.setState(body.state);
  rebuildPendingPixelRolls();
  await saveRuntime();
  broadcastStateUpdate(body.reason || "state-restored");
  sendJson(response, 200, { session, view: serverState.getStateForSession(session) });
}

async function handleAppReset(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  serverState.resetState();
  pendingPixelRolls.clear();
  pixelsAssignments.clear();
  selectedPixelsDevices.clear();
  pixelsConfig.mode = PIXELS_MODE.PC_SET_3;
  pixelsConfig.sharedSet = [null, null, null];
  for (const monitor of pixelsMonitor.getSnapshot().monitors || []) {
    pixelsMonitor.unwatchDevice(monitor.address);
  }
  await saveRuntime();
  broadcastStateUpdate("app-reset");
  broadcastPixelsEvent("pixels-selection", {
    reason: "app-reset",
    selectedDevices: getSelectedPixelsPayload()
  });
  broadcastPixelsEvent("pixels-assignments", {
    reason: "app-reset",
    assignments: getAssignmentsPayload()
  });
  broadcastPixelsEvent("pixels-config", {
    reason: "app-reset",
    config: getPixelsConfigPayload()
  });
  broadcastPixelsEvent("pixels-status", pixelsMonitor.getSnapshot());
  sendJson(response, 200, { session, view: serverState.getStateForSession(session) });
}

async function handleCommand(request, response) {
  const session = getSessionFromRequest(request);
  if (!session) {
    sendError(response, 401, "missing or invalid session");
    return;
  }

  const command = await readJsonBody(request);
  try {
    const result = serverState.execute(session, command);
    if (command.type === "start-round") {
      resolveAutomaticInitiativeRolls();
    }
    rebuildPendingPixelRolls();
    await saveRuntime();
    broadcastStateUpdate(command.type);
    if (command.type === "start-round") {
      await triggerWaitLedEffectsForPendingRolls();
    }
    if (command.type === "resolve-initiative-roll") {
      await triggerCriticalLedEffect(command.characterId, Number(command.total));
    }
    sendJson(response, 200, { events: result.events, view: serverState.getStateForSession(session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(response, 400, message);
  }
}

async function handleEvents(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const token = url.searchParams.get("token");
  if (!token) {
    sendError(response, 401, "missing session token");
    return;
  }
  const session = sessions.get(token);
  if (!session) {
    sendError(response, 401, "invalid session token");
    return;
  }

  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
  response.write(": connected\n\n");
  eventStreams.set(token, response);
  sendSseEvent(response, "state", {
    reason: "initial-sync",
    session,
    view: serverState.getStateForSession(session)
  });
  if (session.role === "gm") {
    sendSseEvent(response, "pixels-status", pixelsMonitor.getSnapshot());
    sendSseEvent(response, "pixels-config", {
      reason: "initial-sync",
      config: getPixelsConfigPayload()
    });
    sendSseEvent(response, "pixels-assignments", {
      reason: "initial-sync",
      assignments: getAssignmentsPayload()
    });
    sendSseEvent(response, "pixels-selection", {
      reason: "initial-sync",
      selectedDevices: getSelectedPixelsPayload()
    });
  }

  const keepAliveId = setInterval(() => {
    response.write(": keepalive\n\n");
  }, 15000);

  request.on("close", () => {
    clearInterval(keepAliveId);
    eventStreams.delete(token);
  });
}

async function handleBluetoothDevices(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const devices = await listBluetoothDevices();
  sendJson(response, 200, { devices });
}

async function handleBluetoothScan(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  const devices = await scanBluetoothDevices(body.seconds);
  sendJson(response, 200, { devices });
}

async function handleBluetoothConnect(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }
  const device = await connectBluetoothDevice(body.address);
  sendJson(response, 200, { device });
}

async function handleBluetoothDisconnect(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }
  forgetPixelsGatt(body.address);
  const device = await disconnectBluetoothDevice(body.address);
  sendJson(response, 200, { device });
}

async function handlePixelsDevices(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const discover = request.url.includes("discover=1");
  if (discover) {
    await scanBluetoothDevices(4);
  }
  const devices = await listPixelsDevices(getSelectedPixelsPayload());
  sendJson(response, 200, { devices });
}

async function handleSelectedPixels(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  sendJson(response, 200, { selectedDevices: getSelectedPixelsPayload() });
}

async function handleSelectedPixelsUpdate(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }

  if (body.selected) {
    selectedPixelsDevices.set(body.address, {
      address: body.address,
      name: body.name || body.address
    });
  } else {
    selectedPixelsDevices.delete(body.address);
    pixelsAssignments.delete(body.address);
    pixelsMonitor.unwatchDevice(body.address);
  }

  rebuildPendingPixelRolls();
  await persistSelectedPixelsAndBroadcast(body.selected ? "pixels-selected" : "pixels-deselected");
  if (!body.selected) {
    await persistPixelsAssignmentsAndBroadcast("pixels-assignment-pruned");
  }
  sendJson(response, 200, { selectedDevices: getSelectedPixelsPayload() });
}

async function handlePixelsIdentify(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }
  const result = await identifyPixelsDevice(body.address);
  sendJson(response, 200, { device: result });
}

async function handlePixelsBlink(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }
  const result = await blinkPixelsDevice(body.address, {
    color: body.color,
    count: body.count,
    duration: body.duration,
    loopCount: body.loopCount
  });
  sendJson(response, 200, { device: result });
}

async function handlePixelsMonitorState(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  sendJson(response, 200, pixelsMonitor.getSnapshot());
}

async function handlePixelsAssignments(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  sendJson(response, 200, { assignments: getAssignmentsPayload() });
}

async function handlePixelsConfig(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  sendJson(response, 200, { config: getPixelsConfigPayload() });
}

async function handlePixelsConfigUpdate(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  const nextMode = normalizePixelsMode(body.mode);
  const previousMode = pixelsConfig.mode;
  pixelsConfig.mode = nextMode;

  if (nextMode === PIXELS_MODE.SHARED_SET_3) {
    pixelsAssignments.clear();
  } else if (previousMode === PIXELS_MODE.SHARED_SET_3 && nextMode !== PIXELS_MODE.SHARED_SET_3) {
    pixelsConfig.sharedSet = [null, null, null];
  }

  if (body.sharedSet !== undefined && nextMode === PIXELS_MODE.SHARED_SET_3) {
    pixelsConfig.sharedSet = normalizeSharedSet(body.sharedSet);
  }
  rebuildPendingPixelRolls();
  await persistPixelsAssignmentsAndBroadcast("pixels-assignments-reset-for-mode");
  await persistPixelsConfigAndBroadcast("pixels-config-saved");
  sendJson(response, 200, { config: getPixelsConfigPayload() });
}

async function handlePixelsAssignmentUpdate(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }

  if (body.characterId == null || body.characterId === "") {
    pixelsAssignments.delete(body.address);
  } else {
    const state = serverState.getState();
    const character = state.characters.find((entry) => entry.id === body.characterId);
    if (!character) {
      sendError(response, 400, "unknown character");
      return;
    }
    const requestedSlot = normalizeAssignmentSlot(body.slot);
    if (!requestedSlot) {
      sendError(response, 400, "slot 1-3 required");
      return;
    }
    const slotConflict = Array.from(pixelsAssignments.entries()).find(([address, assignment]) => {
      if (address === body.address) {
        return false;
      }
      return assignment.characterId === body.characterId && assignment.slot === requestedSlot;
    });
    if (slotConflict) {
      sendError(response, 400, `slot ${requestedSlot} already assigned`);
      return;
    }
    pixelsAssignments.set(body.address, {
      characterId: body.characterId,
      slot: requestedSlot
    });
  }

  rebuildPendingPixelRolls();
  await persistPixelsAssignmentsAndBroadcast("pixels-assignment-saved");
  sendJson(response, 200, { assignments: getAssignmentsPayload() });
}

async function handlePixelsWatchStart(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }
  const result = await pixelsMonitor.watchDevice(body.address);
  sendJson(response, 200, result);
}

async function handlePixelsWatchStop(request, response) {
  if (!requireGmSession(request, response)) {
    return;
  }
  const body = await readJsonBody(request);
  if (!body.address) {
    sendError(response, 400, "missing device address");
    return;
  }
  const result = pixelsMonitor.unwatchDevice(body.address);
  sendJson(response, 200, result);
}

async function handlePixelsRollIntegration(event) {
  if (!event.rollState) {
    return;
  }

  const acceptedStates = new Set(["rolled", "onFace", "handling"]);
  if (!acceptedStates.has(event.rollState.state)) {
    return;
  }
  const faceValue = Number(event.rollState.face);
  if (!Number.isInteger(faceValue) || faceValue < 1 || faceValue > 6) {
    return;
  }

  let pendingRoll = null;
  let slot = null;
  const mode = normalizePixelsMode(pixelsConfig.mode);
  if (mode === PIXELS_MODE.SHARED_SET_3) {
    const sharedSlot = getSharedSlotForAddress(event.address);
    if (!sharedSlot) {
      return;
    }
    const nextSharedCharacter = getPixelsCharactersInRosterOrder().find((character) => pendingPixelRolls.has(character.id));
    if (!nextSharedCharacter) {
      return;
    }
    pendingRoll = pendingPixelRolls.get(nextSharedCharacter.id) ?? null;
    slot = sharedSlot;
  } else {
    const assignment = getAssignedCharacterEntry(event.address);
    if (!assignment) {
      return;
    }
    pendingRoll = pendingPixelRolls.get(assignment.characterId) ?? null;
    slot = assignment.slot;
  }

  if (!pendingRoll) {
    return;
  }

  const lastAcceptedAt = pendingRoll.acceptedAtByAddress.get(event.address);
  const now = Date.now();
  if (lastAcceptedAt && now - lastAcceptedAt < PIXELS_ROLL_DEBOUNCE_MS) {
    broadcastPixelsEvent("pixels-roll-ignored", {
      characterId: pendingRoll.characterId,
      address: event.address,
      face: faceValue,
      reason: "debounced"
    });
    return;
  }
  pendingRoll.acceptedAtByAddress.set(event.address, now);
  if (pendingRoll.phase === "main" && pendingRoll.mode === PIXELS_MODE.PC_SET_3) {
    if (pendingRoll.results.some((entry) => entry.address === event.address)) {
      broadcastPixelsEvent("pixels-roll-ignored", {
        characterId: pendingRoll.characterId,
        address: event.address,
        face: faceValue,
        reason: "already-recorded"
      });
      return;
    }
  }
  if (pendingRoll.phase === "main" && pendingRoll.mode === PIXELS_MODE.SHARED_SET_3) {
    if (pendingRoll.results.some((entry) => entry.slot === slot)) {
      broadcastPixelsEvent("pixels-roll-ignored", {
        characterId: pendingRoll.characterId,
        address: event.address,
        face: faceValue,
        reason: "slot-already-recorded"
      });
      return;
    }
  }
  pendingRoll.results.push({
    address: event.address,
    slot,
    value: faceValue,
    phase: pendingRoll.phase
  });

  broadcastPixelsEvent("pixels-roll-progress", {
    characterId: pendingRoll.characterId,
    address: event.address,
    slot,
    face: faceValue,
    phase: pendingRoll.phase,
    collected: pendingRoll.results.map((entry, index) => ({
      address: entry.address,
      slot: entry.slot,
      label: pendingRoll.phase === "crit" ? "Krit-W6" : entry.slot ? `W${entry.slot}` : `W${index + 1}`,
      value: entry.value
    })),
    requiredDice: pendingRoll.requiredDice,
    assignedDice: pendingRoll.assignedDice
  });

  if (pendingRoll.results.length < pendingRoll.requiredDice) {
    return;
  }

  if (pendingRoll.phase === "main") {
    let faces = [];
    if (pendingRoll.mode === PIXELS_MODE.PC_SET_3 || pendingRoll.mode === PIXELS_MODE.SHARED_SET_3) {
      faces = pendingRoll.assignedDice
        .map((entry) => pendingRoll.results.find((result) => result.slot === entry.slot)?.value ?? null)
        .filter((value) => Number.isInteger(value));
    } else {
      faces = pendingRoll.results.map((entry) => entry.value).filter((value) => Number.isInteger(value));
    }
    if (faces.length < pendingRoll.requiredDice) {
      return;
    }
    const total = faces.slice(0, pendingRoll.requiredDice).reduce((sum, value) => sum + value, 0);
    if (total === 18) {
      pendingRoll.mainTotal = total;
      pendingRoll.mainFaces = faces.slice(0, pendingRoll.requiredDice);
      pendingRoll.phase = "crit";
      pendingRoll.requiredDice = 1;
      pendingRoll.results = [];
      broadcastPixelsEvent("pixels-roll-progress", {
        characterId: pendingRoll.characterId,
        phase: "crit",
        requiredDice: 1,
        collected: [],
        assignedDice: pendingRoll.assignedDice
      });
      return;
    }

    const result = serverState.execute(getGmSession(), {
      type: "resolve-initiative-roll",
      characterId: pendingRoll.characterId,
      total,
      critBonusRoll: null
    });
    pendingPixelRolls.delete(pendingRoll.characterId);
    rebuildPendingPixelRolls();
    await saveRuntime();
    broadcastStateUpdate("pixels-auto-resolve");
    broadcastPixelsEvent("pixels-roll-resolved", {
      characterId: pendingRoll.characterId,
      faces: faces.slice(0, 3),
      total,
      critBonusRoll: null
    });
    await triggerCriticalLedEffect(pendingRoll.characterId, total);
    if (normalizePixelsMode(pixelsConfig.mode) === PIXELS_MODE.SHARED_SET_3 && pendingPixelRolls.size) {
      await triggerWaitLedEffectsForPendingRolls();
    }
    broadcastPixelsEvent("pixels-status", pixelsMonitor.getSnapshot());
    return result;
  }

  const critBonusRoll = pendingRoll.results[0]?.value ?? null;
  const total = Number.isFinite(Number(pendingRoll.mainTotal)) ? Number(pendingRoll.mainTotal) : 18;
  const result = serverState.execute(getGmSession(), {
    type: "resolve-initiative-roll",
    characterId: pendingRoll.characterId,
    total,
    critBonusRoll
  });
  pendingPixelRolls.delete(pendingRoll.characterId);
  rebuildPendingPixelRolls();
  await saveRuntime();
  broadcastStateUpdate("pixels-auto-resolve");
  broadcastPixelsEvent("pixels-roll-resolved", {
    characterId: pendingRoll.characterId,
    faces: Array.isArray(pendingRoll.mainFaces) && pendingRoll.mainFaces.length ? pendingRoll.mainFaces : [18],
    total,
    critBonusRoll
  });
  await triggerCriticalLedEffect(pendingRoll.characterId, total);
  if (normalizePixelsMode(pixelsConfig.mode) === PIXELS_MODE.SHARED_SET_3 && pendingPixelRolls.size) {
    await triggerWaitLedEffectsForPendingRolls();
  }
  broadcastPixelsEvent("pixels-status", pixelsMonitor.getSnapshot());
  return result;
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  return "application/octet-stream";
}

async function serveStaticAsset(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const assetPath = path.normalize(path.join(clientPublicDir, normalizedPath));
  if (!assetPath.startsWith(clientPublicDir)) {
    sendError(response, 403, "forbidden");
    return;
  }

  try {
    const content = await readFile(assetPath);
    response.writeHead(200, { "content-type": getContentType(assetPath) });
    response.end(content);
  } catch {
    sendError(response, 404, "not found");
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    sendJson(response, 200, getBootstrap());
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/login") {
    await handleLogin(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    await handleState(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/state/restore") {
    await handleStateRestore(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/app/reset") {
    await handleAppReset(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/events") {
    await handleEvents(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/command") {
    await handleCommand(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/bluetooth/devices") {
    await handleBluetoothDevices(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/bluetooth/scan") {
    await handleBluetoothScan(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/bluetooth/connect") {
    await handleBluetoothConnect(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/bluetooth/disconnect") {
    await handleBluetoothDisconnect(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/pixels/devices") {
    await handlePixelsDevices(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/pixels/selected") {
    await handleSelectedPixels(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/pixels/selected") {
    await handleSelectedPixelsUpdate(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/pixels/identify") {
    await handlePixelsIdentify(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/pixels/blink") {
    await handlePixelsBlink(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/pixels/assignments") {
    await handlePixelsAssignments(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/pixels/config") {
    await handlePixelsConfig(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/pixels/config") {
    await handlePixelsConfigUpdate(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/pixels/assignments") {
    await handlePixelsAssignmentUpdate(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/pixels/monitor") {
    await handlePixelsMonitorState(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/pixels/watch/start") {
    await handlePixelsWatchStart(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/pixels/watch/stop") {
    await handlePixelsWatchStop(request, response);
    return;
  }
  if (request.method === "GET") {
    await serveStaticAsset(url.pathname, response);
    return;
  }
  sendError(response, 404, "not found");
}

export async function startHttpServer(port = PORT) {
  await loadRuntime();
  rebuildPendingPixelRolls();
  const httpServer = createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      sendError(response, 500, message);
    });
  });

  httpServer.listen(port, "127.0.0.1", () => {
    console.log(`FateVI Tracker Next listening on http://127.0.0.1:${port}`);
  });
  return httpServer;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  void startHttpServer();
}
