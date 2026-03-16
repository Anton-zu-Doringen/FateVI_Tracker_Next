export interface PixelsRollRequest {
  characterId: string;
  dice: "3d6" | "1d6";
}

export interface PixelsRollResult {
  characterId: string;
  total: number;
  faces: number[];
}

export interface BluetoothDeviceSummary {
  address: string;
  name: string;
  alias: string | null;
  paired: boolean;
  trusted: boolean;
  connected: boolean;
}

export interface PixelsAdapter {
  requestRoll(request: PixelsRollRequest): Promise<PixelsRollResult>;
  triggerLedEffect(effect: "connected" | "waitInitiative" | "critSuccess" | "critFailure", characterId: string): Promise<void>;
}

export class NullPixelsAdapter implements PixelsAdapter {
  async requestRoll(_request: PixelsRollRequest): Promise<PixelsRollResult> {
    throw new Error("Pixels adapter not configured");
  }

  async triggerLedEffect(_effect: "connected" | "waitInitiative" | "critSuccess" | "critFailure", _characterId: string): Promise<void> {
    return;
  }
}
