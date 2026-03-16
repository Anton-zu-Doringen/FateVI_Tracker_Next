export type Role = "gm" | "player";
export type CharacterType = "PC" | "NPC";
export type TurnType = "Main" | "Move" | "Bonus";
export type CriticalState = "success" | "failure" | null;
export type InitiativeRollMode = "automatic" | "manual" | "pixels";

export interface TimedEvent {
  id: string;
  description: string;
  dueRound: number;
  createdAtRound: number;
}

export interface Character {
  id: string;
  name: string;
  type: CharacterType;
  hidden: boolean;
  initiativeBase: number;
  specialAbility: string | null;
  initiativeRollMode: InitiativeRollMode;
  ownerUserId: string | null;
  surprised: boolean;
  incapacitated: boolean;
  dazedUntilRound: number | null;
  damageMonitorMarks: boolean[];
  unfreeDefensePenalty: number;
  paradeClickCount: number;
  moveActionUsed: boolean;
  specialAbilityActive: boolean;
  lastRoll: number | null;
  critBonusRoll: number | null;
  totalInitiative: number | null;
}

export interface TurnEntry {
  id: string;
  characterId: string;
  turnType: TurnType;
  groupInitiative: number;
  critical: CriticalState;
  used: boolean;
  actionIndex: number;
}

export interface PendingRollRequest {
  kind: "initiative-roll";
  characterId: string;
  dice: "3d6";
}

export interface PendingEventReminderRequest {
  kind: "event-reminder";
  eventId: string;
}

export interface PendingInput {
  type: "roll" | "event";
  request: PendingRollRequest | PendingEventReminderRequest;
}

export interface CombatState {
  characters: Character[];
  events: TimedEvent[];
  turnEntries: TurnEntry[];
  round: number;
  activeCharacterId: string | null;
  pendingInputs: PendingInput[];
}

export interface RuleEvent {
  type:
    | "combat-ended"
    | "round-started"
    | "character-updated"
    | "initiative-roll-requested"
    | "initiative-roll-resolved"
    | "active-character-changed"
    | "damage-monitor-updated"
    | "dazed-applied"
    | "parade-triggered"
    | "special-ability-toggled"
    | "turn-entry-toggled"
    | "event-updated";
  characterId?: string;
  eventId?: string;
  detail?: string;
}

export type Command =
  | {
      type: "add-character";
      character: Pick<
        Character,
        "id" | "name" | "type" | "initiativeBase" | "specialAbility" | "initiativeRollMode" | "ownerUserId"
      >;
    }
  | {
      type: "update-character";
      characterId: string;
      patch: Partial<
        Pick<Character, "name" | "type" | "hidden" | "initiativeBase" | "specialAbility" | "initiativeRollMode" | "ownerUserId">
      >;
    }
  | { type: "remove-character"; characterId: string }
  | { type: "assign-character-owner"; characterId: string; userId: string | null }
  | { type: "toggle-surprised"; characterId: string; surprised: boolean }
  | { type: "toggle-incapacitated"; characterId: string; incapacitated: boolean }
  | { type: "set-damage-mark"; characterId: string; index: number; checked: boolean }
  | { type: "apply-dazed"; characterId: string }
  | { type: "trigger-parade"; characterId: string }
  | { type: "toggle-turn-entry-used"; entryId: string }
  | { type: "toggle-move-action"; characterId: string }
  | { type: "toggle-special-ability"; characterId: string }
  | { type: "add-event"; event: TimedEvent }
  | { type: "remove-event"; eventId: string }
  | { type: "start-round" }
  | { type: "end-combat" }
  | { type: "reorder-characters"; characterIds: string[] }
  | { type: "reorder-turn-groups"; characterIds: string[] }
  | { type: "activate-character"; characterId: string | null }
  | { type: "step-active-character"; direction: "previous" | "next" }
  | { type: "resolve-initiative-roll"; characterId: string; total: number; critBonusRoll?: number | null };

export interface RuleResult {
  state: CombatState;
  events: RuleEvent[];
}
