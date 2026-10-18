"use client";

/**
 * Provider real do grupo `(party)`: cria/entra na Party pela API, mantém a sessão em
 * `sessionStorage`, consulta `GET /parties/:id` em polling, busca o questionário real uma vez
 * e envia as respostas, revela o tema e conecta o iFood.
 *
 * Mantém a MESMA forma pública de `useMockParty` (ver `mock-party-provider.tsx`, que continua
 * intacto como referência/fallback) para as telas não precisarem mudar, além do import. Cada
 * tela de pergunta recebe as opções de `useParty()` em vez de ler `lib/mock-questionnaire.ts`
 * direto; se `GET /questionnaire` falhar, essas opções caem para o catálogo fixo do Figma, e
 * `usingLiveCatalog: false` avisa o resto do app que está no modo simulado. Endereço continua
 * modelo visual local — a resolução real do iFood acontece depois, em `/options` (ver
 * docs/handoff-colucci.md, §"Ainda NÃO existe").
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  PartySnapshot,
  QuestionnaireDefinition,
  QuestionnaireQuestionOption,
} from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeError, liveApi, LiveApiError } from "@/lib/api-client";
import { buildQuestionnaireAnswers } from "@/lib/live-answers";
import { getMockAddresses } from "@/lib/mock-party";
import {
  getMockBudgetOptions,
  getMockDesireOptions,
  getMockExclusionOptions,
  getMockPreferenceQuestion,
  getMockRestrictionOptions,
  MAX_MOCK_DESIRES,
  parseMockBudget,
} from "@/lib/mock-questionnaire";

const STORAGE_KEY = "ifood-party-live-session";
const POLL_MS = 1500;

interface StoredSession {
  partyId: string;
  participantId: string;
  token: string;
}

type Option = QuestionnaireQuestionOption;

const subscribeNoop = () => () => {};
const isBrowser = () => typeof window !== "undefined";

function readInviteCode(): string | null {
  return new URLSearchParams(window.location.search).get("code")?.trim() || null;
}

function loadStoredSession(): StoredSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredSession | null): void {
  if (!isBrowser()) return;
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}

function randomParticipantId(): string {
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

function canStartLiveParty(snapshot: PartySnapshot, participantId: string): boolean {
  return (
    snapshot.party.status === "OPEN" &&
    !snapshot.party.membershipLocked &&
    snapshot.party.hostParticipantId === participantId &&
    snapshot.participants.length >= 2 &&
    snapshot.participants.length <= 4
  );
}

function questionOptions(
  definition: QuestionnaireDefinition | null,
  questionId: string,
): readonly Option[] | undefined {
  return definition?.questions.find((question) => question.id === questionId)?.options;
}

interface LivePartyValue {
  snapshot: PartySnapshot;
  currentParticipantId: string;
  startParty: () => void;
  /** `false` quando `GET /questionnaire` falhou e as telas usam o catálogo fixo do Figma. */
  usingLiveCatalog: boolean;
  addresses: ReturnType<typeof getMockAddresses>;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  restrictionOptions: readonly Option[];
  restrictions: string[];
  toggleRestriction: (id: string) => void;
  otherRestriction: string;
  setOtherRestriction: (value: string) => void;
  budgetOptions: readonly Option[];
  budgetOptionId: string | null;
  setBudgetOptionId: (id: string | null) => void;
  customBudget: string;
  setCustomBudget: (value: string) => void;
  energyOptions: readonly Option[];
  orderStyleOptions: readonly Option[];
  preferences: Record<"energy" | "order-style", string | null>;
  selectPreference: (id: "energy" | "order-style", value: string) => void;
  desireOptions: readonly Option[];
  desires: string[];
  toggleDesire: (id: string) => void;
  exclusionOptions: readonly Option[];
  exclusions: string[];
  toggleExclusion: (id: string) => void;
  otherExclusion: string;
  setOtherExclusion: (value: string) => void;
  hasRequiredAnswers: boolean;
  canCompleteQuestionnaire: boolean;
  /** Envia o questionário real; resolve `true` só quando a API aceita. */
  completeQuestionnaire: () => Promise<boolean>;
  completedParticipantIds: string[];
  /** Host revela o tema (`POST /parties/:id/reveal`); resolve `true` só quando a API aceita. */
  revealTheme: () => Promise<boolean>;
  /** Pede a URL de login do iFood e abre numa aba nova; o status chega pelo polling. */
  connectMcp: () => Promise<void>;
  connectingMcp: boolean;
}

const LivePartyContext = createContext<LivePartyValue | null>(null);

export function useParty(): LivePartyValue {
  const context = useContext(LivePartyContext);
  if (!context) throw new Error("useParty requires LivePartyProvider");
  return context;
}

export function LivePartyProvider({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const [session, setSession] = useState<StoredSession | null>(() => loadStoredSession());
  const [snapshot, setSnapshot] = useState<PartySnapshot | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDefinition | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(() => loadStoredSession() !== null);
  const [connectingMcp, setConnectingMcp] = useState(false);

  const [addresses] = useState(getMockAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses[0]?.id ?? null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [otherRestriction, setOtherRestriction] = useState("");
  const [budgetOptionId, setBudgetOptionId] = useState<string | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [preferences, setPreferences] = useState<Record<"energy" | "order-style", string | null>>({
    energy: null,
    "order-style": null,
  });
  const [desires, setDesires] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [otherExclusion, setOtherExclusion] = useState("");

  // Catálogo real, uma vez: as telas só renderizam depois que isto resolve (sucesso ou
  // fallback), para nenhum id trocar de fonte no meio da sessão.
  useEffect(() => {
    let alive = true;
    liveApi
      .getQuestionnaire()
      .then((definition) => {
        if (alive) setQuestionnaire(definition);
      })
      .catch(() => {
        if (alive) setCatalogFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Restaura a sessão guardada (se houver) antes de decidir entre a Party e a entrada por nome.
  useEffect(() => {
    // Sem sessão guardada, `restoring` já nasce `false` (estado inicial, acima) — nada a fazer.
    if (!session) return;
    let alive = true;
    (async () => {
      try {
        await liveApi.getSession(session.partyId, session.token);
        const party = await liveApi.getParty(session.partyId, session.token);
        if (alive) setSnapshot(party);
      } catch {
        saveStoredSession(null);
        if (alive) setSession(null);
      } finally {
        if (alive) setRestoring(false);
      }
    })();
    return () => {
      alive = false;
    };
    // Só na sessão inicial: criar/entrar já atualiza `snapshot` diretamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling do snapshot em vigor, com a Party já aberta.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const tick = async () => {
      try {
        const next = await liveApi.getParty(session.partyId, session.token);
        if (alive) setSnapshot(next);
      } catch (cause) {
        if (!alive) return;
        if (cause instanceof LiveApiError && cause.status === 404) {
          setFatalError("Essa Party não está mais disponível.");
          return;
        }
        setActionError(describeError(cause));
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [session]);

  const startParty = useCallback(() => {
    if (!session || !snapshot || !canStartLiveParty(snapshot, session.participantId)) return;
    setActionError(null);
    liveApi
      .closeParty(session.partyId, session.token)
      .then(setSnapshot)
      .catch((cause: unknown) => setActionError(describeError(cause)));
  }, [session, snapshot]);

  const revealTheme = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    setActionError(null);
    try {
      setSnapshot(await liveApi.reveal(session.partyId, session.token));
      return true;
    } catch (cause) {
      setActionError(describeError(cause));
      return false;
    }
  }, [session]);

  const connectMcp = useCallback(async (): Promise<void> => {
    if (!session) return;
    setActionError(null);
    setConnectingMcp(true);
    try {
      const result = await liveApi.authorizeMcp(session.partyId, session.token);
      window.open(result.authorizationUrl, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setActionError(describeError(cause));
    } finally {
      setConnectingMcp(false);
    }
  }, [session]);

  function toggleRestriction(id: string) {
    setRestrictions((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function selectPreference(id: "energy" | "order-style", value: string) {
    setPreferences((current) => ({ ...current, [id]: value }));
  }

  function toggleDesire(id: string) {
    setDesires((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      return current.length < MAX_MOCK_DESIRES ? [...current, id] : current;
    });
  }

  function toggleExclusion(id: string) {
    setExclusions((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  const usingLiveCatalog = questionnaire !== null;
  const otherRestrictionId = usingLiveCatalog ? "outro" : "other";
  const otherBudgetId = usingLiveCatalog ? "outro" : "other";

  const restrictionOptions = questionOptions(questionnaire, "restrictions") ?? getMockRestrictionOptions();
  const budgetOptions = questionOptions(questionnaire, "budget") ?? getMockBudgetOptions();
  const energyOptions = questionOptions(questionnaire, "energy") ?? getMockPreferenceQuestion("energy").options;
  const orderStyleOptions =
    questionOptions(questionnaire, "order-style") ?? getMockPreferenceQuestion("order-style").options;
  const desireOptions = questionOptions(questionnaire, "cravings") ?? getMockDesireOptions();
  const exclusionOptions = questionOptions(questionnaire, "exclusions") ?? getMockExclusionOptions();

  const hasRequiredAnswers =
    selectedAddressId !== null &&
    (!restrictions.includes(otherRestrictionId) || otherRestriction.trim().length > 0) &&
    budgetOptionId !== null &&
    (budgetOptionId !== otherBudgetId || parseMockBudget(customBudget) !== null) &&
    preferences.energy !== null &&
    preferences["order-style"] !== null &&
    desires.length >= 1 &&
    desires.length <= MAX_MOCK_DESIRES;
  const canCompleteQuestionnaire =
    hasRequiredAnswers && (!exclusions.includes("outro") || otherExclusion.trim().length > 0);

  const completeQuestionnaire = useCallback(async (): Promise<boolean> => {
    if (!session || !canCompleteQuestionnaire) return false;
    setActionError(null);
    try {
      const definition = questionnaire ?? (await liveApi.getQuestionnaire());
      const answers = buildQuestionnaireAnswers({
        selectedAddressId,
        addresses,
        restrictions,
        otherRestriction,
        budgetOptionId,
        customBudget,
        preferences,
        desires,
        exclusions,
        otherExclusion,
        usingLiveCatalog,
      });
      const next = await liveApi.submitAnswers(session.partyId, session.token, {
        questionnaireVersion: definition.version,
        answers,
        completed: true,
      });
      setSnapshot(next);
      return true;
    } catch (cause) {
      setActionError(describeError(cause));
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    canCompleteQuestionnaire,
    questionnaire,
    usingLiveCatalog,
    selectedAddressId,
    restrictions,
    otherRestriction,
    budgetOptionId,
    customBudget,
    preferences,
    desires,
    exclusions,
    otherExclusion,
  ]);

  function startSession(next: StoredSession, party: PartySnapshot) {
    saveStoredSession(next);
    setSession(next);
    setSnapshot(party);
  }

  if (!isClient || restoring || (!questionnaire && !catalogFailed)) {
    return <StatusScreen message="Carregando Party..." />;
  }
  if (fatalError) {
    return (
      <StatusScreen message={fatalError}>
        <Button
          size="party"
          onClick={() => {
            saveStoredSession(null);
            setSession(null);
            setSnapshot(null);
            setFatalError(null);
          }}
        >
          Voltar ao início
        </Button>
      </StatusScreen>
    );
  }
  if (!session || !snapshot) {
    return <EntryGate onEntered={startSession} />;
  }

  const completedParticipantIds = snapshot.participants
    .filter((participant) => participant.questionnaireResponse?.completed)
    .map((participant) => participant.id);

  return (
    <LivePartyContext.Provider
      value={{
        snapshot,
        currentParticipantId: session.participantId,
        startParty,
        usingLiveCatalog,
        addresses,
        selectedAddressId,
        setSelectedAddressId,
        restrictionOptions,
        restrictions,
        toggleRestriction,
        otherRestriction,
        setOtherRestriction,
        budgetOptions,
        budgetOptionId,
        setBudgetOptionId,
        customBudget,
        setCustomBudget,
        energyOptions,
        orderStyleOptions,
        preferences,
        selectPreference,
        desireOptions,
        desires,
        toggleDesire,
        exclusionOptions,
        exclusions,
        toggleExclusion,
        otherExclusion,
        setOtherExclusion,
        hasRequiredAnswers,
        canCompleteQuestionnaire,
        completeQuestionnaire,
        completedParticipantIds,
        revealTheme,
        connectMcp,
        connectingMcp,
      }}
    >
      {actionError && (
        <p role="alert" className="border-b border-destructive bg-destructive/10 p-2 text-center text-xs text-destructive">
          {actionError}
        </p>
      )}
      {children}
    </LivePartyContext.Provider>
  );
}

function StatusScreen({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center gap-4 p-5 text-center text-muted-foreground">
      <p>{message}</p>
      {children}
    </div>
  );
}

/** Sem sessão: cria a Party (sem `?code`) ou entra nela (com `?code`). Ainda sem tela do Figma. */
function EntryGate({
  onEntered,
}: {
  onEntered: (session: StoredSession, party: PartySnapshot) => void;
}) {
  const inviteCode = useSyncExternalStore(subscribeNoop, readInviteCode, () => null);
  const [name, setName] = useState("");
  const [partyName, setPartyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const participantId = randomParticipantId();
      const result = inviteCode
        ? await liveApi.joinParty(inviteCode, { participant: { id: participantId, name: name.trim() } })
        : await liveApi.createParty({
            name: partyName.trim() || "Party sem nome",
            host: { id: participantId, name: name.trim() },
          });
      onEntered({ partyId: result.party.party.id, participantId, token: result.participantToken }, result.party);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-5">
      <h1 className="text-2xl font-bold">{inviteCode ? "Entrar na Party" : "Criar Party"}</h1>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form className="space-y-3" onSubmit={submit}>
        {!inviteCode && (
          <Input
            aria-label="Nome da Party"
            placeholder="Nome da Party"
            value={partyName}
            onChange={(event) => setPartyName(event.target.value)}
          />
        )}
        <Input
          aria-label="Seu nome"
          placeholder="Seu nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Button type="submit" size="party" className="w-full" disabled={busy || !name.trim()}>
          {busy ? "Entrando..." : inviteCode ? "Entrar" : "Criar Party"}
        </Button>
      </form>
    </div>
  );
}
