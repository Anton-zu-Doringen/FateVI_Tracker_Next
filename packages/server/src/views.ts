import { type CombatState } from "@fatevi/rules";
import type { Session } from "./auth.js";

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

export interface PlayerVisibleCharacter {
  id: string;
  name: string;
  type: "PC" | "NPC";
  totalInitiative: number | null;
  isOwned: boolean;
  detail: {
    initiativeBase: number;
    surprised: boolean;
    incapacitated: boolean;
    moveActionUsed: boolean;
    specialAbilityActive: boolean;
    lastRoll: number | null;
    critBonusRoll: number | null;
  } | null;
}

export interface PlayerView {
  round: number;
  activeCharacterId: string | null;
  events: CombatState["events"];
  turnEntries: CombatState["turnEntries"];
  characters: PlayerVisibleCharacter[];
  pendingInputs: CombatState["pendingInputs"];
}

export function toPlayerView(state: CombatState, session: Session): PlayerView {
  return {
    round: state.round,
    activeCharacterId: state.activeCharacterId,
    events: [],
    turnEntries: state.turnEntries.map((entry) => ({ ...entry })),
    pendingInputs: state.pendingInputs
      .filter(
        (input) => input.type === "roll" && input.request.kind === "initiative-roll" && input.request.characterId === session.controlledCharacterId
      )
      .map((input) => ({
        ...input,
        request: { ...input.request }
      })),
    characters: state.characters.map((character) => {
      const isOwned = character.ownerUserId === session.userId && character.id === session.controlledCharacterId;
      return {
        id: character.id,
        name: character.name,
        type: character.type,
        totalInitiative: character.totalInitiative,
        isOwned,
        detail: isOwned
          ? {
              initiativeBase: character.initiativeBase,
              surprised: character.surprised,
              incapacitated: character.incapacitated,
              moveActionUsed: character.moveActionUsed,
              specialAbilityActive: character.specialAbilityActive,
              lastRoll: character.lastRoll,
              critBonusRoll: character.critBonusRoll
            }
          : null
      };
    })
  };
}

export function toGmView(state: CombatState): CombatState {
  return cloneCombatState(state);
}
