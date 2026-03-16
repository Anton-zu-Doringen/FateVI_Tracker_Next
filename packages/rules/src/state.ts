import type { Character, CombatState, InitiativeRollMode } from "./types.js";
import { normalizeDamageMonitorMarks } from "./damage.js";

export function getDefaultInitiativeRollMode(type: Character["type"]): InitiativeRollMode {
  return type === "NPC" ? "automatic" : "manual";
}

export function createCharacter(input: {
  id: string;
  name: string;
  type: Character["type"];
  hidden?: boolean;
  initiativeBase: number;
  specialAbility?: string | null;
  initiativeRollMode?: InitiativeRollMode | null;
  ownerUserId?: string | null;
}): Character {
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    hidden: Boolean(input.hidden),
    initiativeBase: input.initiativeBase,
    specialAbility: input.specialAbility ?? null,
    initiativeRollMode: input.initiativeRollMode ?? getDefaultInitiativeRollMode(input.type),
    ownerUserId: input.ownerUserId ?? null,
    surprised: false,
    incapacitated: false,
    dazedUntilRound: null,
    damageMonitorMarks: normalizeDamageMonitorMarks([]),
    unfreeDefensePenalty: 0,
    paradeClickCount: 0,
    moveActionUsed: false,
    specialAbilityActive: false,
    lastRoll: null,
    critBonusRoll: null,
    totalInitiative: null
  };
}

export function createCombatState(characters: Character[] = []): CombatState {
  return {
    characters,
    events: [],
    turnEntries: [],
    round: 0,
    activeCharacterId: null,
    pendingInputs: []
  };
}
