export const PARTY_STATUSES = [
  "OPEN",
  "COLLECTING_ANSWERS",
  "READY_FOR_THEME",
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
  completed: true;
  submittedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  questionnaireResponse: QuestionnaireResponse | null;
  mcpConnectionStatus: McpConnectionStatus;
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
  completed: true;
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
