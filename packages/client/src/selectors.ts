import type { PendingInput } from "@fatevi/rules";
import type { PlayerView } from "@fatevi/server";

export interface CharacterUiState {
  characterId: string;
  isActive: boolean;
  isPendingInitiative: boolean;
  canSubmitInitiativeRoll: boolean;
}

export function getPendingInitiativeInputs(view: PlayerView): PendingInput[] {
  return view.pendingInputs.filter((input) => input.type === "roll" && input.request.kind === "initiative-roll");
}

export function getCharacterUiState(view: PlayerView, characterId: string): CharacterUiState {
  const pendingInputs = getPendingInitiativeInputs(view);
  const isPendingInitiative = pendingInputs.some((input) => input.request.characterId === characterId);
  return {
    characterId,
    isActive: view.activeCharacterId === characterId,
    isPendingInitiative,
    canSubmitInitiativeRoll: isPendingInitiative
  };
}

export function getOwnedPendingInitiativeCharacterIds(view: PlayerView): string[] {
  return getPendingInitiativeInputs(view).map((input) => input.request.characterId);
}
