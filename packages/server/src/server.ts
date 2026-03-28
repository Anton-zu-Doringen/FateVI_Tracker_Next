import { applyCommand, cloneCombatState, createCombatState, type Command, type CombatState } from "@fatevi/rules";
import { canExecuteCommand, type Session } from "./auth.js";
import { NullPixelsAdapter, type PixelsAdapter } from "./pixels.js";
import { toGmView, toPlayerView } from "./views.js";

function createDefaultState(): CombatState {
  return createCombatState([]);
}

export class TrackerServer {
  private state: CombatState;
  private pixels: PixelsAdapter;

  constructor(pixels: PixelsAdapter = new NullPixelsAdapter(), initialState: CombatState | null = null) {
    this.pixels = pixels;
    this.state = initialState ? cloneCombatState(initialState) : createDefaultState();
  }

  getState(): CombatState {
    return cloneCombatState(this.state);
  }

  resetState(): void {
    this.state = createDefaultState();
  }

  setState(nextState: CombatState): void {
    this.state = cloneCombatState(nextState);
  }

  getStateForSession(session: Session) {
    return session.role === "gm" ? toGmView(this.state) : toPlayerView(this.state, session);
  }

  execute(session: Session, command: Command) {
    if (!canExecuteCommand(session, this.state, command)) {
      throw new Error("command not permitted for session");
    }

    const result = applyCommand(this.state, command);
    this.state = result.state;
    return result;
  }
}
