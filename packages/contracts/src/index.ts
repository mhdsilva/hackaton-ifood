export const PARTY_STATUSES = [
  "OPEN",
  "COLLECTING_ANSWERS",
  "READY_FOR_THEME",
  "THEME_REVEALED",
] as const;

export type PartyStatus = (typeof PARTY_STATUSES)[number];

export const MCP_CONNECTION_STATUSES = [
  "not_connected",
  "validating",
  "connected",
  "error",
] as const;

export type McpConnectionStatus = (typeof MCP_CONNECTION_STATUSES)[number];

export interface QuestionnaireResponse {
  questionnaireVersion: string;
  answers: Record<string, unknown>;
  completed: boolean;
  submittedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  questionnaireResponse: QuestionnaireResponse | null;
  mcpConnectionStatus: McpConnectionStatus;
  /**
   * Quantas perguntas da definição o participante já respondeu (progresso da
   * Etapa X de 8). O servidor sempre envia; opcional para dados legados/mocks.
   */
  answeredCount?: number;
  /** Estágio do participante depois de `READY_FOR_THEME` (opções, carrinho, pedido). */
  orderStage?: PartyOrderStage;
  /** Id do pedido do participante, quando já submetido. */
  orderId?: string;
  /** Último `status.code` do `trackOrder` do iFood, quando houver. */
  orderStatus?: string;
}

/** Progresso individual após a revelação: opções → carrinho → pedido → entrega. */
export type PartyOrderStage =
  | "none"
  | "options_ready"
  | "cart_created"
  | "order_submitted"
  | "delivered";

export interface PartyInfo {
  id: string;
  code: string;
  name: string;
  status: PartyStatus;
  hostParticipantId: string;
  membershipLocked: boolean;
  createdAt: string;
  /** Tema livre escolhido pelo agente, gravado quando o host revela o resultado. */
  theme?: string;
  /** Termos de busca escolhidos pelo agente junto com o tema. */
  themeQueries?: string[];
  /** Por que o agente escolheu esse tema (uma frase), quando a revelação usou LLM. */
  themeReason?: string;
}

export interface PartySnapshot {
  party: PartyInfo;
  participants: Participant[];
}

/** Endereço do participante projetado para seleção no cliente, sem coordenadas ou endereço completo. */
export interface ParticipantAddress {
  addressId: string;
  label: string;
  isLastUsedAddress: boolean;
}

export interface ParticipantAddressesResponse {
  addresses: ParticipantAddress[];
}

export interface AddressCandidate {
  candidateId: string;
  formattedAddress: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface AddressResolutionResponse {
  matchConfidence: "NONE" | "SINGLE" | "MULTIPLE";
  candidates: AddressCandidate[];
  simulated: boolean;
}

export interface CreateParticipantAddressRequest {
  address: string;
  candidateId: string;
  neighborhood?: string;
  alias?: string;
  complement?: string;
  reference?: string;
}

export interface CreateParticipantAddressResponse {
  address: ParticipantAddress;
  alreadyExists: boolean;
  simulated: boolean;
}

export interface PartyRetrospectiveSummary {
  partyName: string;
  theme?: string;
  participantCount: number;
  completedOrderCount: number;
  /** Soma das quantidades nas opções usadas para preparar os carrinhos. */
  itemCount: number;
  merchantCount: number;
  /** Maior distância aproximada em linha reta entre os endereços escolhidos. */
  maxDistanceKm?: number;
}

export interface PartyRetrospectiveResponse {
  state: "waiting_for_deliveries" | "ready";
  pendingDeliveryCount: number;
  summary?: PartyRetrospectiveSummary;
}

export interface ParticipantIdentity {
  id: string;
  /**
   * Opcional: o servidor usa um rótulo provisório ("Anfitrião"/"Convidado N") e o substitui
   * pelo nome do `getUser` do iFood quando a conexão MCP é validada. O front não pergunta nome.
   */
  name?: string;
}

export interface CreatePartyRequest {
  name: string;
  host: ParticipantIdentity;
}

export interface JoinPartyRequest {
  participant: ParticipantIdentity;
}

export interface SubmitAnswersRequest {
  questionnaireVersion: string;
  answers: Record<string, unknown>;
  /** `true` conclui o questionário; `false` salva um rascunho (progresso incremental). */
  completed: boolean;
}

export interface PartySessionResponse {
  party: PartySnapshot;
  participantToken: string;
}

export interface McpAuthorizationResponse {
  authorizationUrl: string;
  status: "validating";
  mode: "demo" | "ifood";
}

export type QuestionnaireQuestionType =
  | "text"
  | "address"
  | "single_choice"
  | "multi_choice"
  | "scale";

export interface QuestionnaireQuestionOption {
  id: string;
  label: string;
  /** Significado numérico da opção (ex.: faixa de orçamento `ate-25` → 25). */
  value?: number;
}

export interface QuestionnaireTextInput {
  label: string;
  placeholder: string;
}

export interface QuestionnaireCustomInput {
  label: string;
  placeholder: string;
  min: number;
  max: number;
}

export interface QuestionnaireQuestion {
  id: string;
  type: QuestionnaireQuestionType;
  label: string;
  required: boolean;
  helpText?: string;
  options?: QuestionnaireQuestionOption[];
  min?: number;
  max?: number;
  /** `multi_choice`: teto de seleções (ex.: Etapa 6 = 2). */
  maxSelections?: number;
  /** Abre um campo de texto quando a opção `otherOptionId` é escolhida. */
  allowOther?: boolean;
  /** Id da opção "Outro"; padrão `outro`. */
  otherOptionId?: string;
  /** Rótulo e placeholder do campo de texto do "Outro". */
  otherInput?: QuestionnaireTextInput;
  /** `single_choice`: "Outro valor" digitado, validado por faixa. */
  customInput?: QuestionnaireCustomInput;
}

export interface QuestionnaireDefinition {
  version: string;
  title: string;
  introduction?: string;
  questions: QuestionnaireQuestion[];
}

// Contrato do agente de opções locais (`POST /parties/:id/options`), usado pelo
// carrinho (`POST /parties/:id/cart`). Movido de apps/api/src/agent/types.ts.

export interface SelectedOption {
  optionGroupId: string;
  optionId: string;
  name: string;
  additionalPrice: number;
}

export interface ResolvedItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Escolhas obrigatórias já feitas, prontas para `createCart`. */
  selectedOptions: SelectedOption[];
}

export interface LocalOption {
  merchant: {
    id: string;
    name: string;
    distanceKm: number;
    rating?: number;
  };
  items: ResolvedItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  minimumOrderAmount: number;
  deliveryMethodId: string;
  estimatedDeliveryMinutes: { min: number; max: number };
}

export interface ResolveOptionsInput {
  participantId: string;
  theme: string;
  /** Termos definidos pelo agente do tema; quando presentes, guiam todas as buscas. */
  queries?: string[];
  /** Orçamento total do participante, incluindo frete (BRL). */
  budget: number;
  restrictions: string[];
  /** Obrigatório quando a conta tem mais de um endereço salvo. */
  addressId?: string;
  maxOptions?: number;
}

export interface ResolveOptionsOutput {
  participantId: string;
  source: "live" | "simulated";
  theme: string;
  options: LocalOption[];
  warnings: string[];
}

/**
 * Texto livre do "Outro" e valor digitado do "Outro valor" ficam em chaves
 * companheiras, para manter `answers` como mapa plano:
 *   answers[`${questionId}__other`] -> string
 *   answers[`${questionId}__value`] -> number
 * Convenção compartilhada entre a validação da API e quem monta o envelope no frontend.
 */
export const OTHER_ANSWER_SUFFIX = "__other";
export const VALUE_ANSWER_SUFFIX = "__value";

export function otherAnswerKey(questionId: string): string {
  return `${questionId}${OTHER_ANSWER_SUFFIX}`;
}

export function valueAnswerKey(questionId: string): string {
  return `${questionId}${VALUE_ANSWER_SUFFIX}`;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
