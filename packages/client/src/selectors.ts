import type { PendingInput } from "@fatevi/rules";
import type { PlayerView } from "@fatevi/server";

type InitiativeRollInput = PendingInput & {
  type: "roll";
  request: { kind: "initiative-roll"; characterId: string; dice: "3d6" };
};

export interface CharacterUiState {
  characterId: string;
  isActive: boolean;
  isPendingInitiative: boolean;
  canSubmitInitiativeRoll: boolean;
}

function isInitiativeRollInput(
  input: PendingInput
): input is InitiativeRollInput {
  return input.type === "roll" && input.request.kind === "initiative-roll";
}

export function getPendingInitiativeInputs(view: PlayerView): InitiativeRollInput[] {
  return view.pendingInputs.filter(isInitiativeRollInput);
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
