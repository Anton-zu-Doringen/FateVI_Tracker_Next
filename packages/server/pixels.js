import { execFile } from "node:child_process";
import { connectBluetoothDevice, listBluetoothDevices } from "./bluetooth.js";

const PIXELS_SERVICE_UUIDS = {
  modern: "a6b90001-7a5a-43f2-a962-350c8edc9b5b",
  legacy: "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
};

const PIXELS_NOTIFY_UUIDS = {
  modern: "a6b90002-7a5a-43f2-a962-350c8edc9b5b",
  legacy: "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
};

const PIXELS_WRITE_UUIDS = {
  modern: "a6b90003-7a5a-43f2-a962-350c8edc9b5b",
  legacy: "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
};

const PIXELS_MESSAGE_TYPES = {
  whoAreYou: 0x01,
  iAmADie: 0x02,
  rollState: 0x03,
  blink: 0x1d,
  blinkAck: 0x1e
};

const PIXELS_ROLL_STATES = {
  0: "unknown",
  1: "rolled",
  2: "handling",
  3: "rolling",
  4: "crooked",
  5: "onFace"
};

const FACE_MASK_ALL = 0xffffffff;
const gattCache = new Map();

export function forgetPixelsGatt(address) {
  if (!address) {
    return;
  }
  gattCache.delete(address);
}

function execFileAsync(command, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function normalizeUuid(value) {
  return String(value || "").trim().toLowerCase();
}

function addressToBluezDevicePath(address, adapterName = "hci0") {
  const normalizedAddress = String(address || "").trim().toUpperCase();
  if (!/^[0-9A-F:]{17}$/.test(normalizedAddress)) {
    throw new Error("invalid bluetooth address");
  }
  return `/org/bluez/${adapterName}/dev_${normalizedAddress.replaceAll(":", "_")}`;
}

async function runBusctl(args, timeoutMs = 15000) {
  const result = await execFileAsync("busctl", ["--system", ...args], timeoutMs);
  return result.stdout;
}

async function tryBluetoothctl(args, timeoutMs = 30000) {
  try {
    const result = await execFileAsync("bluetoothctl", args, timeoutMs);
    return result.stdout;
  } catch {
    return "";
  }
}

function parseBusctlPropertyValue(stdout) {
  const trimmed = String(stdout || "").trim();
  const firstSpaceIndex = trimmed.indexOf(" ");
  if (firstSpaceIndex === -1) {
    return "";
  }
  return trimmed.slice(firstSpaceIndex + 1).trim();
}

function parseStringProperty(stdout) {
  const raw = parseBusctlPropertyValue(stdout);
  const quotedMatch = /^"([\s\S]*)"$/.exec(raw);
  return quotedMatch ? quotedMatch[1] : raw;
}

function parseBooleanProperty(stdout) {
  return parseBusctlPropertyValue(stdout) === "true";
}

function parseStringArrayProperty(stdout) {
  const raw = parseBusctlPropertyValue(stdout);
  if (!raw) {
    return [];
  }
  const values = [];
  const quotedRegex = /"([^"]+)"/g;
  for (const match of raw.matchAll(quotedRegex)) {
    values.push(match[1]);
  }
  return values;
}

function parseByteArrayProperty(stdout) {
  const tokens = parseBusctlPropertyValue(stdout).split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return [];
  }
  if (tokens[0] === "0") {
    return [];
  }
  const byteTokens = tokens.slice(1);
  const bytes = [];
  for (const token of byteTokens) {
    const normalized = token.startsWith("0x") ? token.slice(2) : token;
    const value = Number.parseInt(normalized, 16);
    if (Number.isFinite(value)) {
      bytes.push(value & 0xff);
    }
  }
  return bytes;
}

function parseBusctlByteArray(stdout) {
  const tokens = String(stdout || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return [];
  }
  const normalizedTokens = tokens[0] === "ay" ? tokens.slice(1) : tokens;
  if (!normalizedTokens.length) {
    return [];
  }
  const count = Number.parseInt(normalizedTokens[0], 10);
  const byteTokens = Number.isFinite(count) ? normalizedTokens.slice(1) : normalizedTokens;
  const bytes = [];
  for (const token of byteTokens) {
    const normalized = token.startsWith("0x") ? token.slice(2) : token;
    const value = Number.parseInt(normalized, 16);
    if (Number.isFinite(value)) {
      bytes.push(value & 0xff);
    }
  }
  return bytes;
}

function parseTreePaths(stdout) {
  return String(stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("/org/bluez/"));
}

function encodeColor32(color) {
  const namedColors = {
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    white: "#ffffff",
    orange: "#ff7a00",
    yellow: "#ffd400"
  };
  const normalizedColor = String(color || "").trim().toLowerCase();
  const hexValue = normalizedColor in namedColors ? namedColors[normalizedColor] : normalizedColor;
  const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(hexValue);
  const fullHexMatch = /^#([0-9a-f]{6})$/i.exec(hexValue);
  let red = 255;
  let green = 255;
  let blue = 255;
  if (shortHexMatch) {
    red = Number.parseInt(shortHexMatch[1][0] + shortHexMatch[1][0], 16);
    green = Number.parseInt(shortHexMatch[1][1] + shortHexMatch[1][1], 16);
    blue = Number.parseInt(shortHexMatch[1][2] + shortHexMatch[1][2], 16);
  } else if (fullHexMatch) {
    red = Number.parseInt(fullHexMatch[1].slice(0, 2), 16);
    green = Number.parseInt(fullHexMatch[1].slice(2, 4), 16);
    blue = Number.parseInt(fullHexMatch[1].slice(4, 6), 16);
  }
  return ((red & 0xff) << 16) | ((green & 0xff) << 8) | (blue & 0xff);
}

function uint16ToBytes(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32ToBytes(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function uint32ToBytesBigEndian(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function bytesToHex(bytes) {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRawPixelsMessage(bytes) {
  if (!Array.isArray(bytes) || !bytes.length) {
    return false;
  }
  if (bytes[0] === 0x30) {
    return true;
  }
  return bytes[0] === 0x34 && bytes.length === 3;
}

function createSettledRollStateFromPrevious(previousRollState) {
  if (!previousRollState) {
    return null;
  }
  return {
    ...previousRollState,
    stateCode: 5,
    state: "onFace"
  };
}

async function ensurePixelsBluetoothConnected(address) {
  const devices = await listBluetoothDevices([{ address, name: address }]);
  const device = devices.find((entry) => entry.address === address) || null;
  if (device?.connected) {
    return device;
  }
  await tryBluetoothctl(["connect", address], 30000);
  await delay(180);
  const refreshedDevices = await listBluetoothDevices([{ address, name: address }]);
  return refreshedDevices.find((entry) => entry.address === address) || device;
}

function buildBlinkMessage({
  count = 1,
  duration = 1000,
  color = "#ffffff",
  fade = 0,
  loopCount = 1,
  faceMask = FACE_MASK_ALL
} = {}) {
  const normalizedCount = Math.max(1, Math.min(255, Math.round(Number(count) || 1)));
  const normalizedDuration = Math.max(1, Math.min(65535, Math.round(Number(duration) || 1000)));
  const normalizedFade = Math.max(0, Math.min(255, Math.round(Number(fade) || 0)));
  const normalizedLoopCount = Math.max(1, Math.min(255, Math.round(Number(loopCount) || 1)));
  const normalizedFaceMask = Number.isFinite(Number(faceMask)) ? Number(faceMask) >>> 0 : FACE_MASK_ALL;
  const color32 = encodeColor32(color);
  return [
    PIXELS_MESSAGE_TYPES.blink,
    normalizedCount,
    ...uint16ToBytes(normalizedDuration),
    ...uint32ToBytes(color32),
    ...uint32ToBytes(normalizedFaceMask),
    normalizedFade,
    normalizedLoopCount
  ];
}

async function getCharacteristicProperty(path, property) {
  const stdout = await runBusctl(["get-property", "org.bluez", path, "org.bluez.GattCharacteristic1", property]);
  return stdout;
}

async function listGattPaths(devicePath) {
  const stdout = await runBusctl(["--list", "tree", "org.bluez"]);
  return parseTreePaths(stdout).filter((path) => path.startsWith(devicePath));
}

async function tryReadCharacteristicMetadata(path) {
  try {
    const [uuidStdout, flagsStdout] = await Promise.all([
      getCharacteristicProperty(path, "UUID"),
      getCharacteristicProperty(path, "Flags")
    ]);
    let notifying = false;
    try {
      const notifyingStdout = await getCharacteristicProperty(path, "Notifying");
      notifying = parseBooleanProperty(notifyingStdout);
    } catch {
      notifying = false;
    }
    return {
      path,
      uuid: normalizeUuid(parseStringProperty(uuidStdout)),
      flags: parseStringArrayProperty(flagsStdout),
      notifying
    };
  } catch {
    return null;
  }
}

async function resolvePixelsGatt(address) {
  const devicePath = addressToBluezDevicePath(address);
  const paths = await listGattPaths(devicePath);
  const characteristics = [];
  for (const path of paths) {
    const metadata = await tryReadCharacteristicMetadata(path);
    if (metadata) {
      characteristics.push(metadata);
    }
  }

  const modernWrite = characteristics.find((entry) => entry.uuid === PIXELS_WRITE_UUIDS.modern);
  const legacyWrite = characteristics.find((entry) => entry.uuid === PIXELS_WRITE_UUIDS.legacy);
  const modernNotify = characteristics.find((entry) => entry.uuid === PIXELS_NOTIFY_UUIDS.modern);
  const legacyNotify = characteristics.find((entry) => entry.uuid === PIXELS_NOTIFY_UUIDS.legacy);
  const notifyFallback = characteristics.find(
    (entry) =>
      entry.path !== modernWrite?.path &&
      entry.path !== legacyWrite?.path &&
      entry.flags.includes("notify")
  );

  const protocol = modernWrite
    ? "modern"
    : legacyWrite
      ? "legacy"
      : "unknown";

  const resolved = {
    address,
    devicePath,
    protocol,
    writeCharacteristicPath: modernWrite?.path || legacyWrite?.path || null,
    notifyCharacteristicPath: modernNotify?.path || legacyNotify?.path || notifyFallback?.path || null,
    characteristics
  };
  if (resolved.writeCharacteristicPath || resolved.notifyCharacteristicPath) {
    gattCache.set(address, {
      address,
      devicePath: resolved.devicePath,
      protocol: resolved.protocol,
      writeCharacteristicPath: resolved.writeCharacteristicPath,
      notifyCharacteristicPath: resolved.notifyCharacteristicPath
    });
  }
  return resolved;
}

async function ensurePixelsGattReady(address) {
  const devicePath = addressToBluezDevicePath(address);
  await tryBluetoothctl(["connect", address], 30000);

  let lastGatt = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(350 + attempt * 120);
    const paths = await listGattPaths(devicePath);
    if (!paths.length) {
      continue;
    }
    lastGatt = await resolvePixelsGatt(address);
    if (lastGatt.writeCharacteristicPath) {
      return lastGatt;
    }
  }

  return lastGatt || resolvePixelsGatt(address);
}

async function resolvePixelsGattWithConnect(address) {
  let lastGatt = await resolvePixelsGatt(address);
  if (lastGatt.writeCharacteristicPath) {
    return lastGatt;
  }

  if (lastGatt.characteristics?.length) {
    const cachedGatt = gattCache.get(address);
    if (cachedGatt?.writeCharacteristicPath) {
      return {
        ...lastGatt,
        ...cachedGatt,
        characteristics: lastGatt.characteristics
      };
    }
    return lastGatt;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await connectBluetoothDevice(address);
    lastGatt = await ensurePixelsGattReady(address);
    if (lastGatt.writeCharacteristicPath) {
      return lastGatt;
    }
  }

  const cachedGatt = gattCache.get(address);
  if (cachedGatt?.writeCharacteristicPath) {
    return {
      ...lastGatt,
      ...cachedGatt,
      characteristics: lastGatt.characteristics
    };
  }

  return lastGatt;
}

async function writeCharacteristicValue(characteristicPath, bytes) {
  await runBusctl(
    [
      "call",
      "org.bluez",
      characteristicPath,
      "org.bluez.GattCharacteristic1",
      "WriteValue",
      "aya{sv}",
      String(bytes.length),
      ...bytes.map((byte) => String(byte)),
      "0"
    ],
    20000
  );
}

async function writeCharacteristicValueWithReconnect(address, characteristicPath, bytes) {
  try {
    await writeCharacteristicValue(characteristicPath, bytes);
  } catch (error) {
    if (!String(error?.message || error).includes("Not connected")) {
      throw error;
    }
    await tryBluetoothctl(["connect", address], 30000);
    await delay(150);
    await writeCharacteristicValue(characteristicPath, bytes);
  }
}

async function startNotify(characteristicPath) {
  await runBusctl(
    ["call", "org.bluez", characteristicPath, "org.bluez.GattCharacteristic1", "StartNotify"],
    15000
  );
}

async function readCharacteristicValue(characteristicPath) {
  try {
    const stdout = await runBusctl(
      ["call", "org.bluez", characteristicPath, "org.bluez.GattCharacteristic1", "ReadValue", "a{sv}", "0"],
      15000
    );
    const bytes = parseBusctlByteArray(stdout);
    if (bytes.length) {
      return bytes;
    }
  } catch {
    // Fall back to the cached Value property for notify-only characteristics.
  }

  const stdout = await getCharacteristicProperty(characteristicPath, "Value");
  return parseByteArrayProperty(stdout);
}

function decodeRollState(bytes) {
  if (!bytes.length || bytes[0] !== PIXELS_MESSAGE_TYPES.rollState) {
    return null;
  }
  const stateCode = bytes[1] ?? 0;
  const faceIndex = bytes[2] ?? 0;
  return {
    type: "rollState",
    stateCode,
    state: PIXELS_ROLL_STATES[stateCode] || "unknown",
    faceIndex,
    face: faceIndex + 1,
    rawHex: bytesToHex(bytes)
  };
}

function decodeIdentityResponse(bytes) {
  if (!bytes.length) {
    return { type: "empty", pixelId: null, ledCount: null, rawHex: "" };
  }
  const type = bytes[0];
  if (type !== PIXELS_MESSAGE_TYPES.iAmADie) {
    return {
      type: "unknown",
      pixelId: null,
      ledCount: null,
      rawHex: bytesToHex(bytes)
    };
  }

  if (bytes.length >= 10) {
    const ledCount = bytes[1];
    const pixelId = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    return {
      type: "iAmADie",
      pixelId: pixelId >>> 0,
      ledCount,
      rawHex: bytesToHex(bytes)
    };
  }

  return {
    type: "iAmADie",
    pixelId: null,
    ledCount: null,
    rawHex: bytesToHex(bytes)
  };
}

function isPixelsName(name) {
  return /^(pixel|pxl)/i.test(String(name || "").trim());
}

export async function listPixelsDevices(selectedDevices = []) {
  const devices = await listBluetoothDevices(selectedDevices);
  const selectedByAddress = new Map(
    (selectedDevices || [])
      .filter((entry) => entry?.address)
      .map((entry) => [entry.address, entry])
  );
  const pixelsDevices = [];

  for (const device of devices) {
    const selected = selectedByAddress.get(device.address) || null;
    if (!selected) {
      continue;
    }
    const pixelsCandidate = isPixelsName(device.name) || isPixelsName(device.alias);

    let gatt = null;
    try {
      gatt = await resolvePixelsGatt(device.address);
    } catch {
      gatt = null;
    }

    pixelsDevices.push({
      ...device,
      selected: true,
      rememberedName: selected.name || device.name,
      pixelsCandidate,
      pixelsLikely: Boolean(gatt?.writeCharacteristicPath) || pixelsCandidate,
      effectiveConnected: Boolean(device.connected || gatt?.writeCharacteristicPath),
      protocol: gatt?.protocol || "unknown",
      gattReady: Boolean(gatt?.writeCharacteristicPath),
      writeCharacteristicPath: gatt?.writeCharacteristicPath || null,
      notifyCharacteristicPath: gatt?.notifyCharacteristicPath || null
    });
  }

  return pixelsDevices.sort((left, right) => {
    const leftActive = Number(Boolean(left.effectiveConnected ?? (left.connected || left.gattReady)));
    const rightActive = Number(Boolean(right.effectiveConnected ?? (right.connected || right.gattReady)));
    return (
      rightActive - leftActive ||
      String(left.name || left.rememberedName || left.address).localeCompare(
        String(right.name || right.rememberedName || right.address),
        "de"
      )
    );
  });
}

export async function identifyPixelsDevice(address) {
  const gatt = await resolvePixelsGattWithConnect(address);
  if (!gatt.writeCharacteristicPath) {
    throw new Error("pixels write characteristic not found");
  }
  if (gatt.notifyCharacteristicPath) {
    try {
      await startNotify(gatt.notifyCharacteristicPath);
    } catch {
      // Notification subscription is helpful but optional for the request path.
    }
  }

  const requestBytes = [PIXELS_MESSAGE_TYPES.whoAreYou];
  await writeCharacteristicValueWithReconnect(address, gatt.writeCharacteristicPath, requestBytes);

  let responseBytes = [];
  if (gatt.notifyCharacteristicPath) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      responseBytes = await readCharacteristicValue(gatt.notifyCharacteristicPath);
    } catch {
      responseBytes = [];
    }
  }

  return {
    ...gatt,
    requestHex: bytesToHex(requestBytes),
    responseHex: bytesToHex(responseBytes),
    identity: decodeIdentityResponse(responseBytes)
  };
}

export async function blinkPixelsDevice(address, options = {}) {
  const gatt = await resolvePixelsGattWithConnect(address);
  if (!gatt.writeCharacteristicPath) {
    throw new Error("pixels write characteristic not found");
  }

  const bytes = buildBlinkMessage(options);
  await writeCharacteristicValueWithReconnect(address, gatt.writeCharacteristicPath, bytes);

  return {
    ...gatt,
    requestHex: bytesToHex(bytes),
    effect: {
      count: Math.max(1, Math.min(255, Math.round(Number(options.count) || 1))),
      duration: Math.max(1, Math.min(65535, Math.round(Number(options.duration) || 1000))),
      color: String(options.color || "#ffffff"),
      loopCount: Math.max(1, Math.min(255, Math.round(Number(options.loopCount) || 1)))
    }
  };
}

function createMonitorEntry(address) {
  return {
    address,
    status: "starting",
    protocol: "unknown",
    startedAt: new Date().toISOString(),
    lastEventAt: null,
    lastValueHex: "",
    lastError: null,
    deviceName: null,
    timerId: null,
    gatt: null,
    lastRollState: null,
    lastRollStateAt: 0
  };
}

export function createPixelsMonitorManager({
  intervalMs = 350,
  onEvent = () => {},
  onStatus = () => {}
} = {}) {
  const monitors = new Map();
  const recentEvents = [];

  function pushRecentEvent(event) {
    recentEvents.unshift(event);
    if (recentEvents.length > 50) {
      recentEvents.length = 50;
    }
  }

  function getSnapshot() {
    return {
      monitors: Array.from(monitors.values()).map((entry) => ({
        address: entry.address,
        status: entry.status,
        protocol: entry.protocol,
        startedAt: entry.startedAt,
        lastEventAt: entry.lastEventAt,
        lastValueHex: entry.lastValueHex,
        lastError: entry.lastError,
        deviceName: entry.deviceName
      })),
      recentEvents: [...recentEvents]
    };
  }

  function emitStatus(reason, extra = {}) {
    onStatus({
      reason,
      ...getSnapshot(),
      ...extra
    });
  }

  function emitEvent(event) {
    pushRecentEvent(event);
    onEvent(event);
    emitStatus("pixels-event", { event });
  }

  async function pollMonitor(entry) {
    try {
      await ensurePixelsBluetoothConnected(entry.address);
      if (!entry.gatt) {
        entry.gatt = await resolvePixelsGattWithConnect(entry.address);
        entry.protocol = entry.gatt.protocol;
      }
      if (!entry.gatt.notifyCharacteristicPath) {
        throw new Error("pixels notify characteristic not found");
      }

      try {
        await startNotify(entry.gatt.notifyCharacteristicPath);
      } catch {
        // The device may already be notifying.
      }

      let bytes = await readCharacteristicValue(entry.gatt.notifyCharacteristicPath);
      let rollState = decodeRollState(bytes);
      if (!rollState && isTransientRawPixelsMessage(bytes)) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await delay(70);
          const followUpBytes = await readCharacteristicValue(entry.gatt.notifyCharacteristicPath);
          const followUpRollState = decodeRollState(followUpBytes);
          if (followUpRollState) {
            bytes = followUpBytes;
            rollState = followUpRollState;
            break;
          }
          if (bytesToHex(followUpBytes) !== bytesToHex(bytes)) {
            bytes = followUpBytes;
          }
        }
      }

      if (
        !rollState &&
        isTransientRawPixelsMessage(bytes) &&
        entry.lastRollState &&
        ["rolling", "handling"].includes(entry.lastRollState.state) &&
        Date.now() - entry.lastRollStateAt < 1800
      ) {
        rollState = createSettledRollStateFromPrevious(entry.lastRollState);
      }

      const hex = bytesToHex(bytes);
      if (!hex || hex === entry.lastValueHex) {
        return;
      }

      entry.lastValueHex = hex;
      entry.lastEventAt = new Date().toISOString();
      if (rollState) {
        entry.lastRollState = rollState;
        entry.lastRollStateAt = Date.now();
      }
      emitEvent({
        kind: rollState ? "roll-state" : "raw-message",
        address: entry.address,
        protocol: entry.protocol,
        at: entry.lastEventAt,
        deviceName: entry.deviceName,
        rawHex: hex,
        rollState
      });
    } catch (error) {
      entry.lastError = error instanceof Error ? error.message : String(error);
      if (entry.status === "watching") {
        emitStatus("pixels-watch-error", { address: entry.address, error: entry.lastError });
      }
    }
  }

  async function enrichDeviceName(entry) {
    const devices = await listBluetoothDevices();
    const device = devices.find((candidate) => candidate.address === entry.address);
    entry.deviceName = device?.name || device?.alias || null;
  }

  async function watchDevice(address) {
    const existing = monitors.get(address);
    if (existing) {
      return {
        monitor: {
          address: existing.address,
          status: existing.status,
          protocol: existing.protocol,
          startedAt: existing.startedAt,
          lastEventAt: existing.lastEventAt,
          lastValueHex: existing.lastValueHex,
          lastError: existing.lastError,
          deviceName: existing.deviceName
        }
      };
    }

    const entry = createMonitorEntry(address);
    monitors.set(address, entry);
    await enrichDeviceName(entry);
    emitStatus("pixels-watch-starting", { address });

    try {
      await ensurePixelsBluetoothConnected(address);
      entry.gatt = await resolvePixelsGatt(address);
      if (!entry.gatt.writeCharacteristicPath && !entry.gatt.notifyCharacteristicPath) {
        entry.gatt = await resolvePixelsGattWithConnect(address);
      }
      entry.protocol = entry.gatt.protocol;
      if (!entry.gatt.notifyCharacteristicPath) {
        throw new Error("pixels notify characteristic not found");
      }
      await startNotify(entry.gatt.notifyCharacteristicPath);
      await delay(250);
      entry.status = "watching";
      entry.timerId = setInterval(() => {
        void pollMonitor(entry);
      }, intervalMs);
      await pollMonitor(entry);
      emitStatus("pixels-watch-started", { address });
    } catch (error) {
      entry.status = "error";
      entry.lastError = error instanceof Error ? error.message : String(error);
      emitStatus("pixels-watch-failed", { address, error: entry.lastError });
      throw error;
    }

    return {
      monitor: {
        address: entry.address,
        status: entry.status,
        protocol: entry.protocol,
        startedAt: entry.startedAt,
        lastEventAt: entry.lastEventAt,
        lastValueHex: entry.lastValueHex,
        lastError: entry.lastError,
        deviceName: entry.deviceName
      }
    };
  }

  function unwatchDevice(address) {
    const entry = monitors.get(address);
    if (!entry) {
      return { removed: false };
    }
    if (entry.timerId) {
      clearInterval(entry.timerId);
    }
    monitors.delete(address);
    emitStatus("pixels-watch-stopped", { address });
    return { removed: true };
  }

  function stopAll() {
    for (const entry of monitors.values()) {
      if (entry.timerId) {
        clearInterval(entry.timerId);
      }
    }
    monitors.clear();
    emitStatus("pixels-watch-cleared");
  }

  return {
    getSnapshot,
    watchDevice,
    unwatchDevice,
    stopAll
  };
}
