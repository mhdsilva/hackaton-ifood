import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import type {
  ApiErrorBody,
  CreatePartyRequest,
  JoinPartyRequest,
  SubmitAnswersRequest,
} from "@sidequest/contracts";

import { DemoMcpOAuthProvider } from "./mcp/demo-oauth-provider.js";
import {
  McpOAuthError,
  McpOAuthFlow,
  type McpOAuthMode,
} from "./mcp/oauth-flow.js";
import { McpSessionRegistry } from "./mcp/session-registry.js";
import { ParticipantAccessStore } from "./party/access.js";
import { PartyError, PartyService } from "./party/service.js";
import { PartyStore } from "./party/store.js";

export interface PartyServerOptions {
  allowedOrigin: string;
  frontendUrl: string;
  oauth: McpOAuthFlow;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  allowedOrigin: string,
): void {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(statusCode === 204 ? undefined : JSON.stringify(body));
}

function sendRedirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { Location: location });
  response.end();
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

function bearerToken(request: IncomingMessage): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ") || authorization.slice(7).trim() === "") {
    throw new PartyError(401, "ACCESS_TOKEN_REQUIRED", "A participant Bearer token is required");
  }
  return authorization.slice(7).trim();
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: PartyService,
  options: PartyServerOptions,
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "OPTIONS") {
    sendJson(response, 204, null, options.allowedOrigin);
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" }, options.allowedOrigin);
    return;
  }

  if (method === "POST" && url.pathname === "/parties") {
    const result = service.create(await readJson<CreatePartyRequest>(request));
    sendJson(response, 201, result, options.allowedOrigin);
    return;
  }

  const oauthRoute = url.pathname.match(
    /^\/parties\/([^/]+)\/mcp-connection\/(authorize|callback)$/,
  );
  if (oauthRoute) {
    const partyId = decodeURIComponent(oauthRoute[1]);
    const action = oauthRoute[2];

    if (method === "POST" && action === "authorize") {
      const token = bearerToken(request);
      const actor = service.authorizeParticipant(partyId, token);
      const authorization = options.oauth.start(actor);
      service.setMcpConnectionStatus(partyId, token, "validating");
      sendJson(response, 200, authorization, options.allowedOrigin);
      return;
    }

    if (method === "GET" && action === "callback") {
      const actor = await options.oauth.complete({
        partyId: service.get(partyId).party.id,
        code: url.searchParams.get("code") ?? "",
        state: url.searchParams.get("state") ?? "",
        providerError: url.searchParams.get("error") ?? undefined,
      });
      service.setMcpConnectionStatusForParticipant(
        actor.partyId,
        actor.participantId,
        "connected",
      );
      const redirect = new URL(options.frontendUrl);
      redirect.searchParams.set("partyId", actor.partyId);
      redirect.searchParams.set("mcp", "connected");
      sendRedirect(response, redirect.toString());
      return;
    }

    throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  const route = url.pathname.match(
    /^\/parties\/([^/]+)(?:\/(join|close|answers))?$/,
  );
  if (!route) {
    throw new PartyError(404, "ROUTE_NOT_FOUND", "Route not found");
  }

  const partyId = decodeURIComponent(route[1]);
  const action = route[2];
  if (method === "GET" && !action) {
    sendJson(response, 200, service.get(partyId), options.allowedOrigin);
    return;
  }
  if (method !== "POST" || !action) {
    throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  switch (action) {
    case "join":
      sendJson(
        response,
        200,
        service.join(partyId, await readJson<JoinPartyRequest>(request)),
        options.allowedOrigin,
      );
      return;
    case "close":
      sendJson(
        response,
        200,
        service.closeMembership(partyId, bearerToken(request)),
        options.allowedOrigin,
      );
      return;
    case "answers":
      sendJson(
        response,
        200,
        service.submitAnswers(
          partyId,
          bearerToken(request),
          await readJson<SubmitAnswersRequest>(request),
        ),
        options.allowedOrigin,
      );
      return;
  }
}

export async function handlePartyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: PartyService,
  options: PartyServerOptions,
): Promise<void> {
  try {
    await routeRequest(request, response, service, options);
  } catch (error: unknown) {
    if (error instanceof McpOAuthError) {
      if (error.actor) {
        service.setMcpConnectionStatusForParticipant(
          error.actor.partyId,
          error.actor.participantId,
          "error",
        );
      }
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message },
      };
      sendJson(response, 400, body, options.allowedOrigin);
      return;
    }
    if (error instanceof PartyError) {
      const body: ApiErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      };
      sendJson(response, error.statusCode, body, options.allowedOrigin);
      return;
    }

    console.error("Unhandled request error", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    sendJson(
      response,
      500,
      { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } } satisfies ApiErrorBody,
      options.allowedOrigin,
    );
  }
}

export function createPartyServer(
  service: PartyService,
  options: PartyServerOptions,
): Server {
  return createServer((request, response) => {
    void handlePartyRequest(request, response, service, options);
  });
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

/**
 * Apenas o modo de demonstração está implementado. O modo real (`ifood`) exige um agente
 * homologado e credenciais do iFood; até então, recusamos subir em vez de simular OAuth real
 * silenciosamente.
 */
export function resolveMcpOAuthMode(raw: string | undefined): McpOAuthMode {
  const value = (raw ?? "demo").trim().toLowerCase();
  if (value === "demo") return "demo";
  if (value === "ifood") {
    throw new Error(
      "MCP_OAUTH_MODE=ifood ainda não está implementado: faltam agente homologado e credenciais reais do iFood",
    );
  }
  throw new Error(`MCP_OAUTH_MODE inválido: ${raw}`);
}

if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 3333);
  const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  const frontendUrl = process.env.FRONTEND_URL ?? allowedOrigin;
  const publicApiUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${port}`;
  const oauthMode = resolveMcpOAuthMode(process.env.MCP_OAUTH_MODE);
  const service = new PartyService(new PartyStore(), new ParticipantAccessStore());
  const sessions = new McpSessionRegistry();
  const oauth = new McpOAuthFlow(
    new DemoMcpOAuthProvider(publicApiUrl),
    sessions,
  );
  const server = createPartyServer(service, {
    allowedOrigin,
    frontendUrl,
    oauth,
  });

  server.listen(port, () => {
    console.log(`SideQuest Party API listening on http://localhost:${port}`);
    console.log(`MCP OAuth callback base: ${publicApiUrl}`);
    if (oauthMode === "demo") {
      console.warn(
        "MCP OAuth em MODO DEMONSTRAÇÃO: os tokens são sintéticos e nenhuma conta real do iFood é conectada.",
      );
    }
  });
}
