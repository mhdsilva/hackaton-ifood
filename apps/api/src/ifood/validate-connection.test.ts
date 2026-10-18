import assert from "node:assert/strict";
import { test } from "node:test";

import type { IfoodMcpClient } from "./client.js";
import { validateConnection } from "./validate-connection.js";

type Caller = Pick<IfoodMcpClient, "callTool">;

function caller(result: unknown): Caller {
  return { callTool: async () => result } as unknown as Caller;
}

test("connects and returns the display name from getUser", async () => {
  const validation = await validateConnection(
    caller({ success: true, data: { fullName: "  Ana Souza  ", email: "ana@example.com" } }),
  );

  assert.deepEqual(validation, { status: "connected", name: "Ana Souza" });
  assert.equal("email" in validation, false);
});

test("connects even when the profile has no name", async () => {
  assert.deepEqual(await validateConnection(caller({ success: true, data: {} })), {
    status: "connected",
  });
});

test("an explicit getUser failure is an error without a name", async () => {
  assert.deepEqual(await validateConnection(caller({ success: false })), { status: "error" });
});

test("a transport failure is an error, never the exception message", async () => {
  const client = {
    callTool: async () => {
      throw new Error("token private-value");
    },
  } as unknown as Caller;

  assert.deepEqual(await validateConnection(client), { status: "error" });
});
