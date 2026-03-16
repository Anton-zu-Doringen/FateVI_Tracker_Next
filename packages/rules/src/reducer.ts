import { createCharacter, getDefaultInitiativeRollMode } from "./state.js";
import { buildTurnEntries, computeTotalInitiative } from "./initiative.js";
import { getDefaultDazedUntilRound, isCharacterDazed, normalizeDamageMonitorMarks } from "./damage.js";
import type { CombatState, Command, RuleEvent, RuleResult, TurnEntry } from "./types.js";

function cloneState(state: CombatState): CombatState {
  return {
    ...state,
    characters: state.characters.map((character) => ({ ...character })),
    turnEntries: state.turnEntries.map((entry) => ({ ...entry })),
    pendingInputs: state.pendingInputs.map((input) => ({
      ...input,
      request: { ...input.request }
    }))
  };
}

export function applyCommand(state: CombatState, command: Command): RuleResult {
  const nextState = cloneState(state);
  const events: RuleEvent[] = [];

  const getTurnEntry = (entryId: string) => nextState.turnEntries.find((entry) => entry.id === entryId) ?? null;

  const hasUnresolvedTurnsForCharacter = (characterId: string | null) =>
    Boolean(characterId) && nextState.turnEntries.some((entry) => entry.characterId === characterId && !entry.used);

  const getSortedCharacterOrder = () => {
    const order: string[] = [];
    for (const entry of nextState.turnEntries) {
      if (!order.includes(entry.characterId)) {
        order.push(entry.characterId);
      }
    }
    return order;
  };

  const getNextCharacterIdWithUnresolvedTurns = (characterId: string | null) => {
    const order = getSortedCharacterOrder();
    if (!order.length) {
      return null;
    }
    if (!characterId) {
      return order.find((candidate) => hasUnresolvedTurnsForCharacter(candidate)) ?? null;
    }
    const currentIndex = order.indexOf(characterId);
    if (currentIndex < 0) {
      return order.find((candidate) => hasUnresolvedTurnsForCharacter(candidate)) ?? null;
    }
    for (let step = 1; step < order.length; step += 1) {
      const candidate = order[(currentIndex + step) % order.length];
      if (hasUnresolvedTurnsForCharacter(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const syncActiveCharacter = () => {
    if (!nextState.turnEntries.length) {
      nextState.activeCharacterId = null;
      return;
    }

    if (hasUnresolvedTurnsForCharacter(nextState.activeCharacterId)) {
      return;
    }

    const nextActiveCharacterId =
      getNextCharacterIdWithUnresolvedTurns(nextState.activeCharacterId) ??
      nextState.turnEntries[0]?.characterId ??
      null;
    if (
      !nextState.activeCharacterId ||
      !nextState.turnEntries.some((entry) => entry.characterId === nextState.activeCharacterId) ||
      nextActiveCharacterId
    ) {
      nextState.activeCharacterId = nextActiveCharacterId;
    }
  };

  const rebuildTurnEntries = () => {
    nextState.turnEntries = buildTurnEntries(nextState.characters, nextState.turnEntries);
    syncActiveCharacter();
  };

  const setTurnEntryUsed = (entryId: string, used: boolean): TurnEntry | null => {
    let updatedEntry: TurnEntry | null = null;
    nextState.turnEntries = nextState.turnEntries.map((entry) => {
      if (entry.id !== entryId) {
        return entry;
      }
      updatedEntry = { ...entry, used };
      return updatedEntry;
    });
    return updatedEntry;
  };

  switch (command.type) {
    case "add-character": {
      nextState.characters = [...nextState.characters, createCharacter(command.character)];
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.character.id, detail: "character added" });
      return { state: nextState, events };
    }
    case "update-character": {
      nextState.characters = nextState.characters.map((character) =>
        character.id === command.characterId
          ? {
              ...character,
              ...command.patch,
              initiativeRollMode:
                command.patch.initiativeRollMode ??
                character.initiativeRollMode ??
                getDefaultInitiativeRollMode(command.patch.type ?? character.type)
            }
          : character
      );
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.characterId, detail: "character updated" });
      return { state: nextState, events };
    }
    case "remove-character": {
      nextState.characters = nextState.characters.filter((character) => character.id !== command.characterId);
      nextState.pendingInputs = nextState.pendingInputs.filter((input) => input.request.characterId !== command.characterId);
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.characterId, detail: "character removed" });
      return { state: nextState, events };
    }
    case "assign-character-owner": {
      nextState.characters = nextState.characters.map((character) =>
        character.id === command.characterId ? { ...character, ownerUserId: command.userId } : character
      );
      events.push({ type: "character-updated", characterId: command.characterId, detail: "owner assigned" });
      return { state: nextState, events };
    }
    case "toggle-surprised": {
      nextState.characters = nextState.characters.map((character) =>
        character.id === command.characterId ? { ...character, surprised: command.surprised } : character
      );
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.characterId, detail: "surprised toggled" });
      return { state: nextState, events };
    }
    case "toggle-incapacitated": {
      nextState.characters = nextState.characters.map((character) =>
        character.id === command.characterId ? { ...character, incapacitated: command.incapacitated } : character
      );
      nextState.pendingInputs = nextState.pendingInputs.filter((input) => input.request.characterId !== command.characterId);
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.characterId, detail: "incapacitated toggled" });
      return { state: nextState, events };
    }
    case "set-damage-mark": {
      nextState.characters = nextState.characters.map((character) => {
        if (character.id !== command.characterId) {
          return character;
        }
        const marks = normalizeDamageMonitorMarks(character.damageMonitorMarks);
        if (command.index >= 0 && command.index < marks.length) {
          marks[command.index] = command.checked;
        }
        return {
          ...character,
          damageMonitorMarks: marks
        };
      });
      events.push({ type: "damage-monitor-updated", characterId: command.characterId });
      return { state: nextState, events };
    }
    case "apply-dazed": {
      nextState.characters = nextState.characters.map((character) => {
        if (character.id !== command.characterId) {
          return character;
        }
        const currentlyDazed = isCharacterDazed(character, nextState.round);
        const defaultUntilRound = getDefaultDazedUntilRound(nextState.round);
        const currentUntil = character.dazedUntilRound ?? defaultUntilRound;
        return {
          ...character,
          dazedUntilRound: currentlyDazed ? currentUntil + 1 : defaultUntilRound
        };
      });
      events.push({ type: "dazed-applied", characterId: command.characterId });
      return { state: nextState, events };
    }
    case "trigger-parade": {
      const bonusEntry = nextState.turnEntries.find(
        (entry) => entry.characterId === command.characterId && entry.turnType === "Bonus" && !entry.used
      );
      const mainEntry = nextState.turnEntries.find(
        (entry) => entry.characterId === command.characterId && entry.turnType === "Main" && !entry.used
      );

      if (bonusEntry) {
        setTurnEntryUsed(bonusEntry.id, true);
      } else if (mainEntry) {
        setTurnEntryUsed(mainEntry.id, true);
      }

      nextState.characters = nextState.characters.map((character) => {
        if (character.id !== command.characterId) {
          return character;
        }
        return {
          ...character,
          paradeClickCount: Math.max(0, Math.round(Number(character.paradeClickCount) || 0)) + 1,
          unfreeDefensePenalty:
            Math.max(0, Math.round(Number(character.unfreeDefensePenalty) || 0)) + (bonusEntry ? 0 : 6)
        };
      });

      syncActiveCharacter();
      events.push({
        type: "parade-triggered",
        characterId: command.characterId,
        detail: bonusEntry ? "bonus consumed" : mainEntry ? "main consumed" : "penalty applied"
      });
      return { state: nextState, events };
    }
    case "toggle-turn-entry-used": {
      const entry = getTurnEntry(command.entryId);
      if (!entry) {
        throw new Error(`turn entry not found: ${command.entryId}`);
      }
      const updatedEntry = setTurnEntryUsed(command.entryId, !entry.used);
      if (updatedEntry?.turnType === "Move") {
        nextState.characters = nextState.characters.map((character) =>
          character.id === updatedEntry.characterId
            ? {
                ...character,
                moveActionUsed: updatedEntry.used
              }
            : character
        );
      }
      syncActiveCharacter();
      events.push({
        type: "turn-entry-toggled",
        characterId: entry.characterId,
        detail: `${entry.turnType}:${updatedEntry?.used ? "used" : "unused"}`
      });
      return { state: nextState, events };
    }
    case "toggle-move-action": {
      const moveEntry = nextState.turnEntries.find(
        (entry) => entry.characterId === command.characterId && entry.turnType === "Move"
      );
      if (moveEntry) {
        const updatedEntry = setTurnEntryUsed(moveEntry.id, !moveEntry.used);
        nextState.characters = nextState.characters.map((character) =>
          character.id === command.characterId
            ? {
                ...character,
                moveActionUsed: Boolean(updatedEntry?.used)
              }
            : character
        );
        syncActiveCharacter();
      } else {
        nextState.characters = nextState.characters.map((character) =>
          character.id === command.characterId
            ? {
                ...character,
                moveActionUsed: !Boolean(character.moveActionUsed)
              }
            : character
        );
      }
      events.push({ type: "character-updated", characterId: command.characterId, detail: "move toggled" });
      return { state: nextState, events };
    }
    case "toggle-special-ability": {
      nextState.characters = nextState.characters.map((character) =>
        character.id === command.characterId && character.specialAbility
          ? {
              ...character,
              specialAbilityActive: !Boolean(character.specialAbilityActive)
            }
          : character
      );
      rebuildTurnEntries();
      events.push({ type: "special-ability-toggled", characterId: command.characterId });
      return { state: nextState, events };
    }
    case "start-round": {
      nextState.round += 1;
      nextState.turnEntries = [];
      nextState.activeCharacterId = null;
      nextState.characters = nextState.characters.map((character) => ({
        ...character,
        unfreeDefensePenalty: 0,
        paradeClickCount: 0,
        moveActionUsed: false,
        specialAbilityActive: false
      }));
      nextState.pendingInputs = nextState.characters
        .filter((character) => !character.incapacitated && character.initiativeRollMode !== "automatic")
        .map((character) => ({
          type: "roll" as const,
          request: {
            kind: "initiative-roll" as const,
            characterId: character.id,
            dice: "3d6" as const
          }
        }));
      events.push({ type: "round-started", detail: `round ${nextState.round}` });
      events.push(...nextState.pendingInputs.map((input) => ({
        type: "initiative-roll-requested" as const,
        characterId: input.request.characterId
      })));
      syncActiveCharacter();
      return { state: nextState, events };
    }
    case "activate-character": {
      nextState.activeCharacterId =
        command.characterId && nextState.turnEntries.some((entry) => entry.characterId === command.characterId)
          ? command.characterId
          : nextState.turnEntries[0]?.characterId ?? null;
      events.push({ type: "active-character-changed", characterId: nextState.activeCharacterId ?? undefined });
      return { state: nextState, events };
    }
    case "step-active-character": {
      if (!nextState.turnEntries.length) {
        nextState.activeCharacterId = null;
        return { state: nextState, events };
      }
      const currentIndex = Math.max(
        0,
        nextState.turnEntries.findIndex((entry) => entry.characterId === nextState.activeCharacterId)
      );
      const offset = command.direction === "previous" ? -1 : 1;
      const nextIndex = (currentIndex + offset + nextState.turnEntries.length) % nextState.turnEntries.length;
      nextState.activeCharacterId = nextState.turnEntries[nextIndex]?.characterId ?? nextState.turnEntries[0]?.characterId ?? null;
      events.push({ type: "active-character-changed", characterId: nextState.activeCharacterId ?? undefined });
      return { state: nextState, events };
    }
    case "resolve-initiative-roll": {
      nextState.characters = nextState.characters.map((character) => {
        if (character.id !== command.characterId) {
          return character;
        }
        const critBonusRoll = command.critBonusRoll ?? null;
        return {
          ...character,
          lastRoll: command.total,
          critBonusRoll,
          totalInitiative: computeTotalInitiative(character, command.total, critBonusRoll)
        };
      });
      nextState.pendingInputs = nextState.pendingInputs.filter(
        (input) => input.request.characterId !== command.characterId
      );
      rebuildTurnEntries();
      events.push({ type: "initiative-roll-resolved", characterId: command.characterId });
      return { state: nextState, events };
    }
  }

  const unsupportedCommand: never = command;
  throw new Error(`unsupported command: ${JSON.stringify(unsupportedCommand)}`);
}
