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
 * `usingLiveCatalog: false` avisa o resto do app que está no modo simulado. Os endereços vêm
 * de `GET /parties/:id/addresses` quando a conta do iFood está conectada; sem conexão
 * (`409 MCP_NOT_CONNECTED`) a tela mantém a lista de exemplo, sinalizada como simulada.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  AddressResolutionResponse,
  CreateParticipantAddressRequest,
  PartySnapshot,
  QuestionnaireDefinition,
  QuestionnaireQuestionOption,
  LocalOption,
} from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  describeError,
  liveApi,
  LiveApiError,
  type CartResponse,
  type OrderTrackingResponse,
} from "@/lib/api-client";
import { fromParticipantAddress, pickDefaultAddress, type PartyAddress } from "@/lib/addresses";
import { buildQuestionnaireAnswers, budgetFromAnswers } from "@/lib/live-answers";
import { getMockAddresses } from "@/lib/mock-party";
import { partyFlowTarget } from "@/lib/party-flow";
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

export interface LivePartyValue {
  snapshot: PartySnapshot;
  currentParticipantId: string;
  startParty: () => void;
  /** `false` quando `GET /questionnaire` falhou e as telas usam o catálogo fixo do Figma. */
  usingLiveCatalog: boolean;
  addresses: PartyAddress[];
  /** `true` quando a lista veio do iFood; `false` quando são exemplos locais. */
  addressesLive: boolean;
  addressesLoading: boolean;
  addressesError: string | null;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  /** Busca candidatos no iFood para um endereço digitado (tela de novo endereço). */
  findAddressCandidates: (address: string) => Promise<AddressResolutionResponse>;
  /** Salva o candidato escolhido, atualiza a lista e o seleciona. */
  saveAddress: (input: CreateParticipantAddressRequest) => Promise<boolean>;
  restrictionOptions: readonly Option[];
  restrictions: string[];
  toggleRestriction: (id: string) => void;
  otherRestriction: string;
  setOtherRestriction: (value: string) => void;
  budgetOptions: readonly Option[];
  budgetOptionId: string | null;
  setBudgetOptionId: (id: string | null) => void;
  /** Faixa aceita pelo "Outro valor" em `budget.customInput` (padrão 1–999). */
  budgetCustomRange: { min: number; max: number };
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
  /**
   * Busca no iFood (via agente/MCP) opções reais para o participante atual, com o tema da
   * Party, o orçamento, as restrições e o endereço das respostas dele.
   */
  resolveOrderOptions: (forceRefresh?: boolean) => Promise<LocalOption[]>;
  cart: CartResponse | null;
  prepareOrderCart: (option: LocalOption) => Promise<CartResponse>;
  submitPartyOrder: (cartId: string) => Promise<{ orderId: string; simulated: boolean }>;
  trackPartyOrder: (orderId: string) => Promise<OrderTrackingResponse>;
  loadRetrospective: () => ReturnType<typeof liveApi.getRetrospective>;
}

const LivePartyContext = createContext<LivePartyValue | null>(null);

export function useParty(): LivePartyValue {
  const context = useContext(LivePartyContext);
  if (!context) throw new Error("useParty requires LivePartyProvider");
  return context;
}

export function LivePartyProvider({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const router = useRouter();
  const pathname = usePathname();

  const [session, setSession] = useState<StoredSession | null>(() => loadStoredSession());
  const [snapshot, setSnapshot] = useState<PartySnapshot | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDefinition | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(() => loadStoredSession() !== null);
  const [connectingMcp, setConnectingMcp] = useState(false);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const orderOptionsRequests = useRef(new Map<string, Promise<LocalOption[]>>());

  const [addresses, setAddresses] = useState<PartyAddress[]>(getMockAddresses);
  const [addressesLive, setAddressesLive] = useState(false);
  const [addressesResolvedKey, setAddressesResolvedKey] = useState<string | null>(null);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => getMockAddresses()[0]?.id ?? null);
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
        // Um link de convite de OUTRA Party vence a sessão guardada. Sem isto, quem já
        // testou antes abre o link novo e continua no lobby antigo — o host nunca vê a
        // pessoa entrar. Um reload simples (mesmo código) continua idempotente.
        const inviteCode = readInviteCode();
        if (inviteCode && party.party.code.toUpperCase() !== inviteCode.toUpperCase()) {
          saveStoredSession(null);
          if (alive) setSession(null);
          return;
        }
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

  // Segue o fluxo coletivo: o estado chega pelo polling e move cada navegador sozinho.
  // Ex.: o anfitrião aperta "Iniciar party" e os convidados saem do lobby sem clicar.
  useEffect(() => {
    if (!session || !snapshot) return;
    const target = partyFlowTarget(snapshot, session.participantId, pathname);
    if (target && target !== pathname) router.replace(target);
  }, [router, pathname, session, snapshot]);

  // Endereços reais do iFood: recarrega quando a conexão MCP muda de estado (o polling
  // atualiza o snapshot). Sem conta conectada a API responde 409 e a tela mantém os
  // exemplos, deixando claro que são simulados.
  const participantMcpStatus =
    snapshot?.participants.find((participant) => participant.id === session?.participantId)
      ?.mcpConnectionStatus ?? "not_connected";
  // Chave da última busca: `addressesLoading` é derivado (nunca um `setState` síncrono
  // dentro do efeito) e muda quando a Party ou a conexão MCP mudam.
  const addressesRequestKey = session
    ? `${session.partyId}:${session.participantId}:${participantMcpStatus}`
    : null;
  const addressesLoading =
    addressesRequestKey !== null && addressesResolvedKey !== addressesRequestKey;

  useEffect(() => {
    if (!session || addressesRequestKey === null) return;
    let alive = true;
    liveApi
      .getAddresses(session.partyId, session.token)
      .then((result) => {
        if (!alive) return;
        const next = result.addresses.map(fromParticipantAddress);
        setAddressesLive(true);
        setAddressesError(null);
        setAddresses(next);
        setSelectedAddressId((current) => pickDefaultAddress(next, current));
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        const notConnected = cause instanceof LiveApiError && cause.code === "MCP_NOT_CONNECTED";
        setAddressesLive(false);
        setAddressesError(notConnected ? null : describeError(cause));
        if (notConnected) {
          const fallback = getMockAddresses();
          setAddresses(fallback);
          setSelectedAddressId((current) => pickDefaultAddress(fallback, current));
        }
      })
      .finally(() => {
        if (alive) setAddressesResolvedKey(addressesRequestKey);
      });
    return () => {
      alive = false;
    };
  }, [session, addressesRequestKey]);

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
      // Navega a própria aba: `window.open` depois do `await` cai no bloqueio de popup
      // (o gesto do clique já terminou) e falha em silêncio. O backend devolve a pessoa
      // para `FRONTEND_URL`, a sessão continua no `sessionStorage` e o polling reconecta.
      window.location.assign(result.authorizationUrl);
    } catch (cause) {
      setActionError(describeError(cause));
      setConnectingMcp(false);
    }
  }, [session]);

  const resolveOrderOptions = useCallback(async (forceRefresh = false): Promise<LocalOption[]> => {
    if (!session || !snapshot) throw new Error("Sessão da Party indisponível.");
    const me = snapshot.participants.find((participant) => participant.id === session.participantId);
    const answers = me?.questionnaireResponse?.answers ?? {};
    const budget = budgetFromAnswers(questionnaire, answers);
    if (budget === null) {
      throw new Error("Responda o orçamento antes de buscar o pedido.");
    }
    const restrictions = Array.isArray(answers.restrictions)
      ? answers.restrictions.filter(
          (value): value is string => typeof value === "string" && value !== "outro",
        )
      : [];
    // O endereço escolhido fica na resposta pelo rótulo; no snapshot não há o id do iFood.
    const chosenLabel = typeof answers.address === "string" ? answers.address : null;
    const chosenAddress = chosenLabel
      ? addresses.find((address) => address.label === chosenLabel)
      : undefined;
    const addressId = addressesLive
      ? chosenAddress?.id ?? selectedAddressId ?? undefined
      : undefined;
    const cacheKey = JSON.stringify({
      partyId: session.partyId,
      participantId: session.participantId,
      theme: snapshot.party.theme ?? null,
      budget,
      restrictions,
      addressId: addressId ?? null,
    });
    if (forceRefresh) orderOptionsRequests.current.delete(cacheKey);
    let request = orderOptionsRequests.current.get(cacheKey);
    if (!request) {
      request = liveApi
        .getOptions(session.partyId, session.token, {
          budget,
          restrictions,
          maxOptions: 3,
          ...(addressId ? { addressId } : {}),
        })
        .then((result) => {
          if (result.options.length === 0) {
            throw new Error(
              "Nenhuma loja atendeu ao tema e ao orçamento agora. Ajuste o valor ou tente de novo.",
            );
          }
          return result.options;
        });
      orderOptionsRequests.current.set(cacheKey, request);
    }
    // Preserve failures too: the order screen can display the prefetch result immediately,
    // and an explicit retry invalidates this entry.
    return request;
  }, [session, snapshot, questionnaire, addresses, addressesLive, selectedAddressId]);

  const prepareOrderCart = useCallback(async (option: LocalOption): Promise<CartResponse> => {
    if (!session) throw new Error("Sessão da Party indisponível.");
    const result = await liveApi.createCart(session.partyId, session.token, {
      option,
      ...(selectedAddressId ? { addressId: selectedAddressId } : {}),
    });
    setCart(result);
    setSnapshot(await liveApi.getParty(session.partyId, session.token));
    return result;
  }, [session, selectedAddressId]);

  const submitPartyOrder = useCallback(async (cartId: string) => {
    if (!session) throw new Error("Sessão da Party indisponível.");
    const result = await liveApi.submitOrder(session.partyId, session.token, {
      cartId,
      userConsent: true,
    });
    setSnapshot(await liveApi.getParty(session.partyId, session.token));
    return result;
  }, [session]);

  const trackPartyOrder = useCallback(async (orderId: string) => {
    if (!session) throw new Error("Sessão da Party indisponível.");
    const result = await liveApi.trackOrder(session.partyId, session.token, orderId);
    setSnapshot(await liveApi.getParty(session.partyId, session.token));
    return result;
  }, [session]);

  const loadRetrospective = useCallback(async () => {
    if (!session) throw new Error("Sessão da Party indisponível.");
    return liveApi.getRetrospective(session.partyId, session.token);
  }, [session]);

  const findAddressCandidates = useCallback(
    async (address: string): Promise<AddressResolutionResponse> => {
      if (!session) throw new Error("Sessão da Party não encontrada.");
      return liveApi.resolveAddress(session.partyId, session.token, { address });
    },
    [session],
  );

  const saveAddress = useCallback(
    async (input: CreateParticipantAddressRequest): Promise<boolean> => {
      if (!session) return false;
      setActionError(null);
      try {
        const result = await liveApi.createAddress(session.partyId, session.token, input);
        const saved = fromParticipantAddress(result.address);
        setAddresses((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
        setAddressesLive(true);
        setAddressesError(null);
        setSelectedAddressId(saved.id);
        return true;
      } catch (cause) {
        setActionError(describeError(cause));
        return false;
      }
    },
    [session],
  );

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
  const budgetCustom = questionnaire?.questions.find((question) => question.id === "budget")?.customInput;
  const budgetCustomRange = { min: budgetCustom?.min ?? 1, max: budgetCustom?.max ?? 999 };
  const energyOptions = questionOptions(questionnaire, "energy") ?? getMockPreferenceQuestion("energy").options;
  const orderStyleOptions =
    questionOptions(questionnaire, "order-style") ?? getMockPreferenceQuestion("order-style").options;
  const desireOptions = questionOptions(questionnaire, "cravings") ?? getMockDesireOptions();
  const exclusionOptions = questionOptions(questionnaire, "exclusions") ?? getMockExclusionOptions();

  const customBudgetAmount = parseMockBudget(customBudget);
  const customBudgetInRange =
    customBudgetAmount !== null &&
    customBudgetAmount >= budgetCustomRange.min &&
    customBudgetAmount <= budgetCustomRange.max;

  const hasRequiredAnswers =
    selectedAddressId !== null &&
    (!restrictions.includes(otherRestrictionId) || otherRestriction.trim().length > 0) &&
    budgetOptionId !== null &&
    (budgetOptionId !== otherBudgetId || customBudgetInRange) &&
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
  }, [
    session,
    canCompleteQuestionnaire,
    questionnaire,
    usingLiveCatalog,
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
        addressesLive,
        addressesLoading,
        addressesError,
        selectedAddressId,
        setSelectedAddressId,
        findAddressCandidates,
        saveAddress,
        restrictionOptions,
        restrictions,
        toggleRestriction,
        otherRestriction,
        setOtherRestriction,
        budgetOptions,
        budgetOptionId,
        setBudgetOptionId,
        budgetCustomRange,
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
        resolveOrderOptions,
        cart,
        prepareOrderCart,
        submitPartyOrder,
        trackPartyOrder,
        loadRetrospective,
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
  const [partyName, setPartyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const participantId = randomParticipantId();
      const result = inviteCode
        ? await liveApi.joinParty(inviteCode, { participant: { id: participantId } })
        : await liveApi.createParty({
            name: partyName.trim() || "Party sem nome",
            host: { id: participantId },
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
        <Button type="submit" size="party" className="w-full" disabled={busy}>
          {busy ? "Entrando..." : inviteCode ? "Entrar" : "Criar Party"}
        </Button>
      </form>
    </div>
  );
}
