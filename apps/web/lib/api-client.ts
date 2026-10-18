/**
 * Cliente da API real, compartilhado entre `app/test` (ponta a ponta manual) e
 * as telas de produto (`components/party/live-party-provider.tsx`).
 */
import type {
  AddressResolutionResponse,
  ApiErrorBody,
  CreateParticipantAddressRequest,
  CreateParticipantAddressResponse,
  CreatePartyRequest,
  JoinPartyRequest,
  McpAuthorizationResponse,
  Participant,
  ParticipantAddressesResponse,
  PartyRetrospectiveResponse,
  PartySessionResponse,
  PartySnapshot,
  QuestionnaireDefinition,
  ResolveOptionsOutput,
  SubmitAnswersRequest,
} from "@sidequest/contracts";
import type { LocalOption } from "@sidequest/contracts";

export interface CartResponse {
  cartId: string;
  merchantId: string;
  deliveryMethodId: string;
  paymentMethod: string;
  total?: number;
  simulated: boolean;
  checkoutSimulated?: boolean;
}

export interface OrderResponse {
  orderId: string;
  simulated: boolean;
}

export interface OrderTrackingResponse {
  orderId: string;
  statusCode: string;
  description: string;
  retryAfterSeconds?: number;
  terminal: boolean;
  simulated: boolean;
}

/** `?api=` na URL vence; depois `NEXT_PUBLIC_API_URL`; senão, prod (ou local no dev). */
export function apiBase(): string {
  if (typeof window === "undefined") return "https://api-ifood.kairootech.com.br";
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  if (fromQuery) return fromQuery.replace(/\/+$/, "");
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1"
    ? "http://localhost:3333"
    : "https://api-ifood.kairootech.com.br";
}

export class LiveApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LiveApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<T> {
  const response = await fetch(apiBase() + path, {
    method,
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (json as ApiErrorBody | null)?.error;
    throw new LiveApiError(
      response.status,
      error?.code ?? "LIVE_API_ERROR",
      error?.message ?? response.statusText,
      error?.details,
    );
  }
  return json as T;
}

export interface OptionsInput {
  budget: number;
  theme?: string;
  restrictions?: string[];
  addressId?: string;
  maxOptions?: number;
}

export const liveApi = {
  createParty: (body: CreatePartyRequest) =>
    request<PartySessionResponse>("POST", "/parties", { body }),

  joinParty: (codeOrId: string, body: JoinPartyRequest) =>
    request<PartySessionResponse>("POST", `/parties/${encodeURIComponent(codeOrId)}/join`, { body }),

  getParty: (codeOrId: string, token?: string) =>
    request<PartySnapshot>("GET", `/parties/${encodeURIComponent(codeOrId)}`, { token }),

  getSession: (codeOrId: string, token: string) =>
    request<{ participant: Participant }>(
      "GET",
      `/parties/${encodeURIComponent(codeOrId)}/session`,
      { token },
    ),

  closeParty: (codeOrId: string, token: string) =>
    request<PartySnapshot>("POST", `/parties/${encodeURIComponent(codeOrId)}/close`, { token }),

  submitAnswers: (codeOrId: string, token: string, body: SubmitAnswersRequest) =>
    request<PartySnapshot>("POST", `/parties/${encodeURIComponent(codeOrId)}/answers`, {
      body,
      token,
    }),

  reveal: (codeOrId: string, token: string) =>
    request<PartySnapshot>("POST", `/parties/${encodeURIComponent(codeOrId)}/reveal`, { token }),

  authorizeMcp: (codeOrId: string, token: string) =>
    request<McpAuthorizationResponse>(
      "POST",
      `/parties/${encodeURIComponent(codeOrId)}/mcp-connection/authorize`,
      { token },
    ),

  /** Endereços salvos na conta do iFood do próprio participante (409 se não conectado). */
  getAddresses: (codeOrId: string, token: string) =>
    request<ParticipantAddressesResponse>(
      "GET",
      `/parties/${encodeURIComponent(codeOrId)}/addresses`,
      { token },
    ),

  /** Busca candidatos no iFood para um endereço digitado (`matchConfidence` diz se é único). */
  resolveAddress: (codeOrId: string, token: string, body: { address: string }) =>
    request<AddressResolutionResponse>(
      "POST",
      `/parties/${encodeURIComponent(codeOrId)}/addresses/resolve`,
      { body, token },
    ),

  createAddress: (codeOrId: string, token: string, body: CreateParticipantAddressRequest) =>
    request<CreateParticipantAddressResponse>(
      "POST",
      `/parties/${encodeURIComponent(codeOrId)}/addresses`,
      { body, token },
    ),

  getQuestionnaire: (version?: string) =>
    request<QuestionnaireDefinition>(
      "GET",
      version ? `/questionnaire?version=${encodeURIComponent(version)}` : "/questionnaire",
    ),

  getOptions: (codeOrId: string, token: string, body: OptionsInput) =>
    request<ResolveOptionsOutput>(
      "POST",
      `/parties/${encodeURIComponent(codeOrId)}/options`,
      { body, token },
    ),

  createCart: (codeOrId: string, token: string, body: { option: LocalOption; addressId?: string }) =>
    request<CartResponse>("POST", `/parties/${encodeURIComponent(codeOrId)}/cart`, { body, token }),

  submitOrder: (codeOrId: string, token: string, body: { cartId: string; userConsent: boolean }) =>
    request<OrderResponse>("POST", `/parties/${encodeURIComponent(codeOrId)}/order`, { body, token }),

  trackOrder: (codeOrId: string, token: string, orderId: string) =>
    request<OrderTrackingResponse>(
      "GET",
      `/parties/${encodeURIComponent(codeOrId)}/order/${encodeURIComponent(orderId)}`,
      { token },
    ),

  getRetrospective: (codeOrId: string, token: string) =>
    request<PartyRetrospectiveResponse>(
      "GET",
      `/parties/${encodeURIComponent(codeOrId)}/retrospective`,
      { token },
    ),
};

/** Mensagem curta e legível para mostrar na tela de teste. */
export function describeError(error: unknown): string {
  if (error instanceof LiveApiError) {
    const details = error.details ? ` ${JSON.stringify(error.details)}` : "";
    return `${error.status} ${error.code}: ${error.message}${details}`;
  }
  return error instanceof Error ? error.message : String(error);
}
