"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CreateParticipantAddressRequest, LocalOption } from "@sidequest/contracts";
import type { CartResponse } from "@/lib/api-client";
import { getMockOrderOptions } from "@/lib/mock-reveal";
import { getMockRetrospective, type RetrospectivePreview } from "@/lib/mock-retrospective";
import { canStartMockParty, getMockAddresses, getMockPartySession } from "@/lib/mock-party";
import { getMockPreferenceQuestion, MAX_MOCK_DESIRES, parseMockBudget, toggleMockDesire, type BudgetOptionId, type RestrictionId, type PreferenceQuestionId, type DesireId, type ExclusionId } from "@/lib/mock-questionnaire";

function useMockPartyState() {
  const [session, setSession] = useState(getMockPartySession);
  const { snapshot, currentParticipantId, inviteCode, authenticatedPreview } = session;
  const [authenticating, setAuthenticating] = useState<{ participantId: string; code: string } | null>(null);
  const [addresses, setAddresses] = useState(getMockAddresses);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses[0]?.id ?? null);
  const [restrictions, setRestrictions] = useState<RestrictionId[]>([]);
  const [otherRestriction, setOtherRestriction] = useState("");
  const [budgetOptionId, setBudgetOptionId] = useState<BudgetOptionId | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [preferences, setPreferences] = useState<Record<PreferenceQuestionId, string | null>>({ energy: null, "order-style": null });
  const [desires, setDesires] = useState<DesireId[]>([]);
  const [exclusions, setExclusions] = useState<ExclusionId[]>([]);
  const [otherExclusion, setOtherExclusion] = useState("");
  const [completedParticipantIds, setCompletedParticipantIds] = useState<string[]>([]);

  const hasRequiredAnswers = selectedAddressId !== null &&
    (!restrictions.includes("other") || otherRestriction.trim().length > 0) &&
    budgetOptionId !== null && (budgetOptionId !== "other" || parseMockBudget(customBudget) !== null) &&
    preferences.energy !== null && preferences["order-style"] !== null &&
    desires.length >= 1 && desires.length <= MAX_MOCK_DESIRES;
  const canCompleteQuestionnaire = hasRequiredAnswers && (!exclusions.includes("outro") || otherExclusion.trim().length > 0);

  const enterParty = useCallback((code: string | null, authenticated = false) => {
    setSession((current) => current.inviteCode === code && current.authenticatedPreview === authenticated ? current : getMockPartySession(code, authenticated));
  }, []);

  // Apenas a prévia local simula o retorno do login; o modo real usa o OAuth do iFood.
  useEffect(() => {
    if (!authenticating) return;
    const timer = window.setTimeout(() => {
      setSession((current) => current.currentParticipantId !== authenticating.participantId || current.snapshot.party.code !== authenticating.code ? current : {
        ...current,
        snapshot: { ...current.snapshot, participants: current.snapshot.participants.map((participant) => participant.id === authenticating.participantId ? { ...participant, mcpConnectionStatus: "connected" } : participant) },
      });
      setAuthenticating(null);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [authenticating]);

  async function connectMcp(): Promise<void> {
    if (authenticating) return;
    setSession((current) => ({ ...current, snapshot: { ...current.snapshot, participants: current.snapshot.participants.map((participant) => participant.id === current.currentParticipantId ? { ...participant, mcpConnectionStatus: "validating" } : participant) } }));
    setAuthenticating({ participantId: currentParticipantId, code: snapshot.party.code });
  }

  function toggleRestriction(id: RestrictionId) {
    setRestrictions((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function selectPreference(id: PreferenceQuestionId, value: string) {
    if (getMockPreferenceQuestion(id).options.some((option) => option.id === value)) {
      setPreferences((current) => ({ ...current, [id]: value }));
    }
  }

  function toggleDesire(id: DesireId) {
    setDesires((current) => toggleMockDesire(current, id));
  }

  function toggleExclusion(id: ExclusionId) {
    setExclusions((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function completeQuestionnaire() {
    if (!canCompleteQuestionnaire) return false;
    setCompletedParticipantIds(snapshot.participants.map((participant) => participant.id));
    return true;
  }

  async function revealTheme() {
    setSession((current) => ({ ...current, snapshot: { ...current.snapshot, party: { ...current.snapshot.party, status: "THEME_REVEALED" } } }));
    return true;
  }

  async function prepareOrderCart(option: LocalOption): Promise<CartResponse> {
    const next: CartResponse = { cartId: "mock-cart", merchantId: option.merchant.id, deliveryMethodId: option.deliveryMethodId, paymentMethod: "Pix", total: option.total, simulated: true, checkoutSimulated: true };
    setCart(next);
    setSession((current) => ({ ...current, snapshot: { ...current.snapshot, participants: current.snapshot.participants.map((person) => person.id === current.currentParticipantId ? { ...person, orderStage: "cart_created" } : person) } }));
    return next;
  }

  async function submitPartyOrder() {
    setSession((current) => ({ ...current, snapshot: { ...current.snapshot, participants: current.snapshot.participants.map((person) => person.id === current.currentParticipantId ? { ...person, orderStage: "order_submitted", orderId: "mock-order" } : person) } }));
    return { orderId: "mock-order", simulated: true };
  }

  async function findAddressCandidates(address: string) {
    return { matchConfidence: "SINGLE" as const, candidates: [{ candidateId: "mock-candidate", formattedAddress: address }], simulated: true };
  }

  async function saveAddress(input: CreateParticipantAddressRequest) {
    const id = `mock-address-${addresses.length + 1}`;
    setAddresses((current) => [...current, { id, label: input.alias || input.address, formattedAddress: input.address, complement: input.complement, reference: input.reference }]);
    setSelectedAddressId(id);
    return true;
  }

  const loadRetrospective = useCallback(async (preview?: RetrospectivePreview) => getMockRetrospective(snapshot, preview), [snapshot]);
  const resolveOrderOptions = useCallback(async () => getMockOrderOptions(), []);
  const trackPartyOrder = useCallback(async () => ({ orderId: "mock-order", statusCode: "CONCLUDED", description: "Pedido concluído", terminal: true, simulated: true }), []);

  function startParty() {
    if (!canStartMockParty(snapshot, currentParticipantId)) return false;
    setSession((current) => ({ ...current, snapshot: { ...current.snapshot, party: { ...current.snapshot.party, status: "COLLECTING_ANSWERS", membershipLocked: true } } }));
    return true;
  }

  return { snapshot, currentParticipantId, inviteCode, authenticatedPreview, enterParty, connectMcp, connectingMcp: authenticating !== null, addresses, selectedAddressId, setSelectedAddressId, startParty,
    revealTheme, cart, prepareOrderCart, submitPartyOrder, findAddressCandidates, saveAddress, loadRetrospective, resolveOrderOptions, trackPartyOrder,
    restrictions, toggleRestriction, otherRestriction, setOtherRestriction,
    budgetOptionId, setBudgetOptionId, customBudget, setCustomBudget,
    preferences, selectPreference, desires, toggleDesire, exclusions, toggleExclusion, otherExclusion, setOtherExclusion,
    hasRequiredAnswers, canCompleteQuestionnaire, completeQuestionnaire, completedParticipantIds };
}

const MockPartyContext = createContext<ReturnType<typeof useMockPartyState> | null>(null);

export function MockPartyProvider({ children }: { children: React.ReactNode }) {
  const value = useMockPartyState();
  return <MockPartyContext.Provider value={value}>{children}</MockPartyContext.Provider>;
}

export function useMockParty() {
  const context = useContext(MockPartyContext);
  if (!context) throw new Error("useMockParty requires MockPartyProvider");
  return context;
}
