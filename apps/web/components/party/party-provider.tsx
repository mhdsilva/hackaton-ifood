"use client";

import { createContext, Suspense, useContext, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { LivePartyProvider, useParty as useLiveParty, type LivePartyValue } from "@/components/party/live-party-provider";
import { MockPartyProvider, useMockParty } from "@/components/party/mock-party-provider";
import { getMockBudgetOptions, getMockDesireOptions, getMockExclusionOptions, getMockPreferenceQuestion, getMockRestrictionOptions } from "@/lib/mock-questionnaire";

type PartyValue = LivePartyValue & { isMock: boolean };
const PartyContext = createContext<PartyValue | null>(null);

export function useParty(): PartyValue {
  const value = useContext(PartyContext);
  if (!value) throw new Error("useParty requires PartyProvider");
  return value;
}

function LivePartyBridge({ children }: { children: ReactNode }) {
  const value = useLiveParty();
  return <PartyContext.Provider value={{ ...value, isMock: false }}>{children}</PartyContext.Provider>;
}

function MockPartyBridge({ children }: { children: ReactNode }) {
  const mock = useMockParty();
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() || null;
  const { enterParty } = mock;

  useEffect(() => { enterParty(code); }, [code, enterParty]);

  const restrictionOptions = getMockRestrictionOptions();
  const budgetOptions = getMockBudgetOptions();
  const desireOptions = getMockDesireOptions();
  const exclusionOptions = getMockExclusionOptions();
  const value: PartyValue = {
    ...mock,
    isMock: true,
    usingLiveCatalog: false,
    addressesLive: false,
    addressesLoading: false,
    addressesError: null,
    findAddressCandidates: async () => { throw new Error("Cadastro de endereço indisponível na prévia mockada."); },
    saveAddress: async () => { throw new Error("Cadastro de endereço indisponível na prévia mockada."); },
    restrictionOptions,
    budgetOptions,
    budgetCustomRange: { min: 1, max: 999 },
    energyOptions: getMockPreferenceQuestion("energy").options,
    orderStyleOptions: getMockPreferenceQuestion("order-style").options,
    desireOptions,
    exclusionOptions,
    toggleRestriction(id) {
      const option = restrictionOptions.find((option) => option.id === id);
      if (option) mock.toggleRestriction(option.id);
    },
    setBudgetOptionId(id) {
      const option = budgetOptions.find((option) => option.id === id);
      mock.setBudgetOptionId(option?.id ?? null);
    },
    toggleDesire(id) {
      const option = desireOptions.find((option) => option.id === id);
      if (option) mock.toggleDesire(option.id);
    },
    toggleExclusion(id) {
      const option = exclusionOptions.find((option) => option.id === id);
      if (option) mock.toggleExclusion(option.id);
    },
    completeQuestionnaire: async () => mock.completeQuestionnaire(),
    // A prévia libera a preparação sem simular respostas dos outros participantes.
    revealTheme: async () => true,
    connectMcp: async () => {},
    connectingMcp: false,
    resolveOrderOptions: async () => {
      throw new Error("A busca de pedido usa o iFood; indisponível na prévia mockada.");
    },
  };

  if (mock.inviteCode !== code) return <PartyLoading />;
  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

function PartyLoading() {
  return <div role="status" className="grid min-h-dvh place-items-center text-muted-foreground">Carregando Party...</div>;
}

export function PartyProvider({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_PARTY_MODE === "mock") {
    return (
      <MockPartyProvider>
        <Suspense fallback={<PartyLoading />}>
          <MockPartyBridge>{children}</MockPartyBridge>
        </Suspense>
      </MockPartyProvider>
    );
  }
  return <LivePartyProvider><LivePartyBridge>{children}</LivePartyBridge></LivePartyProvider>;
}
