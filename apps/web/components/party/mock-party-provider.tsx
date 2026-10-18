"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { canStartMockParty, getMockAddresses, getMockPartySession } from "@/lib/mock-party";
import type { BudgetOptionId, RestrictionId } from "@/lib/mock-questionnaire";

function useMockPartyState() {
  const [session, setSession] = useState(getMockPartySession);
  const { snapshot, currentParticipantId, inviteCode } = session;
  const [addresses] = useState(getMockAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses[0]?.id ?? null);
  const [restrictions, setRestrictions] = useState<RestrictionId[]>([]);
  const [otherRestriction, setOtherRestriction] = useState("");
  const [budgetOptionId, setBudgetOptionId] = useState<BudgetOptionId | null>(null);
  const [customBudget, setCustomBudget] = useState("");

  const enterParty = useCallback((code: string | null) => {
    setSession((current) => current.inviteCode === code ? current : getMockPartySession(code));
  }, []);

  function toggleRestriction(id: RestrictionId) {
    setRestrictions((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function startParty() {
    setSession((current) => {
      if (!canStartMockParty(current.snapshot, current.currentParticipantId)) return current;
      return { ...current, snapshot: { ...current.snapshot, party: { ...current.snapshot.party, status: "COLLECTING_ANSWERS", membershipLocked: true } } };
    });
  }

  return { snapshot, currentParticipantId, inviteCode, enterParty, addresses, selectedAddressId, setSelectedAddressId, startParty,
    restrictions, toggleRestriction, otherRestriction, setOtherRestriction,
    budgetOptionId, setBudgetOptionId, customBudget, setCustomBudget };
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
