import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCommand,
  buildTurnEntries,
  cloneCombatState,
  computeCritical,
  computeDamagePenalty,
  computeTotalInitiative,
  createCharacter,
  createCombatState
} from "../dist/index.js";

function createPc(id, overrides = {}) {
  return {
    ...createCharacter({
      id,
      name: id,
      type: "PC",
      initiativeBase: 10,
      specialAbility: null
    }),
    ...overrides
  };
}

test("computeCritical returns success, failure, or null for initiative totals", () => {
  assert.equal(computeCritical(18), "success");
  assert.equal(computeCritical(3), "failure");
  assert.equal(computeCritical(11), null);
});

test("cloneCombatState creates defensive copies for nested state arrays", () => {
  const original = createCombatState([
    createPc("aria", { totalInitiative: 14, damageMonitorMarks: [true, false, false] })
  ]);
  original.events.push({
    id: "event-1",
    description: "Gift",
    dueRound: 2,
    createdAtRound: 1
  });
  original.turnEntries = [
    {
      id: "aria:main",
      characterId: "aria",
      turnType: "Main",
      groupInitiative: 14,
      critical: null,
      used: false,
      actionIndex: 0
    }
  ];
  original.pendingInputs.push({
    type: "roll",
    request: {
      kind: "initiative-roll",
      characterId: "aria",
      dice: "3d6"
    }
  });

  const cloned = cloneCombatState(original);
  cloned.characters[0].name = "Aria geändert";
  cloned.events[0].description = "Verändert";
  cloned.turnEntries[0].used = true;
  cloned.pendingInputs[0].request.characterId = "borin";

  assert.equal(original.characters[0].name, "aria");
  assert.equal(original.events[0].description, "Gift");
  assert.equal(original.turnEntries[0].used, false);
  assert.equal(original.pendingInputs[0].request.characterId, "aria");
});

test("buildTurnEntries adds special ability bonus to group initiative and grants bonus turn above 30", () => {
  const character = createPc("aria", {
    totalInitiative: 28,
    specialAbility: "Kampfreflexe",
    specialAbilityActive: true,
    lastRoll: 12
  });

  const entries = buildTurnEntries([character]);

  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => entry.turnType),
    ["Bonus", "Main", "Move"]
  );
  assert.deepEqual(
    entries.map((entry) => entry.groupInitiative),
    [31, 31, 31]
  );
});

test("toggle-surprised recalculates total initiative immediately for rolled characters", () => {
  const character = createPc("aria", {
    lastRoll: 11,
    critBonusRoll: 2,
    totalInitiative: computeTotalInitiative(createPc("aria"), 11, 2)
  });
  const state = createCombatState([character]);
  state.turnEntries = buildTurnEntries(state.characters);

  const result = applyCommand(state, {
    type: "toggle-surprised",
    characterId: "aria",
    surprised: true
  });

  assert.equal(result.state.characters[0].surprised, true);
  assert.equal(result.state.characters[0].totalInitiative, 13);
  assert.deepEqual(
    result.state.turnEntries.map((entry) => entry.groupInitiative),
    [13, 13]
  );
});

test("computeDamagePenalty uses the rightmost marked damage box", () => {
  const penalties = computeDamagePenalty({
    damageMonitorMarks: [false, false, false, false, false, false, false, true, false, false, true]
  });

  assert.deepEqual(penalties, { qm: 4, bew: 1 });
});

test("start-round creates reminder inputs and initiative inputs for visible non-automatic characters", () => {
  const state = createCombatState([
    createPc("aria", { initiativeRollMode: "manual" }),
    createPc("borin", { initiativeRollMode: "pixels" }),
    createPc("hidden", { hidden: true, initiativeRollMode: "manual" }),
    createPc("npc-auto", { type: "NPC", initiativeRollMode: "automatic" })
  ]);
  state.events = [
    { id: "event-now", description: "Jetzt", dueRound: 1, createdAtRound: 0 },
    { id: "event-later", description: "Später", dueRound: 3, createdAtRound: 0 }
  ];

  const result = applyCommand(state, { type: "start-round" });

  assert.equal(result.state.round, 1);
  assert.deepEqual(
    result.state.pendingInputs.map((input) => input.type === "event" ? input.request.eventId : input.request.characterId),
    ["event-now", "aria", "borin"]
  );
  assert.deepEqual(
    result.events.map((event) => event.type),
    ["round-started", "initiative-roll-requested", "initiative-roll-requested"]
  );
});

test("trigger-parade consumes bonus turn before main turn and only adds penalty without turns left", () => {
  const character = createPc("aria", {
    totalInitiative: 31,
    specialAbility: "Kampfreflexe",
    specialAbilityActive: true,
    lastRoll: 18
  });
  const state = createCombatState([character]);
  state.turnEntries = buildTurnEntries(state.characters);

  const afterBonus = applyCommand(state, { type: "trigger-parade", characterId: "aria" });
  assert.equal(afterBonus.state.turnEntries.find((entry) => entry.turnType === "Bonus")?.used, true);
  assert.equal(afterBonus.state.characters[0].unfreeDefensePenalty, 0);

  const afterMain = applyCommand(afterBonus.state, { type: "trigger-parade", characterId: "aria" });
  assert.equal(afterMain.state.turnEntries.find((entry) => entry.turnType === "Main")?.used, true);
  assert.equal(afterMain.state.characters[0].unfreeDefensePenalty, 6);

  const afterNoTurn = applyCommand(afterMain.state, { type: "trigger-parade", characterId: "aria" });
  assert.equal(afterNoTurn.state.characters[0].unfreeDefensePenalty, 12);
  assert.equal(afterNoTurn.state.characters[0].paradeClickCount, 3);
});
