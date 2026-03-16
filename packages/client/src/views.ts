import type { CombatState } from "@fatevi/rules";
import type { PlayerView } from "@fatevi/server";

export function renderPlayerSummary(view: PlayerView): string {
  const lines = [
    `Runde: ${view.round}`,
    `Aktiv: ${view.activeCharacterId ?? "-"}`,
    "INI:"
  ];
  for (const entry of view.turnEntries) {
    lines.push(`- ${entry.characterId}: ${entry.groupInitiative}`);
  }
  return lines.join("\n");
}

export function renderGmSummary(state: CombatState): string {
  const lines = [
    `Runde: ${state.round}`,
    `Aktiv: ${state.activeCharacterId ?? "-"}`,
    `Charaktere: ${state.characters.length}`
  ];
  for (const character of state.characters) {
    lines.push(`- ${character.name} (${character.type}) INI=${character.totalInitiative ?? "-"}`);
  }
  return lines.join("\n");
}
