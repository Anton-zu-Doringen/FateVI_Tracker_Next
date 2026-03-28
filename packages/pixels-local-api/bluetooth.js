import { execFile, spawn } from "node:child_process";

function normalizeCommandError(command, error, stderr = "", stdout = "") {
  const message = String(stderr || stdout || error?.message || "").trim();
  if (error?.code === "ENOENT") {
    return new Error(`${command} ist auf diesem Rechner nicht installiert oder nicht im PATH verfügbar`);
  }
  if (message.includes("org.bluez.Error.AuthenticationFailed")) {
    return new Error("Bluetooth-Verbindung wurde vom Würfel abgelehnt oder ist abgelaufen. Würfel aktivieren und direkt erneut verbinden.");
  }
  return new Error(message || `${command} fehlgeschlagen`);
}

function execFileAsync(command, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(normalizeCommandError(command, error, stderr, stdout));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseBooleanValue(value) {
  return String(value || "").trim().toLowerCase() === "yes";
}

function createBaseDevice(address, name = null) {
  return {
    address,
    name: name || address,
    alias: null,
    available: false,
    paired: false,
    trusted: false,
    connected: false,
    blocked: false,
    rssi: null,
    debug: null
  };
}

function parseDeviceLine(line) {
  const trimmed = String(line || "").trim();
  const directMatch = /^Device ([0-9A-F:]{17})\s+(.+)$/.exec(trimmed);
  if (directMatch) {
    return {
      address: directMatch[1],
      name: directMatch[2]
    };
  }

  const scanMatch = /Device ([0-9A-F:]{17})\s+(.+)$/.exec(trimmed);
  if (scanMatch) {
    return {
      address: scanMatch[1],
      name: scanMatch[2]
    };
  }

  return null;
}

function parseDevices(stdout) {
  const devices = new Map();
  for (const rawLine of String(stdout || "").split("\n")) {
    const parsed = parseDeviceLine(rawLine);
    if (!parsed) {
      continue;
    }
    devices.set(parsed.address, {
      address: parsed.address,
      name: parsed.name
    });
  }
  return Array.from(devices.values());
}

function parseInfo(stdout, fallback) {
  const lines = stdout.split("\n").map((line) => line.trim());
  const values = new Map();
  for (const line of lines) {
    const match = /^([^:]+):\s*(.+)$/.exec(line);
    if (match) {
      values.set(match[1], match[2]);
    }
  }

  return {
    address: fallback.address,
    name: values.get("Name") || fallback.name,
    alias: values.get("Alias") || null,
    available: true,
    paired: parseBooleanValue(values.get("Paired")),
    trusted: parseBooleanValue(values.get("Trusted")),
    connected: parseBooleanValue(values.get("Connected")),
    blocked: parseBooleanValue(values.get("Blocked")),
    rssi: values.get("RSSI") ? Number.parseInt(values.get("RSSI"), 10) : null,
    debug: fallback.debug || null
  };
}

async function runBluetoothctl(args, timeoutMs = 15000) {
  const result = await execFileAsync("bluetoothctl", args, timeoutMs);
  return result.stdout;
}

async function tryBluetoothctl(args, timeoutMs = 15000) {
  try {
    return await runBluetoothctl(args, timeoutMs);
  } catch {
    return "";
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAnsi(text) {
  return String(text || "").replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

async function runInteractiveBluetoothScan(durationMs) {
  return await new Promise((resolve, reject) => {
    const child = spawn("bluetoothctl", [], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error = null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr)
      });
    };

    const timeoutId = setTimeout(() => {
      child.stdin.write("devices\n");
      child.stdin.write("devices Paired\n");
      child.stdin.write("scan off\n");
      child.stdin.write("quit\n");
    }, durationMs);

    child.on("error", (error) => {
      finish(normalizeCommandError("bluetoothctl", error));
    });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("close", (code) => {
      if (code && code !== 0) {
        finish(new Error(stripAnsi(stderr).trim() || `bluetoothctl scan exited with code ${code}`));
        return;
      }
      finish();
    });

    child.stdin.write("power on\n");
    child.stdin.write("agent on\n");
    child.stdin.write("default-agent\n");
    child.stdin.write("scan on\n");
  });
}

async function runInteractiveBluetoothPair(address, timeoutMs = 20000) {
  return await new Promise((resolve, reject) => {
    const child = spawn("bluetoothctl", [], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error = null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      if (!child.killed) {
        try {
          child.stdin.write("quit\n");
        } catch {
          // ignore shutdown write errors
        }
      }
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr)
      });
    };

    const timeoutId = setTimeout(() => {
      finish(new Error("Bluetooth-Verbindung hat nicht rechtzeitig geantwortet. Würfel aktivieren und direkt erneut verbinden."));
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore kill errors
      }
    }, timeoutMs);

    child.on("error", (error) => {
      finish(normalizeCommandError("bluetoothctl", error));
    });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
      const text = stripAnsi(stdout);
      if (text.includes("Failed to pair:")) {
        finish(normalizeCommandError("bluetoothctl", new Error("pair failed"), "", text));
      } else if (text.includes("Pairing successful") || text.includes("Paired: yes")) {
        finish();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      const output = stripAnsi(`${stdout}\n${stderr}`);
      if (code && code !== 0) {
        finish(normalizeCommandError("bluetoothctl", new Error(`pair exited with code ${code}`), stderr, stdout));
        return;
      }
      if (output.includes("Pairing successful") || output.includes("Paired: yes")) {
        finish();
        return;
      }
      finish(new Error(output.trim() || "Bluetooth-Verbindung wurde ohne verwertbares Ergebnis beendet."));
    });

    child.stdin.write("power on\n");
    child.stdin.write("agent on\n");
    child.stdin.write("default-agent\n");
    child.stdin.write(`pair ${address}\n`);
  });
}

function summarizeBluetoothctlOutput(output) {
  return String(output || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" | ");
}

export async function powerOnBluetooth() {
  await runBluetoothctl(["power", "on"]);
}

async function prepareBluetoothAdapter() {
  await powerOnBluetooth();
  await tryBluetoothctl(["agent", "on"]);
  await tryBluetoothctl(["default-agent"]);
}

async function listRawBluetoothDevices() {
  const [knownDevicesOutput, pairedDevicesOutput] = await Promise.all([
    runBluetoothctl(["devices"]),
    tryBluetoothctl(["devices", "Paired"])
  ]);
  const merged = new Map();
  for (const device of [...parseDevices(knownDevicesOutput), ...parseDevices(pairedDevicesOutput)]) {
    merged.set(device.address, device);
  }
  return Array.from(merged.values());
}

export async function listBluetoothDevices(seedDevices = []) {
  const mergedDevices = new Map();
  for (const seedDevice of seedDevices) {
    if (seedDevice?.address) {
      mergedDevices.set(seedDevice.address, {
        address: seedDevice.address,
        name: seedDevice.name || seedDevice.address
      });
    }
  }

  for (const device of await listRawBluetoothDevices()) {
    mergedDevices.set(device.address, device);
  }

  const devices = Array.from(mergedDevices.values());
  const enriched = [];

  const enrichedDevices = await Promise.all(
    devices.map(async (device) => {
      try {
        const infoOutput = await runBluetoothctl(["info", device.address]);
        return parseInfo(infoOutput, device);
      } catch {
        return createBaseDevice(device.address, device.name);
      }
    })
  );
  enriched.push(...enrichedDevices);

  return enriched.sort((left, right) => {
    const leftRank = Number(Boolean(left.connected)) * 4 + Number(Boolean(left.paired)) * 2 + Number(Boolean(left.trusted));
    const rightRank = Number(Boolean(right.connected)) * 4 + Number(Boolean(right.paired)) * 2 + Number(Boolean(right.trusted));
    return rightRank - leftRank || (left.name || left.address).localeCompare(right.name || right.address);
  });
}

export async function scanBluetoothDevices(seconds = 5) {
  const duration = Math.max(2, Math.min(20, Math.round(Number(seconds) || 5)));
  await prepareBluetoothAdapter();
  const scanResult = await runInteractiveBluetoothScan(duration * 1000);
  const scanOutput = `${scanResult.stdout}\n${scanResult.stderr}`;
  const discoveredDevices = parseDevices(scanOutput);
  return listBluetoothDevices(discoveredDevices);
}

async function waitForDeviceState(address, predicate, attempts = 8, delayMs = 500) {
  let lastDevice = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const devices = await listBluetoothDevices();
    lastDevice = devices.find((device) => device.address === address) || lastDevice;
    if (lastDevice && predicate(lastDevice)) {
      return lastDevice;
    }
    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }
  return lastDevice;
}

async function getBluetoothDevice(address) {
  const devices = await listBluetoothDevices([{ address, name: address }]);
  return devices.find((device) => device.address === address) || null;
}

async function rescanBluetoothDevice(address, seconds = 4) {
  const scannedDevices = await scanBluetoothDevices(seconds);
  return scannedDevices.find((device) => device.address === address) || null;
}

async function waitForVisibleBluetoothDevice(address, scanWindows = [4, 6, 8], onProgress = () => {}) {
  let device = null;
  for (let index = 0; index < scanWindows.length; index += 1) {
    const seconds = scanWindows[index];
    onProgress({
      stage: "scan",
      status: "running",
      message: `Gerät nicht sichtbar, BLE-Scan ${index + 1}/${scanWindows.length} läuft (${seconds}s).`
    });
    device = await rescanBluetoothDevice(address, seconds);
    if (device?.available) {
      onProgress({
        stage: "scan",
        status: "completed",
        message: `Gerät nach BLE-Scan ${index + 1}/${scanWindows.length} gefunden.`
      });
      return device;
    }
  }
  onProgress({
    stage: "scan",
    status: "failed",
    message: "Gerät ist aktuell nicht sichtbar. Würfel aktivieren und direkt erneut verbinden."
  });
  return device;
}

function createDebugState(previousDebug = null) {
  return {
    ...previousDebug,
    removeOutput: previousDebug?.removeOutput || null,
    pairOutput: previousDebug?.pairOutput || null,
    trustOutput: previousDebug?.trustOutput || null,
    connectOutput: previousDebug?.connectOutput || null
  };
}

export async function connectBluetoothDevice(address, options = {}) {
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
  const allowPairingFallback = options.allowPairingFallback !== false;
  const emitProgress = (stage, status, extra = {}) => {
    onProgress({
      address,
      stage,
      status,
      ...extra
    });
  };

  await prepareBluetoothAdapter();
  let debug = createDebugState();
  let device = await getBluetoothDevice(address);
  emitProgress("inspect", "running", {
    message: device ? `Gerätestatus geladen: paired=${device.paired}, trusted=${device.trusted}, connected=${device.connected}` : "Gerät wird gesucht."
  });

  if (!device?.available) {
    device = await waitForVisibleBluetoothDevice(address, [4, 6, 8], emitProgress);
  }

  if (!device) {
    emitProgress("inspect", "failed", { message: "Gerät ist aktuell nicht sichtbar. Würfel aktivieren und erneut verbinden." });
    throw new Error("device is not currently visible over BLE");
  }

  if (!device.available && !device.paired) {
    throw new Error("device is not currently advertising over BLE");
  }

  if (!device.connected) {
    emitProgress("connect", "running", { message: "Direkter Bluetooth-Connect ohne Pairing wird versucht." });
    const directConnectOutput = await tryBluetoothctl(["connect", address], 20000);
    debug = { ...debug, connectOutput: directConnectOutput.trim() || debug.connectOutput };
    const directlyConnectedDevice = await waitForDeviceState(address, (entry) => entry.connected, 6, 500);
    if (directlyConnectedDevice?.connected) {
      emitProgress("connect", "completed", {
        message: summarizeBluetoothctlOutput(directConnectOutput) || "Direkter Connect erfolgreich."
      });
      emitProgress("ready", "completed", { message: "Gerät ist verbunden und bereit für GATT." });
      return {
        ...directlyConnectedDevice,
        debug
      };
    }
    emitProgress("connect", "completed", {
      message: allowPairingFallback
        ? "Direkter Connect nicht erfolgt. Bonding wird als Fallback versucht."
        : "Direkter Connect hat keinen stabilen BlueZ-Link geliefert."
    });
    if (!allowPairingFallback) {
      throw new Error("direct connect did not establish a stable bluez link");
    }
  }

  if (!device.paired) {
    emitProgress("cleanup", "running", { message: "Vorherigen BlueZ-Zustand für frisches Pairing entfernen." });
    const removeOutput = await tryBluetoothctl(["remove", address], 10000);
    debug = { ...debug, removeOutput: removeOutput.trim() || null };
    emitProgress("cleanup", "completed", {
      message: summarizeBluetoothctlOutput(removeOutput) || "BlueZ-Zustand bereinigt."
    });
    await delay(250);
    emitProgress("pair", "running", { message: "Einmaliges Pairing wird gestartet." });
    const pairResult = await runInteractiveBluetoothPair(address, 20000);
    const pairOutput = `${pairResult.stdout}\n${pairResult.stderr}`.trim();
    debug = { ...debug, pairOutput: pairOutput || null };
    emitProgress("pair", "completed", {
      message: summarizeBluetoothctlOutput(pairOutput) || "Pairing abgeschlossen."
    });
    device = await waitForDeviceState(address, (entry) => entry.paired, 8, 500);
    if (!device?.paired) {
      emitProgress("pair", "failed", {
        message: "BlueZ meldet das Gerät nach dem Pairing nicht als gepairt."
      });
      throw new Error("pairing did not complete");
    }
  } else {
    emitProgress("pair", "skipped", { message: "Gerät ist bereits gepairt." });
  }

  if (!device.trusted) {
    emitProgress("trust", "running", { message: "Gerät wird als vertrauenswürdig markiert." });
    const trustOutput = await runBluetoothctl(["trust", address], 10000);
    debug = { ...debug, trustOutput: trustOutput.trim() || null };
    emitProgress("trust", "completed", {
      message: summarizeBluetoothctlOutput(trustOutput) || "Trust gesetzt."
    });
    device = await waitForDeviceState(address, (entry) => entry.trusted, 6, 400);
    if (!device?.trusted) {
      emitProgress("trust", "failed", {
        message: "BlueZ meldet das Gerät nach trust nicht als vertrauenswürdig."
      });
      throw new Error("trust did not complete");
    }
  } else {
    emitProgress("trust", "skipped", { message: "Gerät ist bereits vertrauenswürdig." });
  }

  if (device.connected) {
    emitProgress("connect", "skipped", { message: "Gerät ist bereits verbunden." });
  } else {
    emitProgress("connect", "running", { message: "Bluetooth-Verbindung wird aufgebaut." });
    const connectOutput = await runBluetoothctl(["connect", address], 30000);
    debug = { ...debug, connectOutput: connectOutput.trim() || null };
    emitProgress("connect", "completed", {
      message: summarizeBluetoothctlOutput(connectOutput) || "Connect-Befehl abgeschlossen."
    });
  }

  const connectedDevice = await waitForDeviceState(address, (entry) => entry.connected, 10, 600);
  if (!connectedDevice?.connected) {
    emitProgress("connect", "failed", {
      message: "BlueZ meldet das Gerät nach connect nicht als verbunden."
    });
    throw new Error("connect did not complete");
  }

  emitProgress("ready", "completed", { message: "Gerät ist verbunden und bereit für GATT." });
  return {
    ...connectedDevice,
    debug
  };
}

export async function disconnectBluetoothDevice(address) {
  await runBluetoothctl(["disconnect", address], 15000);
  const disconnectedDevice = await waitForDeviceState(address, (device) => !device.connected, 8, 400);
  if (disconnectedDevice) {
    return disconnectedDevice;
  }
  const devices = await listBluetoothDevices();
  return devices.find((device) => device.address === address) || null;
}
