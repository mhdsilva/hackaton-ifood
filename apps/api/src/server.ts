import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import type {
  AddressResolutionResponse,
  ApiErrorBody,
  CreatePartyRequest,
  CreateParticipantAddressRequest,
  JoinPartyRequest,
  SubmitAnswersRequest,
} from "@sidequest/contracts";

import { AgentError } from "./agent/pick-address.js";
import {
  createDemoIntegration,
  createIfoodIntegration,
  type PartyAgentIntegration,
} from "./agent/integration.js";
import type { LocalOption } from "./agent/types.js";
import { CheckoutError } from "./ifood/checkout.js";
import { IfoodMcpError } from "./ifood/client.js";
import { createIfoodProvider, loadIfoodConfig } from "./ifood/index.js";
import { loadOpenCodeConfig, OpenCodeClient } from "./llm/index.js";
import { DemoMcpOAuthProvider } from "./mcp/demo-oauth-provider.js";
import { McpOAuthError, McpOAuthFlow } from "./mcp/oauth-flow.js";
import type { McpOAuthMode, McpOAuthProvider } from "./ifood/provider.js";
import { McpSessionRegistry } from "./mcp/session-registry.js";
import { ParticipantAccessStore } from "./party/access.js";
import { getQuestionnaire } from "./party/questionnaire.js";
import { PartyError, PartyService } from "./party/service.js";
import { PartyStore } from "./party/store.js";

export interface PartyServerOptions {
  allowedOrigins: string[];
  frontendUrl: string;
  oauth: McpOAuthFlow;
  /** Agente e cliente MCP; ver apps/api/src/agent/integration.ts. */
  agent?: PartyAgentIntegration;
  /** Caminho do callback único; segue a redirect cadastrada no iFood. */
  callbackPath?: string;
}

export const DEFAULT_CALLBACK_PATH = "/mcp-connection/callback";

const AGENT_ERROR_STATUS: Record<AgentError["code"], number> = {
  NO_ADDRESS: 409,
  ADDRESS_SELECTION_REQUIRED: 409,
  ADDRESS_NOT_FOUND: 409,
  ADDRESS_CREATION_FAILED: 502,
  MCP_NOT_CONNECTED: 409,
  NOT_FOUND: 404,
  NO_OPTIONS: 422,
  TIMEOUT: 504,
};

const CHECKOUT_ERROR_STATUS: Record<CheckoutError["code"], number> = {
  CONSENT_REQUIRED: 400,
  CART_NOT_CREATED: 502,
  NO_DELIVERY_METHOD: 422,
  PAYMENT_METHOD_UNAVAILABLE: 422,
  ORDER_NOT_CREATED: 502,
};

/** Traduz erros do agente e do iFood para respostas HTTP sem detalhes internos. */
async function runAgent<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AgentError) {
      throw new PartyError(AGENT_ERROR_STATUS[error.code], error.code, error.message, error.details);
    }
    if (error instanceof CheckoutError) {
      throw new PartyError(CHECKOUT_ERROR_STATUS[error.code], error.code, error.message);
    }
    if (error instanceof IfoodMcpError && error.code === "TOOL_ERROR") {
      const toolError = error.details as { code?: unknown } | undefined;
      if (toolError?.code === "MISSING_NEIGHBORHOOD") {
        throw new PartyError(422, "NEIGHBORHOOD_REQUIRED", "Informe o bairro para salvar este endereço");
      }
      if (toolError?.code === "CANDIDATE_ID_CONFLICT") {
        throw new PartyError(409, "ADDRESS_CANDIDATE_CONFLICT", "Os dados não correspondem ao candidato escolhido");
      }
      throw new PartyError(502, "IFOOD_REJECTED", error.message);
    }
    if (error instanceof IfoodMcpError && error.code === "AUTHENTICATION_REQUIRED") {
      throw new PartyError(409, "MCP_NOT_CONNECTED", "Reconecte sua conta do iFood");
    }
    throw new PartyError(503, "IFOOD_UNAVAILABLE", "Could not reach iFood right now");
  }
}

function requireAgent<K extends keyof PartyAgentIntegration>(
  agent: PartyAgentIntegration | undefined,
  feature: K,
): NonNullable<PartyAgentIntegration[K]> {
  const handler = agent?.[feature];
  if (!handler) {
    throw new PartyError(501, "FEATURE_UNAVAILABLE", `${String(feature)} is not configured`);
  }
  return (handler as Function).bind(agent) as NonNullable<PartyAgentIntegration[K]>;
}

function parseOption(value: unknown): LocalOption {
  const option = value as LocalOption | undefined;
  const valid =
    typeof option?.merchant?.id === "string" &&
    typeof option.deliveryMethodId === "string" &&
    Array.isArray(option.items) &&
    option.items.length > 0 &&
    option.items.every(
      (item) =>
        typeof item?.itemId === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        Array.isArray(item.selectedOptions) &&
        item.selectedOptions.every((selected) => typeof selected?.optionId === "string"),
    );
  if (!valid) {
    throw new PartyError(400, "INVALID_INPUT", "option must be one of the options returned by /options");
  }
  return option!;
}

function requiredText(body: Record<string, unknown>, name: string, maxLength: number): string {
  const value = body[name];
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new PartyError(400, "INVALID_INPUT", `${name} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value.trim();
}

function recordBody(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new PartyError(400, "INVALID_INPUT", "Request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function optionalText(body: Record<string, unknown>, name: string, maxLength: number): string | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new PartyError(400, "INVALID_INPUT", `${name} must be a string of at most ${maxLength} characters`);
  }
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function parseAddressResolutionRequest(body: Record<string, unknown>): { address: string } {
  return { address: requiredText(body, "address", 500) };
}

function parseCreateParticipantAddressRequest(
  body: Record<string, unknown>,
): CreateParticipantAddressRequest {
  const input: CreateParticipantAddressRequest = {
    address: requiredText(body, "address", 500),
    candidateId: requiredText(body, "candidateId", 200),
  };
  const neighborhood = optionalText(body, "neighborhood", 120);
  const alias = optionalText(body, "alias", 80);
  const complement = optionalText(body, "complement", 160);
  const reference = optionalText(body, "reference", 200);
  if (neighborhood !== undefined) input.neighborhood = neighborhood;
  if (alias !== undefined) input.alias = alias;
  if (complement !== undefined) input.complement = complement;
  if (reference !== undefined) input.reference = reference;
  return input;
}

function parseOptionsRequest(body: Record<string, unknown>, partyTheme?: string) {
  const { theme, budget, restrictions = [], addressId, maxOptions } = body ?? {};
  // O tema é o **resultado** da revelação: o da Party vence; o corpo só serve de fallback.
  const resolvedTheme =
    (partyTheme ?? "").trim() ||
    (typeof theme === "string" ? theme.trim() : "");
  if (resolvedTheme.length === 0) {
    throw new PartyError(400, "INVALID_INPUT", "theme is required");
  }
  if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) {
    throw new PartyError(400, "INVALID_INPUT", "budget must be a positive number");
  }
  if (!Array.isArray(restrictions) || restrictions.some((value) => typeof value !== "string")) {
    throw new PartyError(400, "INVALID_INPUT", "restrictions must be a list of strings");
  }
  if (addressId !== undefined && typeof addressId !== "string") {
    throw new PartyError(400, "INVALID_INPUT", "addressId must be a string");
  }
  if (
    maxOptions !== undefined &&
    (typeof maxOptions !== "number" || !Number.isInteger(maxOptions) || maxOptions < 1 || maxOptions > 5)
  ) {
    throw new PartyError(400, "INVALID_INPUT", "maxOptions must be an integer from 1 to 5");
  }
  return {
    theme: resolvedTheme,
    budget,
    restrictions: restrictions as string[],
    ...(addressId ? { addressId } : {}),
    ...(maxOptions ? { maxOptions } : {}),
  };
}

/**
 * Detalhe do `error`/`error_description` que o provedor devolve ao callback —
 * **só para o log do servidor**. A resposta ao navegador continua sanitizada.
 * Sem dados sensíveis (não inclui `code`) e com tamanho limitado.
 */
function providerErrorDetail(url: URL): string | undefined {
  const error = url.searchParams.get("error") ?? url.searchParams.get("error_code");
  if (!error) return undefined;
  const description = (url.searchParams.get("error_description") ?? "").slice(0, 200);
  return description ? `${error}: ${description}` : error;
}

async function completeOAuthCallback(
  url: URL,
  response: ServerResponse,
  service: PartyService,
  options: PartyServerOptions,
  partyId?: string,
): Promise<void> {
  const state = url.searchParams.get("state");
  const providerError = providerErrorDetail(url);
  if (!state || providerError) {
    console.warn("MCP OAuth callback problem", {
      path: url.pathname,
      hasState: Boolean(state),
      hasCode: Boolean(url.searchParams.get("code")),
      providerError: providerError ?? null,
    });
  }

  const actor = await options.oauth.complete({
    ...(partyId ? { partyId: service.get(partyId).party.id } : {}),
    code: url.searchParams.get("code") ?? "",
    state: state ?? "",
    providerError: providerError ?? undefined,
  });
  const status = options.agent?.validateConnection
    ? await options.agent.validateConnection(actor)
    : "connected";
  service.setMcpConnectionStatusForParticipant(actor.partyId, actor.participantId, status);
  const redirect = new URL(options.frontendUrl);
  redirect.searchParams.set("partyId", actor.partyId);
  redirect.searchParams.set("mcp", status);
  sendRedirect(response, redirect.toString());
}

function resolveAllowedOrigin(
  request: IncomingMessage,
  allowedOrigins: string[],
): string {
  const origin = request.headers.origin;
  if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    return origin;
  }
  return allowedOrigins[0] ?? "http://localhost:5173";
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
    Vary: "Origin",
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
  allowedOrigin: string,
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "OPTIONS") {
    sendJson(response, 204, null, allowedOrigin);
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" }, allowedOrigin);
    return;
  }

  if (method === "GET" && url.pathname === "/questionnaire") {
    const definition = getQuestionnaire(url.searchParams.get("version") ?? undefined);
    if (!definition) {
      throw new PartyError(
        404,
        "QUESTIONNAIRE_NOT_FOUND",
        "Questionnaire version not found",
      );
    }
    sendJson(response, 200, definition, allowedOrigin);
    return;
  }

  if (method === "POST" && url.pathname === "/parties") {
    const result = service.create(await readJson<CreatePartyRequest>(request));
    sendJson(response, 201, result, allowedOrigin);
    return;
  }

  const sessionRoute = url.pathname.match(/^\/parties\/([^/]+)\/session$/);
  if (sessionRoute) {
    if (method !== "GET") {
      throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
    const partyId = decodeURIComponent(sessionRoute[1]);
    const participant = service.getSession(partyId, bearerToken(request));
    sendJson(response, 200, { participant }, allowedOrigin);
    return;
  }

  const addressResolutionRoute = url.pathname.match(/^\/parties\/([^/]+)\/addresses\/resolve$/);
  if (addressResolutionRoute) {
    if (method !== "POST") {
      throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
    const partyId = decodeURIComponent(addressResolutionRoute[1]);
    const actor = service.authorizeParticipant(partyId, bearerToken(request));
    const resolveNewAddress = requireAgent(options.agent, "resolveNewAddress");
    const input = parseAddressResolutionRequest(recordBody(await readJson<unknown>(request)));
    const result: AddressResolutionResponse = await runAgent(() => resolveNewAddress(actor, input));
    sendJson(response, 200, result, allowedOrigin);
    return;
  }

  const addressesRoute = url.pathname.match(/^\/parties\/([^/]+)\/addresses$/);
  if (addressesRoute) {
    if (method !== "GET" && method !== "POST") {
      throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
    const partyId = decodeURIComponent(addressesRoute[1]);
    const actor = service.authorizeParticipant(partyId, bearerToken(request));
    if (method === "GET") {
      const listAddresses = requireAgent(options.agent, "listAddresses");
      const addresses = await runAgent(() => listAddresses(actor));
      sendJson(response, 200, { addresses }, allowedOrigin);
      return;
    }
    if (method === "POST") {
      const createAddress = requireAgent(options.agent, "createParticipantAddress");
      const input = parseCreateParticipantAddressRequest(
        recordBody(await readJson<unknown>(request)),
      );
      const result = await runAgent(() => createAddress(actor, input));
      sendJson(response, result.alreadyExists ? 200 : 201, result, allowedOrigin);
      return;
    }
    throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  if (url.pathname === (options.callbackPath ?? DEFAULT_CALLBACK_PATH)) {
    if (method !== "GET") {
      throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
    await completeOAuthCallback(url, response, service, options);
    return;
  }

  const optionsRoute = url.pathname.match(/^\/parties\/([^/]+)\/options$/);
  if (optionsRoute) {
    if (method !== "POST") {
      throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
    const partyId = decodeURIComponent(optionsRoute[1]);
    const actor = service.authorizeParticipant(partyId, bearerToken(request));
    if (!options.agent) {
      throw new PartyError(501, "OPTIONS_UNAVAILABLE", "Local options are not configured");
    }
    const input = parseOptionsRequest(
      await readJson<Record<string, unknown>>(request),
      service.get(partyId).party.theme,
    );
    const agent = options.agent;
    const output = await runAgent(() => agent.resolveOptions(actor, input));
    service.setOrderProgressForParticipant(actor.partyId, actor.participantId, {
      orderStage: "options_ready",
    });
    sendJson(response, 200, output, allowedOrigin);
    return;
  }

  const checkoutRoute = url.pathname.match(/^\/parties\/([^/]+)\/(cart|order)(?:\/([^/]+))?$/);
  if (checkoutRoute) {
    const partyId = decodeURIComponent(checkoutRoute[1]);
    const resource = checkoutRoute[2];
    const orderId = checkoutRoute[3] ? decodeURIComponent(checkoutRoute[3]) : undefined;
    const actor = service.authorizeParticipant(partyId, bearerToken(request));

    if (resource === "cart" && method === "POST" && !orderId) {
      const body = await readJson<{ option?: unknown; addressId?: unknown }>(request);
      const option = parseOption(body.option);
      if (body.addressId !== undefined && typeof body.addressId !== "string") {
        throw new PartyError(400, "INVALID_INPUT", "addressId must be a string");
      }
      const prepare = requireAgent(options.agent, "prepareCart");
      const { participantCoordinates, ...cart } = await runAgent(() =>
        prepare(actor, {
          option,
          ...(typeof body.addressId === "string" ? { addressId: body.addressId } : {}),
        }),
      );
      service.recordCartSummaryForParticipant(actor.partyId, actor.participantId, {
        merchantId: option.merchant.id,
        itemCount: option.items.reduce((count, item) => count + item.quantity, 0),
        ...(participantCoordinates ? { coordinates: participantCoordinates } : {}),
      });
      service.setOrderProgressForParticipant(actor.partyId, actor.participantId, {
        orderStage: "cart_created",
      });
      sendJson(response, 200, cart, allowedOrigin);
      return;
    }

    if (resource === "order" && method === "POST" && !orderId) {
      const body = await readJson<{ cartId?: unknown; userConsent?: unknown }>(request);
      if (typeof body.cartId !== "string" || body.cartId.trim() === "") {
        throw new PartyError(400, "INVALID_INPUT", "cartId is required");
      }
      const submit = requireAgent(options.agent, "submitOrder");
      const order = await runAgent(() =>
        submit(actor, { cartId: body.cartId as string, userConsent: body.userConsent === true }),
      );
      service.setOrderProgressForParticipant(actor.partyId, actor.participantId, {
        orderStage: "order_submitted",
        orderId: order.orderId,
      });
      sendJson(response, 201, order, allowedOrigin);
      return;
    }

    if (resource === "order" && method === "GET" && orderId) {
      const track = requireAgent(options.agent, "trackOrder");
      const tracking = await runAgent(() => track(actor, orderId));
      const concluded = tracking.statusCode === "CONCLUDED";
      service.setOrderProgressForParticipant(actor.partyId, actor.participantId, {
        orderId: tracking.orderId,
        orderStatus: tracking.statusCode,
        ...(concluded ? { orderStage: "delivered" as const } : {}),
      });
      sendJson(response, 200, tracking, allowedOrigin);
      return;
    }

    throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  const retrospectiveRoute = url.pathname.match(/^\/parties\/([^/]+)\/retrospective$/);
  if (retrospectiveRoute) {
    if (method !== "GET") {
      throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
    const partyId = decodeURIComponent(retrospectiveRoute[1]);
    const result = service.getRetrospective(partyId, bearerToken(request));
    sendJson(response, 200, result, allowedOrigin);
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
      sendJson(response, 200, authorization, allowedOrigin);
      return;
    }

    // Rota antiga, mantida por compatibilidade; o callback cadastrado no iFood é o único.
    if (method === "GET" && action === "callback") {
      await completeOAuthCallback(url, response, service, options, partyId);
      return;
    }

    throw new PartyError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  const route = url.pathname.match(
    /^\/parties\/([^/]+)(?:\/(join|close|answers|reveal))?$/,
  );
  if (!route) {
    throw new PartyError(404, "ROUTE_NOT_FOUND", "Route not found");
  }

  const partyId = decodeURIComponent(route[1]);
  const action = route[2];
  if (method === "GET" && !action) {
    sendJson(response, 200, service.get(partyId), allowedOrigin);
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
        allowedOrigin,
      );
      return;
    case "close":
      sendJson(
        response,
        200,
        service.closeMembership(partyId, bearerToken(request)),
        allowedOrigin,
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
        allowedOrigin,
      );
      return;
    case "reveal":
      sendJson(
        response,
        200,
        service.revealTheme(partyId, bearerToken(request)),
        allowedOrigin,
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
  const allowedOrigin = resolveAllowedOrigin(request, options.allowedOrigins);
  try {
    await routeRequest(request, response, service, options, allowedOrigin);
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
      sendJson(response, 400, body, allowedOrigin);
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
      sendJson(response, error.statusCode, body, allowedOrigin);
      return;
    }

    console.error("Unhandled request error", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    sendJson(
      response,
      500,
      { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } } satisfies ApiErrorBody,
      allowedOrigin,
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
 * `demo` usa tokens sintéticos. `ifood` usa o provider real e exige a configuração do agente
 * (`IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET` e a redirect); sem ela, recusamos subir.
 */
export function resolveMcpOAuthMode(
  raw: string | undefined,
  env: Record<string, string | undefined> = process.env,
): McpOAuthMode {
  const value = (raw ?? "demo").trim().toLowerCase();
  if (value === "demo") return "demo";
  if (value === "ifood") {
    loadIfoodConfig(env);
    return "ifood";
  }
  throw new Error(`MCP_OAUTH_MODE inválido: ${raw}`);
}

if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 3333);
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const frontendUrl = process.env.FRONTEND_URL ?? allowedOrigins[0] ?? "http://localhost:5173";
  const publicApiUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${port}`;
  const oauthMode = resolveMcpOAuthMode(process.env.MCP_OAUTH_MODE);
  const service = new PartyService(new PartyStore(), new ParticipantAccessStore());
  const sessions = new McpSessionRegistry();
  const env = { ...process.env, PUBLIC_API_URL: publicApiUrl };
  const provider: McpOAuthProvider =
    oauthMode === "ifood" ? createIfoodProvider(env) : new DemoMcpOAuthProvider(publicApiUrl);
  const oauth = new McpOAuthFlow(provider, sessions);
  const ifoodConfig = oauthMode === "ifood" ? loadIfoodConfig(env) : undefined;
  const llmConfig = oauthMode === "ifood" ? loadOpenCodeConfig(env) : undefined;
  const agent = ifoodConfig
    ? createIfoodIntegration({
        sessions,
        provider,
        mcpUrl: ifoodConfig.mcpUrl,
        ...(llmConfig ? { llm: { client: new OpenCodeClient({ config: llmConfig }) } } : {}),
      })
    : createDemoIntegration();
  const callbackPath = ifoodConfig
    ? new URL(ifoodConfig.redirectUri).pathname
    : DEFAULT_CALLBACK_PATH;
  const server = createPartyServer(service, {
    allowedOrigins,
    frontendUrl,
    oauth,
    agent,
    callbackPath,
  });

  server.listen(port, () => {
    console.log(`SideQuest Party API listening on http://localhost:${port}`);
    console.log(`MCP OAuth callback: ${ifoodConfig?.redirectUri ?? publicApiUrl + callbackPath}`);
    if (oauthMode === "demo") {
      console.warn(
        "MCP OAuth em MODO DEMONSTRAÇÃO: os tokens são sintéticos e nenhuma conta real do iFood é conectada.",
      );
    } else {
      console.log(
        llmConfig
          ? `Planner LLM ligado (modelo ${llmConfig.model}).`
          : "Planner LLM desligado (sem OPENCODE_API_KEY): usando o pipeline determinístico.",
      );
    }
  });
}
