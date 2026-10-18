import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL,
  loadOpenCodeConfig,
} from "./config.js";

test("no key means no LLM: the agent stays deterministic", () => {
  assert.equal(loadOpenCodeConfig({}), undefined);
  assert.equal(loadOpenCodeConfig({ OPENCODE_API_KEY: "   " }), undefined);
});

test("derives the OpenAI-compatible endpoint from the defaults", () => {
  const config = loadOpenCodeConfig({ OPENCODE_API_KEY: "sk-test" });

  assert.equal(config?.apiKey, "sk-test");
  assert.equal(config?.model, DEFAULT_OPENCODE_MODEL);
  assert.equal(config?.baseUrl, DEFAULT_OPENCODE_BASE_URL);
  assert.equal(config?.chatCompletionsUrl, `${DEFAULT_OPENCODE_BASE_URL}/openai/v1/chat/completions`);
});

test("trims the base URL and lets model and base be overridden", () => {
  const config = loadOpenCodeConfig({
    OPENCODE_API_KEY: "  sk-test  ",
    OPENCODE_MODEL: "claude-sonnet-5",
    OPENCODE_BASE_URL: "https://gateway.example/v1///",
  });

  assert.equal(config?.apiKey, "sk-test");
  assert.equal(config?.model, "claude-sonnet-5");
  assert.equal(config?.chatCompletionsUrl, "https://gateway.example/v1/openai/v1/chat/completions");
});
