import type { Command } from "@fatevi/rules";
import type { PlayerView } from "@fatevi/server";

export interface ClientTransport {
  send(command: Command): Promise<void>;
  subscribe(listener: (view: unknown) => void): () => void;
}

export interface GmClientModel {
  role: "gm";
  state: unknown;
}

export interface PlayerClientModel {
  role: "player";
  state: PlayerView;
}
