import assert from "node:assert/strict";
import { test } from "node:test";

import type { QuestionnaireDefinition } from "@sidequest/contracts";

import {
  countAnswered,
  otherAnswerKey,
  validateAnswers,
  valueAnswerKey,
} from "./questionnaire.js";

const definition: QuestionnaireDefinition = {
  version: "test",
  title: "Teste",
  questions: [
    { id: "address", type: "address", label: "Onde?", required: true },
    {
      id: "restrictions",
      type: "multi_choice",
      label: "Restrições?",
      required: false,
      allowOther: true,
      otherOptionId: "outro",
      options: [
        { id: "vegetariano", label: "Vegetariano" },
        { id: "outro", label: "Outro" },
      ],
    },
    {
      id: "cravings",
      type: "multi_choice",
      label: "Desejos?",
      required: false,
      maxSelections: 2,
      options: [
        { id: "crocante", label: "Crocante" },
        { id: "cremoso", label: "Cremoso" },
        { id: "fresco", label: "Fresco" },
      ],
    },
    {
      id: "budget",
      type: "single_choice",
      label: "Quanto?",
      required: true,
      customInput: {
        label: "Outro valor",
        placeholder: "Até R$ 50,00",
        min: 1,
        max: 999,
      },
      options: [
        { id: "ate-25", label: "Até R$25", value: 25 },
        { id: "outro", label: "Outro valor" },
      ],
    },
  ],
};

test("requires the other text when the other option is picked", () => {
  const missing = validateAnswers(definition, {
    address: "casa",
    budget: "ate-25",
    restrictions: ["outro"],
  });
  assert.deepEqual(missing, [
    { questionId: "restrictions", reason: "other_required" },
  ]);

  const filled = validateAnswers(definition, {
    address: "casa",
    budget: "ate-25",
    restrictions: ["outro"],
    [otherAnswerKey("restrictions")]: "Alergia a amendoim",
  });
  assert.deepEqual(filled, []);
});

test("caps multi_choice selections with maxSelections", () => {
  const issues = validateAnswers(definition, {
    address: "casa",
    budget: "ate-25",
    cravings: ["crocante", "cremoso", "fresco"],
  });
  assert.deepEqual(issues, [
    { questionId: "cravings", reason: "too_many_selections" },
  ]);
});

test("requires the custom value when the custom option is picked", () => {
  const missing = validateAnswers(definition, { address: "casa", budget: "outro" });
  assert.deepEqual(missing, [
    { questionId: "budget", reason: "custom_value_required" },
  ]);

  const outOfRange = validateAnswers(definition, {
    address: "casa",
    budget: "outro",
    [valueAnswerKey("budget")]: 0,
  });
  assert.deepEqual(outOfRange, [
    { questionId: "budget", reason: "custom_value_required" },
  ]);

  const ok = validateAnswers(definition, {
    address: "casa",
    budget: "outro",
    [valueAnswerKey("budget")]: 50,
  });
  assert.deepEqual(ok, []);
});

test("drafts skip required fields but still validate what is present", () => {
  assert.deepEqual(validateAnswers(definition, {}, { requireComplete: false }), []);

  assert.deepEqual(
    validateAnswers(definition, { budget: "inexistente" }, { requireComplete: false }),
    [{ questionId: "budget", reason: "invalid_option" }],
  );
});

test("counts answered questions", () => {
  assert.equal(countAnswered(definition, {}), 0);
  assert.equal(
    countAnswered(definition, { address: "casa", budget: "ate-25" }),
    2,
  );
});
