export const PARTY_STATUSES = [
  "LOBBY",
  "COLLECTING_ANSWERS",
  "PLANNING",
  "REVIEWING_CARTS",
  "ORDERING",
  "WAITING_DELIVERIES",
  "READY_TO_PLAY",
  "PLAYING",
  "COMPLETED",
] as const;

export type PartyStatus = (typeof PARTY_STATUSES)[number];

export const CART_STATUSES = [
  "pending",
  "resolving",
  "ready",
  "confirmed",
  "failed",
] as const;

export type CartStatus = (typeof CART_STATUSES)[number];

export const ORDER_STATUSES = [
  "submitted",
  "confirmed",
  "preparing",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PartyMode = "competitive" | "cooperative" | "conversation";
export type SurpriseLevel = "safe" | "curious" | "chaotic";
export type ProductCategory = "restaurant" | "market" | "sweets_and_drinks" | "surprise";

export interface QuestionnaireAnswers {
  budget: number;
  restrictions: string[];
  category: ProductCategory;
  surpriseLevel: SurpriseLevel;
  vibe: PartyMode | "discover" | "improvise";
}

export interface Mission {
  name: string;
  mode: PartyMode;
  roles: string[];
}

export interface ResolvedKitItem {
  role: string;
  itemId: string;
  name: string;
  price: number;
}

export interface ResolvedKit {
  merchant: {
    id: string;
    name: string;
  };
  items: ResolvedKitItem[];
  total: number;
  estimatedDeliveryMinutes: number;
}

export type ResolveKitInput = Pick<QuestionnaireAnswers, "budget" | "restrictions"> & {
  roles: string[];
};

export type ResolveKitOutput = ResolvedKit;

export interface Participant {
  id: string;
  name: string;
  budget: number | null;
  restrictions: string[];
  answers?: QuestionnaireAnswers;
  cartStatus: CartStatus;
  orderStatus: OrderStatus | null;
  total: number | null;
  etaMinutes: number | null;
  kit?: ResolvedKit;
}

export interface PartyInfo {
  id: string;
  code: string;
  name: string;
  status: PartyStatus;
  hostParticipantId?: string;
  createdAt?: string;
}

export interface PartySnapshot {
  party: PartyInfo;
  participants: Participant[];
  mission: Mission | null;
}

export interface CreatePartyRequest {
  name: string;
  host: {
    id: string;
    name: string;
  };
}

export interface JoinPartyRequest {
  participant: {
    id: string;
    name: string;
  };
}

export interface SaveAnswersRequest {
  participantId: string;
  answers: QuestionnaireAnswers;
}

export interface PlanPartyRequest {
  mission: Mission;
  kits: Array<{
    participantId: string;
    kit: ResolvedKit;
  }>;
}

export interface SetReadyRequest {
  participantId: string;
  ready: boolean;
}

export interface SetOrderStatusRequest {
  participantId: string;
  status: OrderStatus;
}

export interface AdvancePartyRequest {
  targetStatus?: PartyStatus;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
