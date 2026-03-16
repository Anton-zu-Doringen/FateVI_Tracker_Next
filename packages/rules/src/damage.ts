import type { Character } from "./types.js";

export const DAMAGE_MONITOR_COLUMN_COUNT = 16;
export const DAMAGE_QM_VALUES = ["-", "-", "-", "-", "-", "-", "-", "-1", "-2", "-3", "-4", "-7", "-8", "-9", "-12", "-15"] as const;
export const DAMAGE_BEW_VALUES = ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-1", "-1", "-2", "-3", "-5", "-7"] as const;

function parseDamagePenalty(value: string): number {
  if (!value || value === "-") {
    return 0;
  }
  const parsed = Number.parseInt(String(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

export function normalizeDamageMonitorMarks(value: unknown): boolean[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: DAMAGE_MONITOR_COLUMN_COUNT }, (_, index) => Boolean(source[index]));
}

export function computeDamagePenalty(character: Pick<Character, "damageMonitorMarks">): { qm: number; bew: number } {
  const marks = normalizeDamageMonitorMarks(character.damageMonitorMarks);
  let rightmostIndex = -1;
  for (let index = DAMAGE_MONITOR_COLUMN_COUNT - 1; index >= 0; index -= 1) {
    if (marks[index]) {
      rightmostIndex = index;
      break;
    }
  }

  if (rightmostIndex === -1) {
    return { qm: 0, bew: 0 };
  }

  return {
    qm: parseDamagePenalty(DAMAGE_QM_VALUES[rightmostIndex] ?? "-"),
    bew: parseDamagePenalty(DAMAGE_BEW_VALUES[rightmostIndex] ?? "-")
  };
}

export function getDefaultDazedUntilRound(round: number): number {
  const currentRound = round > 0 ? round : 1;
  return currentRound + 1;
}

export function isCharacterDazed(character: Pick<Character, "dazedUntilRound">, round: number): boolean {
  if (character.dazedUntilRound === null || character.dazedUntilRound === undefined) {
    return false;
  }
  if (round <= 0) {
    return false;
  }
  return round <= character.dazedUntilRound;
}
