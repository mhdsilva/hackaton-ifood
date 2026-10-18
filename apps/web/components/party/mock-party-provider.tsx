"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { canStartMockParty, getMockAddresses, getMockPartySession } from "@/lib/mock-party";
import { getMockPreferenceQuestion, MAX_MOCK_DESIRES, parseMockBudget, toggleMockDesire, type BudgetOptionId, type RestrictionId, type PreferenceQuestionId, type DesireId, type ExclusionId } from "@/lib/mock-questionnaire";

function useMockPartyState() {
  const [session, setSession] = useState(getMockPartySession);
  const { snapshot, currentParticipantId, inviteCode } = session;
  const [addresses] = useState(getMockAddresses);
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

  const enterParty = useCallback((code: string | null) => {
    setSession((current) => current.inviteCode === code ? current : getMockPartySession(code));
  }, []);

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
    setCompletedParticipantIds((current) => current.includes(currentParticipantId) ? current : [...current, currentParticipantId]);
    return true;
  }

  function startParty() {
    setSession((current) => {
      if (!canStartMockParty(current.snapshot, current.currentParticipantId)) return current;
      return { ...current, snapshot: { ...current.snapshot, party: { ...current.snapshot.party, status: "COLLECTING_ANSWERS", membershipLocked: true } } };
    });
  }

  return { snapshot, currentParticipantId, inviteCode, enterParty, addresses, selectedAddressId, setSelectedAddressId, startParty,
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
