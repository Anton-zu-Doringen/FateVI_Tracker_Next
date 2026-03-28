export interface BluetoothDeviceInfo {
  address: string;
  name: string;
  alias: string | null;
  available: boolean;
  paired: boolean;
  trusted: boolean;
  connected: boolean;
  blocked: boolean;
  rssi: number | null;
  debug: unknown;
}

export interface PixelsListDevice extends BluetoothDeviceInfo {
  selected: boolean;
  rememberedName: string;
  pixelsCandidate: boolean;
  pixelsLikely: boolean;
  effectiveConnected: boolean;
  protocol: string;
  gattReady: boolean;
  writeCharacteristicPath: string | null;
  notifyCharacteristicPath: string | null;
}

export interface PixelsRollState {
  type: "rollState";
  stateCode: number;
  state: string;
  faceIndex: number;
  face: number;
  rawHex: string;
}

export interface PixelsMonitorEvent {
  kind: "roll-state" | "raw-message";
  address: string;
  protocol: string;
  at: string;
  deviceName: string | null;
  rawHex: string;
  rollState: PixelsRollState | null;
}

export interface PixelsMonitorSnapshot {
  monitors: Array<{
    address: string;
    status: string;
    protocol: string;
    startedAt: string;
    lastEventAt: string | null;
    lastValueHex: string;
    lastError: string | null;
    deviceName: string | null;
  }>;
  recentEvents: PixelsMonitorEvent[];
}

export interface PixelsBlinkOptions {
  count?: number;
  duration?: number;
  color?: string;
  fade?: number;
  loopCount?: number;
  faceMask?: number;
}

export interface PixelsApiOptions {
  monitorIntervalMs?: number;
  onEvent?: (event: PixelsMonitorEvent) => void;
  onStatus?: (status: unknown) => void;
}

export interface WaitForRollOptions {
  timeoutMs?: number;
  autoWatch?: boolean;
}

export class PixelsDie {
  constructor(api: PixelsDiceAPI, address: string, name?: string | null);
  readonly api: PixelsDiceAPI;
  readonly address: string;
  readonly name: string | null;
  listBluetoothDevices(): Promise<BluetoothDeviceInfo[]>;
  listPixelsDevices(): Promise<PixelsListDevice[]>;
  connect(options?: Record<string, unknown>): Promise<BluetoothDeviceInfo>;
  disconnect(): Promise<BluetoothDeviceInfo | null>;
  identify(): Promise<Record<string, unknown>>;
  blink(options?: PixelsBlinkOptions): Promise<Record<string, unknown>>;
  watch(): Promise<Record<string, unknown>>;
  unwatch(): { removed: boolean };
  waitForRoll(options?: WaitForRollOptions): Promise<PixelsMonitorEvent>;
  requestRoll(options?: WaitForRollOptions): Promise<PixelsMonitorEvent>;
  forgetGatt(): void;
}

export class PixelsDiceAPI {
  constructor(options?: PixelsApiOptions);
  createDie(address: string, name?: string | null): PixelsDie;
  scan(seconds?: number): Promise<BluetoothDeviceInfo[]>;
  listBluetoothDevices(seedDevices?: Array<{ address: string; name?: string }>): Promise<BluetoothDeviceInfo[]>;
  listPixelsDevices(selectedDevices?: Array<{ address: string; name?: string }>): Promise<PixelsListDevice[]>;
  connect(address: string, options?: Record<string, unknown>): Promise<BluetoothDeviceInfo>;
  disconnect(address: string): Promise<BluetoothDeviceInfo | null>;
  identify(address: string): Promise<Record<string, unknown>>;
  blink(address: string, options?: PixelsBlinkOptions): Promise<Record<string, unknown>>;
  watch(address: string): Promise<Record<string, unknown>>;
  unwatch(address: string): { removed: boolean };
  getSnapshot(): PixelsMonitorSnapshot;
  stopAllWatches(): void;
  forgetGatt(address: string): void;
  waitForRoll(address: string, options?: WaitForRollOptions): Promise<PixelsMonitorEvent>;
  requestRoll(address: string, options?: WaitForRollOptions): Promise<PixelsMonitorEvent>;
}

export function createPixelsDiceAPI(options?: PixelsApiOptions): PixelsDiceAPI;

export function powerOnBluetooth(): Promise<void>;
export function listBluetoothDevices(seedDevices?: Array<{ address: string; name?: string }>): Promise<BluetoothDeviceInfo[]>;
export function scanBluetoothDevices(seconds?: number): Promise<BluetoothDeviceInfo[]>;
export function connectBluetoothDevice(address: string, options?: Record<string, unknown>): Promise<BluetoothDeviceInfo>;
export function disconnectBluetoothDevice(address: string): Promise<BluetoothDeviceInfo | null>;

export function forgetPixelsGatt(address?: string): void;
export function listPixelsDevices(selectedDevices?: Array<{ address: string; name?: string }>): Promise<PixelsListDevice[]>;
export function identifyPixelsDevice(address: string): Promise<Record<string, unknown>>;
export function blinkPixelsDevice(address: string, options?: PixelsBlinkOptions): Promise<Record<string, unknown>>;
export function createPixelsMonitorManager(options?: {
  intervalMs?: number;
  onEvent?: (event: PixelsMonitorEvent) => void;
  onStatus?: (status: unknown) => void;
}): {
  getSnapshot(): PixelsMonitorSnapshot;
  watchDevice(address: string): Promise<Record<string, unknown>>;
  unwatchDevice(address: string): { removed: boolean };
  stopAll(): void;
};
