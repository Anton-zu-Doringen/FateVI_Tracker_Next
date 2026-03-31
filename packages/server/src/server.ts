import { applyCommand, createCombatState, type Command, type CombatState } from "@fatevi/rules";
import { canExecuteCommand, type Session } from "./auth.js";
import { toGmView, toPlayerView } from "./views.js";

function cloneCombatState(state: CombatState): CombatState {
  return {
    ...state,
    characters: state.characters.map((character) => ({ ...character })),
    events: Array.isArray(state.events) ? state.events.map((event) => ({ ...event })) : [],
    turnEntries: state.turnEntries.map((entry) => ({ ...entry })),
    pendingInputs: state.pendingInputs.map((input) => ({
      ...input,
      request: { ...input.request }
    }))
  };
}

function createDefaultState(): CombatState {
  return createCombatState([]);
}

export class TrackerServer {
  private state: CombatState;

  constructor(initialState: CombatState | null = null) {
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
