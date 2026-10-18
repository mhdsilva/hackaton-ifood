"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LivePartyProvider, useParty as useLiveParty, type LivePartyValue } from "@/components/party/live-party-provider";
import { MockPartyProvider, useMockParty } from "@/components/party/mock-party-provider";
import { getMockBudgetOptions, getMockDesireOptions, getMockExclusionOptions, getMockPreferenceQuestion, getMockRestrictionOptions } from "@/lib/mock-questionnaire";
import { getMockRetrospective } from "@/lib/mock-retrospective";

type PartyValue = LivePartyValue;
const PartyContext = createContext<PartyValue | null>(null);

export function useParty(): PartyValue {
  const value = useContext(PartyContext);
  if (!value) throw new Error("useParty requires PartyProvider");
  return value;
}

function LivePartyBridge({ children }: { children: ReactNode }) {
  const value = useLiveParty();
  return <PartyDataBridge value={value}>{children}</PartyDataBridge>;
}

// Explicit showcase scenarios also replace data here, never the screen markup.
function PartyDataBridge({ value, children }: { value: PartyValue; children: ReactNode }) {
  const params = useSearchParams();
  const preview = params.get("preview");
  const { snapshot, loadRetrospective } = value;
  const snapshotRef = useRef(snapshot);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  const load = useCallback(() => {
    if (preview === "waiting" || preview === "no-distance" || preview === "empty") {
      return Promise.resolve(getMockRetrospective(snapshotRef.current, preview));
    }
    return loadRetrospective();
  }, [preview, loadRetrospective]);
  return <PartyContext.Provider value={{ ...value, loadRetrospective: load }}>{children}</PartyContext.Provider>;
}

function MockPartyBridge({ children }: { children: ReactNode }) {
  const mock = useMockParty();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const code = searchParams.get("code")?.trim() || (pathname === "/" ? null : mock.inviteCode);
  const authenticatedPreview = searchParams.get("preview") === "authenticated" || (pathname !== "/" && mock.authenticatedPreview);
  const { enterParty } = mock;

  useEffect(() => { enterParty(code, authenticatedPreview); }, [code, authenticatedPreview, enterParty]);

  const restrictionOptions = getMockRestrictionOptions();
  const budgetOptions = getMockBudgetOptions();
  const desireOptions = getMockDesireOptions();
  const exclusionOptions = getMockExclusionOptions();
  const value: PartyValue = {
    ...mock,
    restartSession: () => window.location.replace("/"),
    usingLiveCatalog: false,
    addressesLive: true,
    addressesLoading: false,
    addressesError: null,
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
    startParty: async () => mock.startParty(),
    connectMcp: mock.connectMcp,
    connectingMcp: mock.connectingMcp,
  };

  if (mock.inviteCode !== code || mock.authenticatedPreview !== authenticatedPreview) return <PartyLoading />;
  return <PartyDataBridge value={value}>{children}</PartyDataBridge>;
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
  return <LivePartyProvider><Suspense fallback={<PartyLoading />}><LivePartyBridge>{children}</LivePartyBridge></Suspense></LivePartyProvider>;
}
