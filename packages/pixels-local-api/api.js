import {
  connectBluetoothDevice,
  disconnectBluetoothDevice,
  listBluetoothDevices,
  scanBluetoothDevices
} from "./bluetooth.js";
import {
  blinkPixelsDevice,
  createPixelsMonitorManager,
  forgetPixelsGatt,
  identifyPixelsDevice,
  listPixelsDevices
} from "./pixels.js";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function isFinalRollState(event) {
  return event?.kind === "roll-state" && event?.rollState?.state === "onFace";
}

export class PixelsDie {
  constructor(api, address, name = null) {
    this.api = api;
    this.address = address;
    this.name = name;
  }

  async listBluetoothDevices() {
    return listBluetoothDevices([{ address: this.address, name: this.name || this.address }]);
  }

  async listPixelsDevices() {
    return listPixelsDevices([{ address: this.address, name: this.name || this.address }]);
  }

  async connect(options = {}) {
    return connectBluetoothDevice(this.address, options);
  }

  async disconnect() {
    return disconnectBluetoothDevice(this.address);
  }

  async identify() {
    return identifyPixelsDevice(this.address);
  }

  async blink(options = {}) {
    return blinkPixelsDevice(this.address, options);
  }

  async watch() {
    return this.api.watch(this.address);
  }

  unwatch() {
    return this.api.unwatch(this.address);
  }

  async waitForRoll(options = {}) {
    return this.api.waitForRoll(this.address, options);
  }

  async requestRoll(options = {}) {
    return this.waitForRoll(options);
  }

  forgetGatt() {
    forgetPixelsGatt(this.address);
  }
}

export class PixelsDiceAPI {
  constructor({
    monitorIntervalMs = 350,
    onEvent = () => {},
    onStatus = () => {}
  } = {}) {
    this.waitersByAddress = new Map();
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.monitor = createPixelsMonitorManager({
      intervalMs: monitorIntervalMs,
      onEvent: (event) => {
        this.onEvent(event);
        if (isFinalRollState(event)) {
          const waiter = this.waitersByAddress.get(event.address);
          if (waiter) {
            clearTimeout(waiter.timerId);
            this.waitersByAddress.delete(event.address);
            waiter.resolve(event);
          }
        }
      },
      onStatus: (status) => {
        this.onStatus(status);
      }
    });
  }

  createDie(address, name = null) {
    return new PixelsDie(this, address, name);
  }

  async scan(seconds = 5) {
    return scanBluetoothDevices(seconds);
  }

  async listBluetoothDevices(seedDevices = []) {
    return listBluetoothDevices(seedDevices);
  }

  async listPixelsDevices(selectedDevices = []) {
    return listPixelsDevices(selectedDevices);
  }

  async connect(address, options = {}) {
    return connectBluetoothDevice(address, options);
  }

  async disconnect(address) {
    return disconnectBluetoothDevice(address);
  }

  async identify(address) {
    return identifyPixelsDevice(address);
  }

  async blink(address, options = {}) {
    return blinkPixelsDevice(address, options);
  }

  async watch(address) {
    return this.monitor.watchDevice(address);
  }

  unwatch(address) {
    return this.monitor.unwatchDevice(address);
  }

  getSnapshot() {
    return this.monitor.getSnapshot();
  }

  stopAllWatches() {
    for (const waiter of this.waitersByAddress.values()) {
      clearTimeout(waiter.timerId);
      waiter.reject(new Error("watch manager stopped"));
    }
    this.waitersByAddress.clear();
    this.monitor.stopAll();
  }

  forgetGatt(address) {
    forgetPixelsGatt(address);
  }

  async waitForRoll(address, { timeoutMs = 20000, autoWatch = true } = {}) {
    const existing = this.waitersByAddress.get(address);
    if (existing) {
      return existing.promise;
    }

    const deferred = createDeferred();
    const timerId = setTimeout(() => {
      this.waitersByAddress.delete(address);
      deferred.reject(new Error(`Timed out waiting for a roll from ${address}`));
    }, timeoutMs);

    this.waitersByAddress.set(address, {
      ...deferred,
      timerId
    });

    if (autoWatch) {
      try {
        await this.watch(address);
      } catch (error) {
        clearTimeout(timerId);
        this.waitersByAddress.delete(address);
        deferred.reject(error);
      }
    }

    return deferred.promise;
  }

  async requestRoll(address, options = {}) {
    return this.waitForRoll(address, options);
  }
}

export function createPixelsDiceAPI(options = {}) {
  return new PixelsDiceAPI(options);
}
