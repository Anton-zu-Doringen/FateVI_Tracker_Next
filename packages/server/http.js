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

const GM_PASSWORD = process.env.FATEVI_GM_PASSWORD ?? "gm";
const DEFAULT_GM_NAME = process.env.FATEVI_GM_NAME ?? "Spielleiter";
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_GM_PASSWORD = "gm";
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const serverState = new TrackerServer();
const sessions = new Map();
const eventStreams = new Map();
const gmAccounts = new Map();
const gmLibraries = new Map();
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientPublicDir = path.resolve(currentDir, "../client/public");
const dataDir = path.resolve(currentDir, "data");
const runtimeFile = path.join(dataDir, "runtime.json");
const librariesDir = path.join(dataDir, "libraries");
const execFileAsync = promisify(execFile);

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createSessionRecord(session, now = Date.now()) {
  return {
    session,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
  };
}

function closeSessionStream(token) {
  const stream = eventStreams.get(token);
  if (stream) {
    stream.end();
    eventStreams.delete(token);
  }
}

function isSessionRecordExpired(record, now = Date.now()) {
  return !record?.expiresAt || Date.parse(record.expiresAt) <= now;
}

function pruneExpiredSessions(now = Date.now()) {
  let changed = false;
  for (const [token, record] of sessions.entries()) {
    if (!isSessionRecordExpired(record, now)) {
      continue;
    }
    sessions.delete(token);
    closeSessionStream(token);
    changed = true;
  }
  return changed;
}

function getSessionRecord(token, options = {}) {
  const { touch = true } = options;
  pruneExpiredSessions();
  const record = sessions.get(token);
  if (!record) {
    return null;
  }
  if (!touch) {
    return record;
  }
  const now = Date.now();
  record.lastSeenAt = new Date(now).toISOString();
  record.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  return record;
}

async function saveRuntime() {
  await mkdir(dataDir, { recursive: true });
  const payload = {
    state: serverState.getState(),
    sessions: Array.from(sessions.entries()).map(([token, record]) => ({
      token,
      session: record.session,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
      expiresAt: record.expiresAt
    })),
    gmAccounts: Array.from(gmAccounts.values()).map((account) => ({
      id: account.id,
      name: account.name,
      salt: account.salt,
      passwordHash: account.passwordHash,
      createdAt: account.createdAt
    }))
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
    const now = Date.now();
    for (const entry of payload?.sessions || []) {
      if (entry?.token && entry?.session) {
        const record = {
          session: entry.session,
          createdAt: entry.createdAt || new Date(now).toISOString(),
          lastSeenAt: entry.lastSeenAt || entry.createdAt || new Date(now).toISOString(),
          expiresAt: entry.expiresAt || new Date(now + SESSION_TTL_MS).toISOString()
        };
        if (!isSessionRecordExpired(record, now)) {
          sessions.set(entry.token, record);
        }
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
      for (const [token, record] of sessions.entries()) {
        const session = record?.session;
        if (session?.role === "gm" && (!session.userId || session.userId === "gm" || !gmAccounts.has(session.userId))) {
          sessions.set(token, {
            ...record,
            session: {
              ...session,
              userId: fallbackAccount.id,
              displayName: fallbackAccount.name
            }
          });
        }
      }
    }
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

function getCharacterById(characterId) {
  return serverState.getState().characters.find((entry) => entry.id === characterId) ?? null;
}

function getInitiativeRollMode(character) {
  if (!character) {
    return "manual";
  }
  if (character.initiativeRollMode === "automatic" || character.initiativeRollMode === "manual") {
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
  let totalBytes = 0;
  for await (const chunk of request) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw createHttpError(413, `json body too large (max ${MAX_JSON_BODY_BYTES} bytes)`);
    }
    chunks.push(bufferChunk);
  }
  if (!chunks.length) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createHttpError(400, "invalid json body");
  }
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
  const record = getSessionRecord(token);
  return record?.session ?? null;
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
    const record = getSessionRecord(token, { touch: false });
    if (!record) {
      closeSessionStream(token);
      continue;
    }
    const session = record.session;
    sendSseEvent(response, "state", {
      reason,
      session,
      view: serverState.getStateForSession(session)
    });
  }
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
    sessions.set(token, createSessionRecord(session));
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
    sessions.set(token, createSessionRecord(session));
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
  closeSessionStream(token);
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
    existing.updatedAt = now;
  } else {
    library.snapshots = [
      {
        id: `snap-${randomUUID()}`,
        name,
        state,
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
  await saveRuntime();
  broadcastStateUpdate("snapshot-loaded");
  sendJson(response, 200, {
    library: getLibraryPayload(session.userId),
    session,
    view: serverState.getStateForSession(session)
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
  await saveRuntime();
  broadcastStateUpdate("app-reset");
  sendJson(response, 200, {
    session,
    view: serverState.getStateForSession(session)
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
    await saveRuntime();
    broadcastStateUpdate(command.type);
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
  const record = getSessionRecord(token);
  if (!record) {
    sendError(response, 401, "invalid session token");
    return;
  }
  const session = record.session;

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

  const keepAliveId = setInterval(() => {
    response.write(": keepalive\n\n");
  }, 15000);

  request.on("close", () => {
    clearInterval(keepAliveId);
    eventStreams.delete(token);
  });
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
    response.writeHead(200, {
      "content-type": getContentType(assetPath),
      "cache-control": "no-store, no-cache, must-revalidate",
      pragma: "no-cache",
      expires: "0"
    });
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
  if (request.method === "GET") {
    await serveStaticAsset(url.pathname, response);
    return;
  }
  sendError(response, 404, "not found");
}

export async function startHttpServer(port = PORT) {
  await loadRuntime();
  ensureDefaultGmAccount();
  if (GM_PASSWORD === DEFAULT_GM_PASSWORD) {
    console.warn("FATEVI_GM_PASSWORD is using the insecure default 'gm'. Set a custom password before non-local use.");
  }
  await saveRuntime();
  const httpServer = createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error && Number.isInteger(error.statusCode) ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : String(error);
      sendError(response, statusCode, message);
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
