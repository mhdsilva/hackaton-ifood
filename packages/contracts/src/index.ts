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
}

export interface PartyInfo {
  id: string;
  code: string;
  name: string;
  status: PartyStatus;
  hostParticipantId: string;
  membershipLocked: boolean;
  createdAt: string;
}

export interface PartySnapshot {
  party: PartyInfo;
  participants: Participant[];
}

export interface ParticipantIdentity {
  id: string;
  name: string;
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

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
