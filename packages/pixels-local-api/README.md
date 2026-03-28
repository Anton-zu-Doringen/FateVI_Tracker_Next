# `@fatevi/pixels-local-api`

Lokale Node.js-API fuer Pixels Dice auf Linux/BlueZ.

```js
import { createPixelsDiceAPI } from "@fatevi/pixels-local-api";

const pixels = createPixelsDiceAPI({
  onEvent: (event) => {
    if (event.kind === "roll-state") {
      console.log("roll", event.address, event.rollState);
    }
  }
});

const devices = await pixels.scan(5);
const die = pixels.createDie(devices[0].address, devices[0].name);

await die.connect();
await die.identify();
await die.blink({ color: "#00ff88", duration: 800 });
await die.watch();

const roll = await die.waitForRoll({ timeoutMs: 15000 });
console.log("final roll", roll.rollState?.face);
```

Die API exportiert sowohl Low-Level-Funktionen als auch eine hoehere Manager-API:

- `scanBluetoothDevices`, `listBluetoothDevices`
- `connectBluetoothDevice`, `disconnectBluetoothDevice`
- `listPixelsDevices`, `identifyPixelsDevice`, `blinkPixelsDevice`
- `createPixelsMonitorManager`
- `PixelsDiceAPI`, `PixelsDie`, `createPixelsDiceAPI`

Voraussetzungen:

- Linux mit BlueZ
- `bluetoothctl` und `busctl` im `PATH`
- aktive Bluetooth-Berechtigungen fuer den Prozess
