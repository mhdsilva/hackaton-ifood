import assert from "node:assert/strict";
import { test } from "node:test";

import type { QuestionnaireDefinition } from "@sidequest/contracts";

import {
  countAnswered,
  getQuestionnaire,
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

test("serves v2 by default and keeps v1 retrievable", () => {
  const current = getQuestionnaire();
  assert.equal(current?.version, "v2");
  assert.equal(getQuestionnaire("v1")?.version, "v1");
  assert.equal(getQuestionnaire("v9"), undefined);
  assert.deepEqual(
    current?.questions.map((question) => question.id),
    ["address", "restrictions", "budget", "energy", "order-style", "cravings", "exclusions"],
  );
  assert.equal(
    current?.questions.find((question) => question.id === "cravings")?.maxSelections,
    2,
  );
  assert.equal(current?.questions.find((question) => question.id === "cravings")?.required, true);
  assert.equal(
    current?.questions.find((question) => question.id === "restrictions")?.allowOther,
    true,
  );
  assert.equal(
    current?.questions.find((question) => question.id === "budget")?.customInput?.max,
    999,
  );
});

test("validates a full v2 response", () => {
  const v2 = getQuestionnaire("v2");
  assert.ok(v2);

  const complete = {
    address: "casa",
    restrictions: ["veganismo"],
    budget: "ate-50",
    energy: "leve-refrescante",
    "order-style": "refeicao-completa",
    cravings: ["fresco", "crocante"],
    exclusions: ["fritura"],
  };
  assert.deepEqual(validateAnswers(v2, complete), []);

  assert.deepEqual(
    validateAnswers(v2, { ...complete, cravings: ["fresco", "crocante", "cremoso"] }),
    [{ questionId: "cravings", reason: "too_many_selections" }],
  );

  assert.deepEqual(
    validateAnswers(v2, { address: "casa" }).map((issue) => issue.questionId),
    ["budget", "energy", "order-style", "cravings"],
  );
});

test("v2 requires one or two cravings to finish but accepts incomplete drafts", () => {
  const v2 = getQuestionnaire("v2");
  assert.ok(v2);
  const answers = { address: "casa", budget: "ate-50", energy: "leve-refrescante", "order-style": "refeicao-completa" };
  for (const cravings of [undefined, [], ["crocante"], ["crocante", "cremoso"], ["crocante", "cremoso", "fresco"]]) {
    const response = cravings === undefined ? answers : { ...answers, cravings };
    const expected = !cravings?.length
      ? [{ questionId: "cravings", reason: "required" }]
      : cravings.length > 2 ? [{ questionId: "cravings", reason: "too_many_selections" }] : [];
    assert.deepEqual(validateAnswers(v2, response), expected);
  }
  assert.deepEqual(validateAnswers(v2, {}, { requireComplete: false }), []);
  assert.deepEqual(validateAnswers(v2, { cravings: [] }, { requireComplete: false }), []);
  assert.deepEqual(validateAnswers(v2, { cravings: ["crocante", "cremoso", "fresco"] }, { requireComplete: false }), [
    { questionId: "cravings", reason: "too_many_selections" },
  ]);
});
