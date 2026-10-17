import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { parse } from "yaml";

const require = createRequire(import.meta.url);
const addFormats = require("ajv-formats") as FormatsPlugin;

const document = parse(
  readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8"),
) as any;

test("accepts a completed questionnaire response in a public snapshot", () => {
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  ajv.addSchema(document, "openapi");
  const validate = ajv.compile({
    $ref: "openapi#/components/schemas/QuestionnaireResponse",
  });

  const valid = validate({
    questionnaireVersion: "v1",
    answers: { preference: "massa" },
    completed: true,
    submittedAt: "2026-10-17T20:02:00.000Z",
  });

  assert.equal(valid, true, JSON.stringify(validate.errors));
});

test("documents participantToken as a value returned to the client", () => {
  const tokenSchema =
    document.components.responses.PartySessionResponse.content["application/json"].schema
      .properties.participantToken;

  assert.equal(tokenSchema.writeOnly, undefined);
});
