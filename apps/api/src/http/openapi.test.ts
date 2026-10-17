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

test("documents starting participant OAuth authorization", () => {
  const path = document.paths["/parties/{partyId}/mcp-connection/authorize"];
  const operation = path?.post;

  assert.deepEqual(operation?.security, [{ participantToken: [] }]);
  assert.equal(operation?.requestBody, undefined);

  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  ajv.addSchema(document, "openapi-oauth-authorize");
  const validate = ajv.compile(
    operation.responses["200"].content["application/json"].schema,
  );

  assert.equal(
    validate({
      authorizationUrl: "https://oauth.example/authorize?state=opaque",
      status: "validating",
      mode: "demo",
    }),
    true,
    JSON.stringify(validate.errors),
  );
  assert.equal(validate({ status: "validating" }), false);
  assert.equal(
    validate({
      authorizationUrl: "https://oauth.example/authorize?state=opaque",
      status: "validating",
      mode: "simulated",
    }),
    false,
  );
});

test("documents the unauthenticated OAuth callback redirect", () => {
  const operation =
    document.paths["/parties/{partyId}/mcp-connection/callback"]?.get;

  assert.deepEqual(operation?.security, []);
  assert.deepEqual(
    operation?.parameters.map((parameter: any) => [
      parameter.name,
      parameter.in,
      parameter.required,
    ]),
    [
      ["code", "query", true],
      ["state", "query", true],
    ],
  );
  assert.equal(operation?.responses["302"].headers.Location.required, true);
  assert.equal(
    operation?.responses["302"].headers.Location.schema.format,
    "uri-reference",
  );
});

test("does not expose the retired apiKey MCP placeholder", () => {
  assert.equal(document.paths["/parties/{partyId}/mcp-connection"], undefined);
  assert.equal(JSON.stringify(document).includes("apiKey"), false);
});

test("documents the questionnaire definition for the frontend", () => {
  const operation = document.paths["/questionnaire"]?.get;
  assert.ok(operation);

  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  ajv.addSchema(document, "openapi-questionnaire");
  const validate = ajv.compile({
    $ref: "openapi-questionnaire#/components/schemas/QuestionnaireDefinition",
  });

  assert.equal(
    validate({
      version: "v1",
      title: "Nos conte o essencial",
      questions: [
        { id: "budget", type: "scale", label: "Quanto?", required: true, min: 1, max: 5 },
      ],
    }),
    true,
    JSON.stringify(validate.errors),
  );
  assert.equal(validate({ version: "v1", questions: [] }), false);
});

test("documents the participant session endpoint as Bearer-protected", () => {
  const operation = document.paths["/parties/{partyId}/session"]?.get;
  assert.deepEqual(operation?.security, [{ participantToken: [] }]);
});
