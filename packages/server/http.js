import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createCharacter } from "@fatevi/rules";
import { TrackerServer } from "./dist/server.js";
import { connectBluetoothDevice, disconnectBluetoothDevice, listBluetoothDevices, scanBluetoothDevices } from "./bluetooth.js";
import { blinkPixelsDevice, createPixelsMonitorManager, forgetPixelsGatt, identifyPixelsDevice, listPixelsDevices } from "./pixels.js";

const GM_PASSWORD = process.env.FATEVI_GM_PASSWORD ?? "gm";
const DEFAULT_GM_NAME = process.env.FATEVI_GM_NAME ?? "Spielleiter";
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const serverState = new TrackerServer();
const sessions = new Map();
const eventStreams = new Map();
const bluetoothOperations = new Map();
const pixelsAssignments = new Map();
const selectedPixelsDevices = new Map();
const pendingPixelRolls = new Map();
const gmAccounts = new Map();
const gmLibraries = new Map();
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientPublicDir = path.resolve(currentDir, "../client/public");
const dataDir = path.resolve(currentDir, "data");
const runtimeFile = path.join(dataDir, "runtime.json");
const librariesDir = path.join(dataDir, "libraries");
const execFileAsync = promisify(execFile);
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
    gmAccounts: Array.from(gmAccounts.values()).map((account) => ({
      id: account.id,
      name: account.name,
      salt: account.salt,
      passwordHash: account.passwordHash,
      createdAt: account.createdAt
    })),
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
    gmAccounts.clear();
    for (const account of payload?.gmAccounts || []) {
      if (!account?.id || !account?.name || !account?.salt || !account?.passwordHash) {
        continue;
      }
      gmAccounts.set(account.id, {
        id: account.id,
        name: account.name,
        salt: account.salt,
        passwordHash: account.passwordHash,
        createdAt: account.createdAt || new Date().toISOString()
      });
    }
    gmLibraries.clear();
    ensureDefaultGmAccount();
    for (const accountId of gmAccounts.keys()) {
      await loadGmLibraryIntoCache(accountId);
    }
    await migrateLegacyLibraries(payload?.gmLibraries || []);
    const fallbackAccount = gmAccounts.values().next().value ?? null;
    if (fallbackAccount) {
      for (const [token, session] of sessions.entries()) {
        if (session?.role === "gm" && (!session.userId || session.userId === "gm" || !gmAccounts.has(session.userId))) {
          sessions.set(token, {
            ...session,
            userId: fallbackAccount.id,
            displayName: fallbackAccount.name
          });
        }
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

function hashPassword(password, salt) {
  return scryptSync(String(password), String(salt), 64).toString("hex");
}

function createAccountRecord(name, password) {
  const salt = randomBytes(16).toString("hex");
  return {
    id: `gm-${randomUUID()}`,
    name: String(name).trim(),
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString()
  };
}

function normalizeLibraryName(value, maxLength = 60) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeAccountStorageKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized || "sl-account";
}

function createEmptyLibrary() {
  return { snapshots: [], groups: [] };
}

function sanitizeLibraryEntries(entries) {
  return Array.isArray(entries) ? entries : [];
}

function getAccountRecord(accountId) {
  return gmAccounts.get(accountId) ?? null;
}

function getLibraryPaths(accountId) {
  const account = getAccountRecord(accountId);
  const storageKey = normalizeAccountStorageKey(account?.name || accountId);
  const accountDir = path.join(librariesDir, storageKey);
  return {
    accountDir,
    snapshotsFile: path.join(accountDir, "snapshots.json"),
    groupsFile: path.join(accountDir, "groups.json")
  };
}

function getAccountLibraryBundleName(accountId) {
  const account = getAccountRecord(accountId);
  return normalizeAccountStorageKey(account?.name || accountId);
}

async function readLibraryFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    const payload = JSON.parse(content);
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function loadGmLibraryIntoCache(accountId) {
  const { snapshotsFile, groupsFile } = getLibraryPaths(accountId);
  gmLibraries.set(accountId, {
    snapshots: sanitizeLibraryEntries(await readLibraryFile(snapshotsFile)),
    groups: sanitizeLibraryEntries(await readLibraryFile(groupsFile))
  });
  return ensureGmLibrary(accountId);
}

async function saveGmLibrary(accountId) {
  const library = ensureGmLibrary(accountId);
  const { accountDir, snapshotsFile, groupsFile } = getLibraryPaths(accountId);
  await mkdir(accountDir, { recursive: true });
  await writeFile(snapshotsFile, JSON.stringify(sanitizeLibraryEntries(library.snapshots), null, 2), "utf8");
  await writeFile(groupsFile, JSON.stringify(sanitizeLibraryEntries(library.groups), null, 2), "utf8");
}

async function exportGmLibraryArchive(accountId) {
  const library = ensureGmLibrary(accountId);
  const bundleName = getAccountLibraryBundleName(accountId);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fatevi-library-export-"));
  const bundleDir = path.join(tempRoot, bundleName);
  const archivePath = path.join(tempRoot, `${bundleName}.zip`);
  try {
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      path.join(bundleDir, "account.json"),
      JSON.stringify(
        {
          accountName: getAccountRecord(accountId)?.name || bundleName,
          exportedAt: new Date().toISOString(),
          version: 1
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(path.join(bundleDir, "snapshots.json"), JSON.stringify(sanitizeLibraryEntries(library.snapshots), null, 2), "utf8");
    await writeFile(path.join(bundleDir, "groups.json"), JSON.stringify(sanitizeLibraryEntries(library.groups), null, 2), "utf8");
    await execFileAsync("zip", ["-qr", archivePath, bundleName], { cwd: tempRoot });
    const archiveBuffer = await readFile(archivePath);
    return {
      fileName: `${bundleName}.zip`,
      archiveBuffer
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function mergeLibraryEntries(existingEntries, importedEntries, getKey) {
  const merged = [];
  const importedByKey = new Map();
  for (const entry of sanitizeLibraryEntries(importedEntries)) {
    importedByKey.set(getKey(entry), entry);
  }
  for (const entry of sanitizeLibraryEntries(existingEntries)) {
    const key = getKey(entry);
    if (importedByKey.has(key)) {
      merged.push(importedByKey.get(key));
      importedByKey.delete(key);
    } else {
      merged.push(entry);
    }
  }
  for (const entry of importedByKey.values()) {
    merged.push(entry);
  }
  return merged;
}

async function importGmLibraryArchive(accountId, archiveBuffer) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fatevi-library-import-"));
  const archivePath = path.join(tempRoot, "import.zip");
  const extractDir = path.join(tempRoot, "extract");
  try {
    await mkdir(extractDir, { recursive: true });
    await writeFile(archivePath, archiveBuffer);
    await execFileAsync("unzip", ["-oq", archivePath, "-d", extractDir]);
    const libraryRoot = await findImportedLibraryRoot(extractDir);
    const extractedEntries = await readFile(path.join(libraryRoot, "snapshots.json"), "utf8").catch(() => "[]");
    const extractedGroups = await readFile(path.join(libraryRoot, "groups.json"), "utf8").catch(() => "[]");
    const importedSnapshots = sanitizeLibraryEntries(JSON.parse(extractedEntries));
    const importedGroups = sanitizeLibraryEntries(JSON.parse(extractedGroups));
    const library = ensureGmLibrary(accountId);
    library.snapshots = mergeLibraryEntries(
      library.snapshots,
      importedSnapshots,
      (entry) => String(entry?.name || "").trim().toLowerCase()
    ).slice(0, 100);
    library.groups = mergeLibraryEntries(
      library.groups,
      importedGroups,
      (entry) => `${String(entry?.type || "").trim().toLowerCase()}::${String(entry?.name || "").trim().toLowerCase()}`
    ).slice(0, 200);
    await saveGmLibrary(accountId);
    return {
      importedSnapshots: importedSnapshots.length,
      importedGroups: importedGroups.length
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function findImportedLibraryRoot(extractDir) {
  const directCandidates = [extractDir];
  const topLevelEntries = await readdir(extractDir, { withFileTypes: true }).catch(() => []);
  for (const entry of topLevelEntries) {
    if (entry.isDirectory()) {
      directCandidates.push(path.join(extractDir, entry.name));
    }
  }
  for (const root of directCandidates) {
    try {
      const snapshots = await readFile(path.join(root, "snapshots.json"), "utf8");
      JSON.parse(snapshots);
      return root;
    } catch {
      // keep looking
    }
    const nestedEntries = await readdir(root, { withFileTypes: true }).catch(() => []);
    for (const entry of nestedEntries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const nestedRoot = path.join(root, entry.name);
      try {
        const snapshots = await readFile(path.join(nestedRoot, "snapshots.json"), "utf8");
        JSON.parse(snapshots);
        return nestedRoot;
      } catch {
        // keep looking
      }
    }
  }
  throw new Error("keine gültige Bibliotheksstruktur in ZIP gefunden");
}

async function migrateLegacyLibraries(legacyLibraries = []) {
  for (const entry of legacyLibraries) {
    if (!entry?.accountId) {
      continue;
    }
    const library = ensureGmLibrary(entry.accountId);
    const hasExistingData = (library.snapshots || []).length > 0 || (library.groups || []).length > 0;
    if (hasExistingData) {
      continue;
    }
    const migratedLibrary = {
      snapshots: sanitizeLibraryEntries(entry.snapshots),
      groups: sanitizeLibraryEntries(entry.groups)
    };
    if (!migratedLibrary.snapshots.length && !migratedLibrary.groups.length) {
      continue;
    }
    gmLibraries.set(entry.accountId, migratedLibrary);
    await saveGmLibrary(entry.accountId);
  }
}

function ensureGmLibrary(accountId) {
  if (!gmLibraries.has(accountId)) {
    gmLibraries.set(accountId, createEmptyLibrary());
  }
  return gmLibraries.get(accountId);
}

function getLibraryPayload(accountId) {
  const library = ensureGmLibrary(accountId);
  return {
    snapshots: (library.snapshots || []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      characterCount: Array.isArray(entry.state?.characters) ? entry.state.characters.length : 0,
      round: Number(entry.state?.round) || 0
    })),
    groups: (library.groups || []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      characterCount: Array.isArray(entry.characters) ? entry.characters.length : 0
    }))
  };
}

function createPixelsSnapshotState() {
  return {
    selectedDevices: getSelectedPixelsPayload(),
    assignments: getAssignmentsPayload(),
    config: getPixelsConfigPayload()
  };
}

function applyPixelsSnapshotState(snapshotPixelsState) {
  selectedPixelsDevices.clear();
  for (const entry of snapshotPixelsState?.selectedDevices || []) {
    if (!entry?.address) {
      continue;
    }
    selectedPixelsDevices.set(entry.address, {
      address: entry.address,
      name: entry.name || entry.address
    });
  }

  pixelsAssignments.clear();
  for (const entry of snapshotPixelsState?.assignments || []) {
    if (!entry?.address || typeof entry.characterId !== "string") {
      continue;
    }
    const normalizedSlot = normalizeAssignmentSlot(entry.slot);
    pixelsAssignments.set(entry.address, {
      characterId: entry.characterId,
      slot: normalizedSlot ?? findFirstFreeSlot(entry.characterId) ?? 1
    });
  }

  pixelsConfig.mode = normalizePixelsMode(snapshotPixelsState?.config?.mode);
  pixelsConfig.sharedSet = normalizeSharedSet(snapshotPixelsState?.config?.sharedSet);
}

function createCharacterId(name, type) {
  const base = String(name || "charakter")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "charakter";
  return `${type === "NPC" ? "npc" : "pc"}-${base}-${randomUUID().slice(0, 4)}`;
}

function createGroupCharacterTemplate(character) {
  return {
    name: String(character?.name || "Charakter").slice(0, 40),
    type: character?.type === "NPC" ? "NPC" : "PC",
    hidden: Boolean(character?.hidden),
    initiativeBase: Math.max(1, Math.min(30, Math.round(Number(character?.initiativeBase) || 10))),
    specialAbility: character?.specialAbility || null,
    initiativeRollMode: character?.initiativeRollMode || null,
    ownerUserId: character?.type === "PC" ? character?.ownerUserId || null : null
  };
}

function instantiateGroupCharacters(group) {
  return (group.characters || []).map((template) =>
    createCharacter({
      id: createCharacterId(template.name, template.type),
      name: template.name,
      type: template.type === "NPC" ? "NPC" : "PC",
      hidden: Boolean(template.hidden),
      initiativeBase: Math.max(1, Math.min(30, Math.round(Number(template.initiativeBase) || 10))),
      specialAbility: template.specialAbility || null,
      initiativeRollMode: template.initiativeRollMode || null,
      ownerUserId: template.type === "PC" ? template.ownerUserId || null : null
    })
  );
}

function verifyPassword(account, password) {
  const expected = Buffer.from(String(account.passwordHash), "hex");
  const actual = Buffer.from(hashPassword(password, account.salt), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizeAccountName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

function getAccountByName(name) {
  const normalizedName = normalizeAccountName(name).toLowerCase();
  return (
    Array.from(gmAccounts.values()).find((account) => normalizeAccountName(account.name).toLowerCase() === normalizedName) ?? null
  );
}

function ensureDefaultGmAccount() {
  if (gmAccounts.size > 0) {
    return;
  }
  const account = createAccountRecord(DEFAULT_GM_NAME, GM_PASSWORD);
  gmAccounts.set(account.id, account);
  ensureGmLibrary(account.id);
}

function getGmSession() {
  const firstAccount = gmAccounts.values().next().value;
  return {
    userId: firstAccount?.id || "gm",
    role: "gm",
    controlledCharacterId: null,
    displayName: firstAccount?.name || DEFAULT_GM_NAME
  };
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

function deviceNameForAddress(address) {
  return selectedPixelsDevices.get(address)?.name || bluetoothOperations.get(address)?.name || address;
}

function normalizeBluetoothDeviceName(name) {
  return String(name || "").trim().toLowerCase();
}

function extractPixelsSeriesSuffix(name) {
  const match = /^w\d+[a-z]?(\d+)$/i.exec(String(name || "").trim());
  return match ? match[1] : null;
}

async function findVisibleBluetoothDeviceByName(name, seconds = 8) {
  const normalizedName = normalizeBluetoothDeviceName(name);
  if (!normalizedName) {
    return null;
  }
  const devices = await scanBluetoothDevices(seconds);
  const directMatch =
    devices.find((device) => normalizeBluetoothDeviceName(device.name) === normalizedName) ||
    devices.find((device) => normalizeBluetoothDeviceName(device.alias) === normalizedName) ||
    null;
  if (directMatch) {
    return directMatch;
  }

  const requestedSuffix = extractPixelsSeriesSuffix(name);
  if (requestedSuffix) {
    const suffixMatches = devices.filter((device) => {
      const candidateName = device.name || device.alias || "";
      return normalizeBluetoothDeviceName(candidateName).startsWith("w") && extractPixelsSeriesSuffix(candidateName) === requestedSuffix;
    });
    if (suffixMatches.length === 1) {
      return suffixMatches[0];
    }
  }

  return null;
}

async function rebindSelectedPixelsDevice(oldAddress, nextDevice) {
  if (!oldAddress || !nextDevice?.address || oldAddress === nextDevice.address) {
    return false;
  }

  const previousSelection = selectedPixelsDevices.get(oldAddress);
  if (!previousSelection) {
    return false;
  }

  selectedPixelsDevices.delete(oldAddress);
  selectedPixelsDevices.set(nextDevice.address, {
    address: nextDevice.address,
    name: nextDevice.name || previousSelection.name || nextDevice.address
  });

  const previousAssignment = pixelsAssignments.get(oldAddress);
  if (previousAssignment) {
    pixelsAssignments.delete(oldAddress);
    pixelsAssignments.set(nextDevice.address, previousAssignment);
  }

  pixelsConfig.sharedSet = normalizeSharedSet(pixelsConfig.sharedSet).map((address) =>
    address === oldAddress ? nextDevice.address : address
  );

  pixelsMonitor.unwatchDevice(oldAddress);
  forgetPixelsGatt(oldAddress);
  rebuildPendingPixelRolls();
  await saveRuntime();
  broadcastPixelsEvent("pixels-selection", {
    reason: "pixels-device-rebound",
    selectedDevices: getSelectedPixelsPayload()
  });
  broadcastPixelsEvent("pixels-assignments", {
    reason: "pixels-device-rebound",
    assignments: getAssignmentsPayload()
  });
  broadcastPixelsEvent("pixels-config", {
    reason: "pixels-device-rebound",
    config: getPixelsConfigPayload()
  });
  return true;
}

async function tryPixelsGattFallback(address, name = null) {
  const devices = await listPixelsDevices([{ address, name: name || address }]);
  const device = devices.find((entry) => entry.address === address) || null;
  if (!device) {
    return null;
  }
  if (device.gattReady || device.writeCharacteristicPath || device.notifyCharacteristicPath || device.effectiveConnected) {
    return device;
  }
  return null;
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

async function startPixelsWatchesForPendingRolls() {
  const addresses = [
    ...new Set(Array.from(pendingPixelRolls.values()).flatMap((entry) => entry.assignedAddresses || []).filter(Boolean))
  ];
  for (const address of addresses) {
    try {
      await pixelsMonitor.watchDevice(address);
    } catch (error) {
      broadcastPixelsEvent("pixels-watch-auto-error", {
        address,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
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

async function readRequestBuffer(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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

function getBluetoothOperationsPayload() {
  return {
    operations: Array.from(bluetoothOperations.values()).sort((left, right) =>
      String(left.name || left.address).localeCompare(String(right.name || right.address), "de")
    )
  };
}

function broadcastBluetoothOperations(reason, extra = {}) {
  broadcastPixelsEvent("bluetooth-operation", {
    reason,
    ...getBluetoothOperationsPayload(),
    ...extra
  });
}

function updateBluetoothOperation(address, patch = {}) {
  const current = bluetoothOperations.get(address) || {
    address,
    name: patch.name || address,
    kind: "connect",
    status: "idle",
    stage: "idle",
    message: "",
    startedAt: null,
    updatedAt: new Date().toISOString()
  };
  const next = {
    ...current,
    ...patch,
    address,
    name: patch.name || current.name || address,
    updatedAt: new Date().toISOString()
  };
  bluetoothOperations.set(address, next);
  broadcastBluetoothOperations("operation-updated", { address, operation: next });
  return next;
}

function clearBluetoothOperation(address, reason = "operation-cleared") {
  if (!bluetoothOperations.has(address)) {
    return;
  }
  bluetoothOperations.delete(address);
  broadcastBluetoothOperations(reason, { address });
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
    gmLoginHint:
      gmAccounts.size > 0
        ? `${gmAccounts.size} SL-Account${gmAccounts.size === 1 ? "" : "s"} verfügbar. Standardaccount: ${DEFAULT_GM_NAME}.`
        : "Noch kein SL-Account vorhanden.",
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
    const name = normalizeAccountName(body.name);
    const password = String(body.password || "");
    const account = getAccountByName(name);
    if (!account || !verifyPassword(account, password)) {
      sendError(response, 401, "invalid gm credentials");
      return;
    }
    const session = { userId: account.id, role: "gm", controlledCharacterId: null, displayName: account.name };
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

async function handleLogout(request, response) {
  const token = getBearerToken(request);
  if (!token) {
    sendError(response, 401, "missing or invalid session");
    return;
  }
  sessions.delete(token);
  const stream = eventStreams.get(token);
  if (stream) {
    stream.end();
    eventStreams.delete(token);
  }
  await saveRuntime();
  sendJson(response, 200, { ok: true });
}

async function handleAccountRegister(request, response) {
  const body = await readJsonBody(request);
  const name = normalizeAccountName(body.name);
  const password = String(body.password || "");
  if (!name) {
    sendError(response, 400, "account name required");
    return;
  }
  if (password.length < 4) {
    sendError(response, 400, "password must be at least 4 characters");
    return;
  }
  if (getAccountByName(name)) {
    sendError(response, 400, "account name already exists");
    return;
  }
  const account = createAccountRecord(name, password);
  gmAccounts.set(account.id, account);
  ensureGmLibrary(account.id);
  await saveGmLibrary(account.id);
  await saveRuntime();
  sendJson(response, 200, { account: { id: account.id, name: account.name, role: "gm", createdAt: account.createdAt } });
}

async function handleAccountInfo(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const account = gmAccounts.get(session.userId);
  if (!account) {
    sendError(response, 404, "account not found");
    return;
  }
  sendJson(response, 200, {
    account: {
      id: account.id,
      name: account.name,
      role: "gm",
      createdAt: account.createdAt
    }
  });
}

async function handleAccountPasswordUpdate(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const account = gmAccounts.get(session.userId);
  if (!account) {
    sendError(response, 404, "account not found");
    return;
  }
  const body = await readJsonBody(request);
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!verifyPassword(account, currentPassword)) {
    sendError(response, 401, "current password invalid");
    return;
  }
  if (newPassword.length < 4) {
    sendError(response, 400, "new password must be at least 4 characters");
    return;
  }
  const updatedAccount = createAccountRecord(account.name, newPassword);
  gmAccounts.set(account.id, {
    ...account,
    salt: updatedAccount.salt,
    passwordHash: updatedAccount.passwordHash
  });
  await saveRuntime();
  sendJson(response, 200, { ok: true });
}

async function handleLibraryList(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  sendJson(response, 200, { library: getLibraryPayload(session.userId) });
}

async function handleLibraryExport(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const { fileName, archiveBuffer } = await exportGmLibraryArchive(session.userId);
  response.writeHead(200, {
    "content-type": "application/zip",
    "content-disposition": `attachment; filename="${fileName}"`,
    "content-length": String(archiveBuffer.length)
  });
  response.end(archiveBuffer);
}

async function handleLibraryImport(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const archiveBuffer = await readRequestBuffer(request);
  if (!archiveBuffer.length) {
    sendError(response, 400, "keine ZIP-Datei empfangen");
    return;
  }
  const result = await importGmLibraryArchive(session.userId, archiveBuffer);
  sendJson(response, 200, {
    ok: true,
    importedSnapshots: result.importedSnapshots,
    importedGroups: result.importedGroups,
    library: getLibraryPayload(session.userId)
  });
}

async function handleSnapshotSave(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const body = await readJsonBody(request);
  const name = normalizeLibraryName(body?.name, 80);
  if (!name) {
    sendError(response, 400, "snapshot name required");
    return;
  }
  const library = ensureGmLibrary(session.userId);
  const existing = (library.snapshots || []).find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  const now = new Date().toISOString();
  const state = serverState.getState();
  if (existing) {
    existing.state = state;
    existing.pixelsState = createPixelsSnapshotState();
    existing.updatedAt = now;
  } else {
    library.snapshots = [
      {
        id: `snap-${randomUUID()}`,
        name,
        state,
        pixelsState: createPixelsSnapshotState(),
        createdAt: now,
        updatedAt: now
      },
      ...(library.snapshots || [])
    ].slice(0, 30);
  }
  await saveGmLibrary(session.userId);
  sendJson(response, 200, { library: getLibraryPayload(session.userId) });
}

async function handleSnapshotLoad(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const body = await readJsonBody(request);
  const library = ensureGmLibrary(session.userId);
  const snapshot = (library.snapshots || []).find((entry) => entry.id === body?.snapshotId);
  if (!snapshot?.state) {
    sendError(response, 404, "snapshot not found");
    return;
  }
  serverState.setState(snapshot.state);
  applyPixelsSnapshotState(snapshot.pixelsState);
  rebuildPendingPixelRolls();
  await saveRuntime();
  broadcastStateUpdate("snapshot-loaded");
  broadcastPixelsEvent("pixels-selection", {
    reason: "snapshot-loaded",
    selectedDevices: getSelectedPixelsPayload()
  });
  broadcastPixelsEvent("pixels-assignments", {
    reason: "snapshot-loaded",
    assignments: getAssignmentsPayload()
  });
  broadcastPixelsEvent("pixels-config", {
    reason: "snapshot-loaded",
    config: getPixelsConfigPayload()
  });
  sendJson(response, 200, {
    library: getLibraryPayload(session.userId),
    session,
    view: serverState.getStateForSession(session),
    selectedDevices: getSelectedPixelsPayload(),
    assignments: getAssignmentsPayload(),
    config: getPixelsConfigPayload()
  });
}

async function handleSnapshotDelete(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const body = await readJsonBody(request);
  const library = ensureGmLibrary(session.userId);
  library.snapshots = (library.snapshots || []).filter((entry) => entry.id !== body?.snapshotId);
  await saveGmLibrary(session.userId);
  sendJson(response, 200, { library: getLibraryPayload(session.userId) });
}

async function handleGroupSave(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const body = await readJsonBody(request);
  const type = body?.type === "NPC" ? "NPC" : body?.type === "PC" ? "PC" : null;
  const name = normalizeLibraryName(body?.name, 80);
  if (!type) {
    sendError(response, 400, "group type required");
    return;
  }
  if (!name) {
    sendError(response, 400, "group name required");
    return;
  }
  const characters = serverState
    .getState()
    .characters.filter((character) => character.type === type)
    .map((character) => createGroupCharacterTemplate(character));
  if (!characters.length) {
    sendError(response, 400, "no characters available for group");
    return;
  }
  const library = ensureGmLibrary(session.userId);
  const existing = (library.groups || []).find(
    (entry) => entry.type === type && String(entry.name).toLowerCase() === name.toLowerCase()
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.characters = characters;
    existing.updatedAt = now;
  } else {
    library.groups = [
      {
        id: `group-${randomUUID()}`,
        name,
        type,
        characters,
        createdAt: now,
        updatedAt: now
      },
      ...(library.groups || [])
    ].slice(0, 60);
  }
  await saveGmLibrary(session.userId);
  sendJson(response, 200, { library: getLibraryPayload(session.userId) });
}

async function handleGroupLoad(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const body = await readJsonBody(request);
  const library = ensureGmLibrary(session.userId);
  const group = (library.groups || []).find((entry) => entry.id === body?.groupId);
  if (!group) {
    sendError(response, 404, "group not found");
    return;
  }
  const currentState = serverState.getState();
  const importedCharacters = instantiateGroupCharacters(group);
  serverState.setState({
    ...currentState,
    characters: [...currentState.characters, ...importedCharacters]
  });
  await saveRuntime();
  broadcastStateUpdate("group-loaded");
  sendJson(response, 200, {
    library: getLibraryPayload(session.userId),
    session,
    view: serverState.getStateForSession(session)
  });
}

async function handleGroupDelete(request, response) {
  const session = requireGmSession(request, response);
  if (!session) {
    return;
  }
  const body = await readJsonBody(request);
  const library = ensureGmLibrary(session.userId);
  library.groups = (library.groups || []).filter((entry) => entry.id !== body?.groupId);
  await saveGmLibrary(session.userId);
  sendJson(response, 200, { library: getLibraryPayload(session.userId) });
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
  await saveRuntime();
  broadcastStateUpdate("app-reset");
  sendJson(response, 200, {
    session,
    view: serverState.getStateForSession(session),
    selectedDevices: getSelectedPixelsPayload(),
    assignments: getAssignmentsPayload(),
    config: getPixelsConfigPayload()
  });
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
    if (command.type === "start-round") {
      await startPixelsWatchesForPendingRolls();
    }
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
    sendSseEvent(response, "bluetooth-operation", {
      reason: "initial-sync",
      ...getBluetoothOperationsPayload()
    });
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
  updateBluetoothOperation("__scan__", {
    address: "__scan__",
    name: "Bluetooth-Scan",
    kind: "scan",
    status: "running",
    stage: "scan",
    message: "Bluetooth-Scan läuft.",
    startedAt: new Date().toISOString()
  });
  try {
    const devices = await scanBluetoothDevices(body.seconds);
    updateBluetoothOperation("__scan__", {
      status: "completed",
      stage: "ready",
      message: `${devices.length} Geräte geladen.`
    });
    sendJson(response, 200, { devices });
  } catch (error) {
    updateBluetoothOperation("__scan__", {
      status: "failed",
      stage: "scan",
      message: error instanceof Error ? error.message : String(error)
    });
    sendError(response, 400, error instanceof Error ? error.message : String(error));
  } finally {
    setTimeout(() => clearBluetoothOperation("__scan__", "scan-finished"), 4000);
  }
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
  const operationStart = new Date().toISOString();
  updateBluetoothOperation(body.address, {
    name: body.name || body.address,
    kind: "connect",
    status: "running",
    stage: "inspect",
    message: "Verbindung wird vorbereitet.",
    startedAt: operationStart
  });
  try {
    const device = await connectBluetoothDevice(body.address, {
      allowPairingFallback: false,
      onProgress: (progress) => {
        updateBluetoothOperation(body.address, {
          name: deviceNameForAddress(body.address) || body.name || body.address,
          kind: "connect",
          status: progress.status === "failed" ? "failed" : "running",
          stage: progress.stage,
          message: progress.message || "",
          startedAt: operationStart
        });
      }
    });
    updateBluetoothOperation(body.address, {
      name: device.name || body.name || body.address,
      kind: "connect",
      status: "completed",
      stage: "ready",
      message: "Gerät ist verbunden."
    });
    sendJson(response, 200, { device });
    setTimeout(() => clearBluetoothOperation(body.address, "connect-finished"), 5000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      [
        "Bluetooth-Verbindung hat nicht rechtzeitig geantwortet. Würfel aktivieren und direkt erneut verbinden.",
        "Bluetooth-Verbindung wurde vom Würfel abgelehnt oder ist abgelaufen. Würfel aktivieren und direkt erneut verbinden.",
        "direct connect did not establish a stable bluez link"
      ].includes(message)
    ) {
      const fallbackDevice = await tryPixelsGattFallback(body.address, body.name);
      if (fallbackDevice) {
        updateBluetoothOperation(body.address, {
          name: fallbackDevice.name || body.name || body.address,
          kind: "connect",
          status: "completed",
          stage: "ready",
          message: "Gerät ohne klassisches Pairing über GATT erreichbar."
        });
        sendJson(response, 200, { device: fallbackDevice, degradedPairing: true });
        setTimeout(() => clearBluetoothOperation(body.address, "connect-finished"), 5000);
        return;
      }
    }
    if (
      body.name &&
      [
        "device is not currently visible over BLE",
        "device is not currently advertising over BLE",
        "direct connect did not establish a stable bluez link"
      ].includes(message)
    ) {
      updateBluetoothOperation(body.address, {
        kind: "connect",
        status: "running",
        stage: "scan",
        message: `Gemerkter Würfel nicht sichtbar. Suche ${body.name} neu.`
      });
      try {
        const reboundDevice = await findVisibleBluetoothDeviceByName(body.name, 8);
        if (!reboundDevice) {
          throw new Error(`Kein sichtbarer BLE-Würfel mit Name ${body.name} gefunden`);
        }
        await rebindSelectedPixelsDevice(body.address, reboundDevice);
        clearBluetoothOperation(body.address, "connect-rebound");
        updateBluetoothOperation(reboundDevice.address, {
          name: reboundDevice.name || body.name,
          kind: "connect",
          status: "running",
          stage: "inspect",
          message: `Würfel unter neuer Adresse gefunden: ${reboundDevice.address}`
        });
        const device = await connectBluetoothDevice(reboundDevice.address, {
          allowPairingFallback: false,
          onProgress: (progress) => {
            updateBluetoothOperation(reboundDevice.address, {
              name: reboundDevice.name || body.name || reboundDevice.address,
              kind: "connect",
              status: progress.status === "failed" ? "failed" : "running",
              stage: progress.stage,
              message: progress.message || "",
              startedAt: operationStart
            });
          }
        });
        updateBluetoothOperation(reboundDevice.address, {
          name: device.name || reboundDevice.name || body.name || reboundDevice.address,
          kind: "connect",
          status: "completed",
          stage: "ready",
          message: "Gerät ist verbunden."
        });
        sendJson(response, 200, { device, reboundFromAddress: body.address });
        setTimeout(() => clearBluetoothOperation(reboundDevice.address, "connect-finished"), 5000);
        return;
      } catch (rebindError) {
        const rebindMessage = rebindError instanceof Error ? rebindError.message : String(rebindError);
        if (
          [
            "Bluetooth-Verbindung hat nicht rechtzeitig geantwortet. Würfel aktivieren und direkt erneut verbinden.",
            "Bluetooth-Verbindung wurde vom Würfel abgelehnt oder ist abgelaufen. Würfel aktivieren und direkt erneut verbinden.",
            "direct connect did not establish a stable bluez link"
          ].includes(rebindMessage)
        ) {
          const fallbackDevice = await tryPixelsGattFallback(reboundDevice.address, reboundDevice.name || body.name);
          if (fallbackDevice) {
            updateBluetoothOperation(reboundDevice.address, {
              name: fallbackDevice.name || reboundDevice.name || body.name || reboundDevice.address,
              kind: "connect",
              status: "completed",
              stage: "ready",
              message: "Gerät ohne klassisches Pairing über GATT erreichbar."
            });
            sendJson(response, 200, {
              device: fallbackDevice,
              reboundFromAddress: body.address,
              degradedPairing: true
            });
            setTimeout(() => clearBluetoothOperation(reboundDevice.address, "connect-finished"), 5000);
            return;
          }
        }
        if (rebindMessage === "direct connect did not establish a stable bluez link") {
          updateBluetoothOperation(body.address, {
            kind: "connect",
            status: "failed",
            stage: "connect",
            message: "Würfel reagiert, aber BlueZ liefert noch keinen nutzbaren Link. Erneut aufwecken und erneut verbinden."
          });
          sendError(response, 400, "Würfel reagiert, aber BlueZ liefert noch keinen nutzbaren Link. Erneut aufwecken und erneut verbinden.");
          return;
        }
        updateBluetoothOperation(body.address, {
          kind: "connect",
          status: "failed",
          stage: "scan",
          message: rebindMessage
        });
        sendError(response, 400, rebindMessage);
        return;
      }
    }
    updateBluetoothOperation(body.address, {
      kind: "connect",
      status: "failed",
      stage: "connect",
      message
    });
    sendError(response, 400, message);
  }
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
  updateBluetoothOperation(body.address, {
    name: body.name || deviceNameForAddress(body.address) || body.address,
    kind: "disconnect",
    status: "running",
    stage: "disconnect",
    message: "Gerät wird getrennt.",
    startedAt: new Date().toISOString()
  });
  forgetPixelsGatt(body.address);
  try {
    const device = await disconnectBluetoothDevice(body.address);
    updateBluetoothOperation(body.address, {
      name: device?.name || body.name || body.address,
      kind: "disconnect",
      status: "completed",
      stage: "ready",
      message: "Gerät ist getrennt."
    });
    sendJson(response, 200, { device });
    setTimeout(() => clearBluetoothOperation(body.address, "disconnect-finished"), 4000);
  } catch (error) {
    updateBluetoothOperation(body.address, {
      kind: "disconnect",
      status: "failed",
      stage: "disconnect",
      message: error instanceof Error ? error.message : String(error)
    });
    sendError(response, 400, error instanceof Error ? error.message : String(error));
  }
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
  if (request.method === "POST" && url.pathname === "/api/accounts/register") {
    await handleAccountRegister(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/login") {
    await handleLogin(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/logout") {
    await handleLogout(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    await handleState(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/account") {
    await handleAccountInfo(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/account/password") {
    await handleAccountPasswordUpdate(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/library") {
    await handleLibraryList(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/library/export") {
    await handleLibraryExport(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/library/import") {
    await handleLibraryImport(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/library/snapshots/save") {
    await handleSnapshotSave(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/library/snapshots/load") {
    await handleSnapshotLoad(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/library/snapshots/delete") {
    await handleSnapshotDelete(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/library/groups/save") {
    await handleGroupSave(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/library/groups/load") {
    await handleGroupLoad(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/library/groups/delete") {
    await handleGroupDelete(request, response);
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
  ensureDefaultGmAccount();
  await saveRuntime();
  rebuildPendingPixelRolls();
  const httpServer = createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      sendError(response, 500, message);
    });
  });

  httpServer.listen(port, HOST, () => {
    console.log(`FateVI Tracker Next listening on http://${HOST}:${port}`);
  });
  return httpServer;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  void startHttpServer();
}
