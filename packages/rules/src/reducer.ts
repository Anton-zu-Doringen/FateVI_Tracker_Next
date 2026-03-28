import { cloneCombatState, createCharacter, getDefaultInitiativeRollMode } from "./state.js";
import { buildTurnEntries, computeTotalInitiative } from "./initiative.js";
import { getDefaultDazedUntilRound, isCharacterDazed, normalizeDamageMonitorMarks } from "./damage.js";
import type { CombatState, Command, RuleEvent, RuleResult, TurnEntry } from "./types.js";

export function applyCommand(state: CombatState, command: Command): RuleResult {
  const nextState = cloneCombatState(state);
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

  const buildOrderedIds = (requestedIds: string[], existingIds: string[]) => {
    const existingIdSet = new Set(existingIds);
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of requestedIds) {
      if (existingIdSet.has(id) && !seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
    for (const id of existingIds) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
    return ordered;
  };

  switch (command.type) {
    case "add-character": {
      nextState.characters = [...nextState.characters, createCharacter(command.character)];
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.character.id, detail: "character added" });
      return { state: nextState, events };
    }
    case "update-character": {
      const previousCharacter = nextState.characters.find((character) => character.id === command.characterId) ?? null;
      const hiddenChanged =
        typeof command.patch.hidden === "boolean" && previousCharacter && command.patch.hidden !== previousCharacter.hidden;
      nextState.characters = nextState.characters.map((character) =>
        character.id === command.characterId
          ? {
              ...character,
              ...command.patch,
              ...(hiddenChanged
                ? {
                    lastRoll: null,
                    critBonusRoll: null,
                    totalInitiative: null,
                    moveActionUsed: false,
                    specialAbilityActive: false
                  }
                : {}),
              initiativeRollMode:
                command.patch.initiativeRollMode ??
                character.initiativeRollMode ??
                getDefaultInitiativeRollMode(command.patch.type ?? character.type)
            }
          : character
      );
      if (hiddenChanged) {
        nextState.pendingInputs = nextState.pendingInputs.filter(
          (input) => !(input.type === "roll" && input.request.kind === "initiative-roll" && input.request.characterId === command.characterId)
        );
      }
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.characterId, detail: "character updated" });
      return { state: nextState, events };
    }
    case "remove-character": {
      nextState.characters = nextState.characters.filter((character) => character.id !== command.characterId);
      nextState.pendingInputs = nextState.pendingInputs.filter(
        (input) => !(input.type === "roll" && input.request.kind === "initiative-roll" && input.request.characterId === command.characterId)
      );
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
        character.id === command.characterId
          ? {
              ...character,
              surprised: command.surprised,
              totalInitiative:
                character.lastRoll === null ? character.totalInitiative : computeTotalInitiative({ ...character, surprised: command.surprised }, character.lastRoll, character.critBonusRoll)
            }
          : character
      );
      rebuildTurnEntries();
      events.push({ type: "character-updated", characterId: command.characterId, detail: "surprised toggled" });
      return { state: nextState, events };
    }
    case "toggle-incapacitated": {
      nextState.characters = nextState.characters.map((character) =>
        character.id === command.characterId ? { ...character, incapacitated: command.incapacitated } : character
      );
      nextState.pendingInputs = nextState.pendingInputs.filter(
        (input) => !(input.type === "roll" && input.request.kind === "initiative-roll" && input.request.characterId === command.characterId)
      );
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
    case "add-event": {
      nextState.events = [...nextState.events, { ...command.event }];
      events.push({ type: "event-updated", eventId: command.event.id, detail: "event added" });
      return { state: nextState, events };
    }
    case "remove-event": {
      nextState.events = nextState.events.filter((event) => event.id !== command.eventId);
      nextState.pendingInputs = nextState.pendingInputs.filter(
        (input) => !(input.type === "event" && input.request.kind === "event-reminder" && input.request.eventId === command.eventId)
      );
      events.push({ type: "event-updated", eventId: command.eventId, detail: "event removed" });
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
      const eventReminderInputs = nextState.events
        .filter((event) => event.dueRound <= nextState.round)
        .map((event) => ({
          type: "event" as const,
          request: {
            kind: "event-reminder" as const,
            eventId: event.id
          }
        }));
      const initiativeInputs = nextState.characters
        .filter((character) => !character.hidden && !character.incapacitated && character.initiativeRollMode !== "automatic")
        .map((character) => ({
          type: "roll" as const,
          request: {
            kind: "initiative-roll" as const,
            characterId: character.id,
            dice: "3d6" as const
          }
        }));
      nextState.pendingInputs = [...eventReminderInputs, ...initiativeInputs];
      events.push({ type: "round-started", detail: `round ${nextState.round}` });
      events.push(
        ...initiativeInputs.map((input) => ({
          type: "initiative-roll-requested" as const,
          characterId: input.request.characterId
        }))
      );
      syncActiveCharacter();
      return { state: nextState, events };
    }
    case "end-combat": {
      nextState.characters = nextState.characters.map((character) => ({
        ...character,
        lastRoll: null,
        critBonusRoll: null,
        totalInitiative: null,
        dazedUntilRound: null,
        unfreeDefensePenalty: 0,
        paradeClickCount: 0,
        moveActionUsed: false,
        specialAbilityActive: false
      }));
      nextState.events = [];
      nextState.turnEntries = [];
      nextState.round = 0;
      nextState.activeCharacterId = null;
      nextState.pendingInputs = [];
      events.push({ type: "combat-ended", detail: "combat cleared" });
      return { state: nextState, events };
    }
    case "reorder-characters": {
      const currentIds = nextState.characters.map((character) => character.id);
      const orderedIds = buildOrderedIds(command.characterIds, currentIds);
      const characterById = new Map(nextState.characters.map((character) => [character.id, character]));
      nextState.characters = orderedIds
        .map((id) => characterById.get(id))
        .filter((character): character is (typeof nextState.characters)[number] => Boolean(character));
      events.push({ type: "character-updated", detail: "characters reordered" });
      return { state: nextState, events };
    }
    case "reorder-turn-groups": {
      const currentIds = getSortedCharacterOrder();
      const orderedIds = buildOrderedIds(command.characterIds, currentIds);
      const rankById = new Map(orderedIds.map((id, index) => [id, index]));
      nextState.turnEntries = [...nextState.turnEntries].sort((left, right) => {
        const leftRank = rankById.get(left.characterId) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = rankById.get(right.characterId) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || left.actionIndex - right.actionIndex || left.id.localeCompare(right.id);
      });
      syncActiveCharacter();
      events.push({ type: "turn-entry-toggled", detail: "turn groups reordered" });
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
      const characterOrder = getSortedCharacterOrder();
      if (!characterOrder.length) {
        nextState.activeCharacterId = null;
        return { state: nextState, events };
      }
      const currentIndex = Math.max(0, characterOrder.indexOf(nextState.activeCharacterId ?? ""));
      const offset = command.direction === "previous" ? -1 : 1;
      const nextIndex = (currentIndex + offset + characterOrder.length) % characterOrder.length;
      nextState.activeCharacterId = characterOrder[nextIndex] ?? characterOrder[0] ?? null;
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
        (input) => !(input.type === "roll" && input.request.kind === "initiative-roll" && input.request.characterId === command.characterId)
      );
      rebuildTurnEntries();
      events.push({ type: "initiative-roll-resolved", characterId: command.characterId });
      return { state: nextState, events };
    }
  }

  const unsupportedCommand: never = command;
  throw new Error(`unsupported command: ${JSON.stringify(unsupportedCommand)}`);
}
