import type { Character, CriticalState, TurnEntry } from "./types.js";

export function getSpecialAbilityInitiativeBonus(character: Character): number {
  return character.specialAbility && character.specialAbilityActive ? 3 : 0;
}

export function computeCritical(total: number): CriticalState {
  if (total === 18) {
    return "success";
  }
  if (total === 3) {
    return "failure";
  }
  return null;
}

export function computeTotalInitiative(character: Character, rollTotal: number, critBonusRoll: number | null = null): number {
  const surprisePenalty = character.surprised ? -10 : 0;
  return character.initiativeBase + rollTotal + (critBonusRoll ?? 0) + surprisePenalty;
}

export function buildTurnEntries(characters: Character[], previousEntries: TurnEntry[] = []): TurnEntry[] {
  const previousEntriesById = new Map(previousEntries.map((entry) => [entry.id, entry]));
  const nextEntries: TurnEntry[] = [];

  for (const character of characters) {
    if (character.incapacitated || character.totalInitiative === null) {
      continue;
    }

    const groupInitiative = (character.totalInitiative ?? 0) + getSpecialAbilityInitiativeBonus(character);
    const critical = computeCritical(character.lastRoll ?? 0);
    const hasBonusAction = groupInitiative > 30;
    const turnOrder = hasBonusAction
      ? [
          { turnType: "Bonus" as const, actionIndex: 0 },
          { turnType: "Main" as const, actionIndex: 1 },
          { turnType: "Move" as const, actionIndex: 2 }
        ]
      : [
          { turnType: "Main" as const, actionIndex: 0 },
          { turnType: "Move" as const, actionIndex: 1 }
        ];

    for (const turn of turnOrder) {
      const id = `${character.id}:${turn.turnType.toLowerCase()}`;
      const previous = previousEntriesById.get(id);
      nextEntries.push({
        id,
        characterId: character.id,
        turnType: turn.turnType,
        groupInitiative,
        critical,
        used: Boolean(previous?.used),
        actionIndex: turn.actionIndex
      });
    }
  }

  return nextEntries.sort(
    (left, right) =>
      right.groupInitiative - left.groupInitiative ||
      left.actionIndex - right.actionIndex ||
      left.characterId.localeCompare(right.characterId)
  );
}
