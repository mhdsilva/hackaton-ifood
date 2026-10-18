"use client";

import { createContext, useContext, useState } from "react";
import { canStartMockParty, getMockAddresses, getMockParty } from "@/lib/mock-party";
import type { BudgetOptionId, RestrictionId } from "@/lib/mock-questionnaire";

function useMockPartyState() {
  const [snapshot, setSnapshot] = useState(getMockParty);
  const [addresses] = useState(getMockAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses[0]?.id ?? null);
  const currentParticipantId = snapshot.party.hostParticipantId;
  const [restrictions, setRestrictions] = useState<RestrictionId[]>([]);
  const [otherRestriction, setOtherRestriction] = useState("");
  const [budgetOptionId, setBudgetOptionId] = useState<BudgetOptionId | null>(null);
  const [customBudget, setCustomBudget] = useState("");

  function toggleRestriction(id: RestrictionId) {
    setRestrictions((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function startParty() {
    if (!canStartMockParty(snapshot, currentParticipantId)) return;
    setSnapshot({ ...snapshot, party: { ...snapshot.party, status: "COLLECTING_ANSWERS", membershipLocked: true } });
  }

  return { snapshot, currentParticipantId, addresses, selectedAddressId, setSelectedAddressId, startParty,
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
