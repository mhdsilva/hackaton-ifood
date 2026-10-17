import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type {
  AdvancePartyRequest,
  ApiErrorBody,
  CreatePartyRequest,
  JoinPartyRequest,
  PlanPartyRequest,
  SaveAnswersRequest,
  SetOrderStatusRequest,
  SetReadyRequest,
} from "@sidequest/contracts";

import { PartyError, PartyService } from "./party/service.js";
import { PartyStore } from "./party/store.js";

const service = new PartyService(new PartyStore());
const port = Number(process.env.PORT ?? 3333);

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 1_000_000) {
      throw new PartyError(413, "BODY_TOO_LARGE", "Request body exceeds 1 MB");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {} as T;

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new PartyError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (method === "POST" && url.pathname === "/parties") {
    sendJson(response, 201, service.create(await readJson<CreatePartyRequest>(request)));
    return;
  }

  const route = url.pathname.match(
    /^\/parties\/([^/]+)(?:\/(join|answers|plan|ready|order-status|advance))?$/,
  );
  if (!route) {
    throw new PartyError(404, "ROUTE_NOT_FOUND", "Route not found");
  }

  const partyId = decodeURIComponent(route[1]);
  const action = route[2];
  if (method === "GET" && !action) {
    sendJson(response, 200, service.get(partyId));
    return;
  }
  if (method !== "POST" || !action) {
    throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  switch (action) {
    case "join":
      sendJson(response, 200, service.join(partyId, await readJson<JoinPartyRequest>(request)));
      return;
    case "answers":
      sendJson(response, 200, service.saveAnswers(partyId, await readJson<SaveAnswersRequest>(request)));
      return;
    case "plan":
      sendJson(response, 200, service.plan(partyId, await readJson<PlanPartyRequest>(request)));
      return;
    case "ready":
      sendJson(response, 200, service.setReady(partyId, await readJson<SetReadyRequest>(request)));
      return;
    case "order-status":
      sendJson(response, 200, service.setOrderStatus(partyId, await readJson<SetOrderStatusRequest>(request)));
      return;
    case "advance":
      sendJson(response, 200, service.advance(partyId, await readJson<AdvancePartyRequest>(request)));
      return;
  }
}

const server = createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    if (error instanceof PartyError) {
      const body: ApiErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      };
      sendJson(response, error.statusCode, body);
      return;
    }

    console.error(error);
    sendJson(response, 500, {
      error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
    } satisfies ApiErrorBody);
  });
});

server.listen(port, () => {
  console.log(`SideQuest Party API listening on http://localhost:${port}`);
});
