import type { Command, CombatState, Role } from "@fatevi/rules";

export interface Session {
  userId: string;
  role: Role;
  controlledCharacterId: string | null;
  displayName?: string;
}

export function canExecuteCommand(session: Session, state: CombatState, command: Command): boolean {
  if (session.role === "gm") {
    return true;
  }

  switch (command.type) {
    case "start-round":
    case "end-combat":
    case "reorder-characters":
    case "reorder-turn-groups":
      return false;
    case "add-character":
    case "update-character":
    case "remove-character":
    case "add-event":
    case "remove-event":
    case "assign-character-owner":
      return false;
    case "toggle-surprised":
    case "toggle-incapacitated":
    case "set-damage-mark":
    case "apply-dazed":
    case "trigger-parade":
    case "toggle-turn-entry-used":
    case "toggle-move-action":
    case "toggle-special-ability":
    case "resolve-initiative-roll": {
      const characterId =
        command.type === "toggle-turn-entry-used"
          ? state.turnEntries.find((entry) => entry.id === command.entryId)?.characterId
          : command.characterId;
      const character = state.characters.find((entry) => entry.id === characterId);
      if (!character) {
        return false;
      }
      return character.ownerUserId === session.userId && session.controlledCharacterId === character.id;
    }
    case "activate-character":
    case "step-active-character":
      return false;
  }

  return false;
}
