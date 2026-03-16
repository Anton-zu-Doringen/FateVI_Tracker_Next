import { execFile } from "node:child_process";

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

  for (const device of devices) {
    try {
      const infoOutput = await runBluetoothctl(["info", device.address]);
      enriched.push(parseInfo(infoOutput, device));
    } catch {
      enriched.push(createBaseDevice(device.address, device.name));
    }
  }

  return enriched.sort((left, right) => {
    const leftRank = Number(Boolean(left.connected)) * 4 + Number(Boolean(left.paired)) * 2 + Number(Boolean(left.trusted));
    const rightRank = Number(Boolean(right.connected)) * 4 + Number(Boolean(right.paired)) * 2 + Number(Boolean(right.trusted));
    return rightRank - leftRank || (left.name || left.address).localeCompare(right.name || right.address);
  });
}

export async function scanBluetoothDevices(seconds = 5) {
  const duration = Math.max(2, Math.min(20, Math.round(Number(seconds) || 5)));
  await prepareBluetoothAdapter();
  const scanOutput = await tryBluetoothctl(["--timeout", String(duration), "scan", "on"], (duration + 3) * 1000);
  await tryBluetoothctl(["scan", "off"], 5000);
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

export async function connectBluetoothDevice(address) {
  await prepareBluetoothAdapter();
  await tryBluetoothctl(["scan", "on"], 5000);
  const pairOutput = await tryBluetoothctl(["pair", address], 30000);
  const trustOutput = await tryBluetoothctl(["trust", address], 10000);
  const connectOutput = await tryBluetoothctl(["connect", address], 30000);
  await tryBluetoothctl(["scan", "off"], 5000);
  const connectedDevice = await waitForDeviceState(address, (device) => device.connected, 10, 600);
  if (connectedDevice) {
    return {
      ...connectedDevice,
      debug: {
        pairOutput: pairOutput.trim() || null,
        trustOutput: trustOutput.trim() || null,
        connectOutput: connectOutput.trim() || null
      }
    };
  }
  const devices = await listBluetoothDevices();
  const device = devices.find((candidate) => candidate.address === address) || null;
  if (!device) {
    return {
      ...createBaseDevice(address, address),
      debug: {
        pairOutput: pairOutput.trim() || null,
        trustOutput: trustOutput.trim() || null,
        connectOutput: connectOutput.trim() || null
      }
    };
  }
  return {
    ...device,
    debug: {
      pairOutput: pairOutput.trim() || null,
      trustOutput: trustOutput.trim() || null,
      connectOutput: connectOutput.trim() || null
    }
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
