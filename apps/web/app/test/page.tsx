"use client";

/**
 * PÁGINA DE TESTE — integra a API real, sem visual definitivo.
 *
 * Fluxo completo, o mais simples possível: criar/entrar na Party (o `?code` da
 * URL decide), iniciar, responder o questionário vindo da API, conectar o iFood,
 * revelar o tema e buscar opções. Serve para testar o backend de ponta a ponta
 * pelo navegador; a tela "de verdade" é do Otávio (ver §6 do handoff-colucci).
 *
 * Endereço da API: `?api=http://…` na URL, senão `NEXT_PUBLIC_API_URL`, senão
 * local no dev e prod no deploy.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type {
  Participant,
  PartySnapshot,
  QuestionnaireDefinition,
  ResolveOptionsOutput,
} from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { QuestionnaireForm } from "./questionnaire-form";
import { apiBase, describeError, liveApi } from "@/lib/api-client";

const STORAGE_KEY = "ifood-party-test-session";

/** Assinatura vazia: só lemos `window`/`sessionStorage` (snapshot), não observamos mudanças. */
const subscribeNoop = () => () => {};

const isBrowser = () => typeof window !== "undefined";

interface Session {
  partyId: string;
  code: string;
  participantId: string;
  participantName: string;
  token: string;
}

function loadSession(): Session | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}

function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${random}`;
}

function budgetFrom(definition: QuestionnaireDefinition | null, answers: Record<string, unknown>): number {
  const question = definition?.questions.find((entry) => entry.id === "budget");
  const option = question?.options?.find((entry) => entry.id === answers.budget);
  if (option?.value !== undefined) return option.value;
  const custom = answers["budget__value"];
  if (typeof custom === "number" && custom > 0) return custom;
  return 50;
}

function restrictionIds(answers: Record<string, unknown>): string[] {
  const list = answers.restrictions;
  return Array.isArray(list) ? list.filter((entry) => entry !== "outro") : [];
}

export default function TestPage() {
  // Só no cliente: no SSR/pré-render `window` não existe. `useSyncExternalStore`
  // devolve o snapshot do servidor durante a hidratação e o do cliente depois.
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const codeFromUrl = useSyncExternalStore(
    subscribeNoop,
    () => new URLSearchParams(window.location.search).get("code"),
    () => null,
  );
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [name, setName] = useState("Ana");
  const [partyName, setPartyName] = useState("Sabadou à distância");
  const [snapshot, setSnapshot] = useState<PartySnapshot | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDefinition | null>(null);
  const [options, setOptions] = useState<ResolveOptionsOutput | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(label);
    try {
      await action();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  // 2. Polling do snapshot enquanto há sessão.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const tick = async () => {
      try {
        const next = await liveApi.getParty(session.partyId, session.token);
        if (alive) setSnapshot(next);
      } catch (cause) {
        if (alive) setError(describeError(cause));
      }
    };
    void tick();
    const timer = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session]);

  const startSession = useCallback((next: Session) => {
    saveSession(next);
    setSession(next);
    setNotice(null);
  }, []);

  async function createParty() {
    await run("criando party…", async () => {
      const id = newId("host");
      const result = await liveApi.createParty({
        name: partyName.trim() || "Sabadou à distância",
        host: { id, name: name.trim() || id },
      });
      startSession({
        partyId: result.party.party.id,
        code: result.party.party.code,
        participantId: id,
        participantName: name.trim() || id,
        token: result.participantToken,
      });
      setSnapshot(result.party);
    });
  }

  async function joinParty() {
    if (!codeFromUrl) return;
    await run("entrando na party…", async () => {
      const id = newId("guest");
      const result = await liveApi.joinParty(codeFromUrl, {
        participant: { id, name: name.trim() || id },
      });
      startSession({
        partyId: result.party.party.id,
        code: result.party.party.code,
        participantId: id,
        participantName: name.trim() || id,
        token: result.participantToken,
      });
      setSnapshot(result.party);
    });
  }

  async function act(label: string, action: (session: Session) => Promise<void>) {
    if (!session) return;
    await run(label, () => action(session));
  }

  function leave() {
    saveSession(null);
    setSession(null);
    setSnapshot(null);
    setQuestionnaire(null);
    setOptions(null);
    setAuthUrl(null);
    setNotice(null);
    setError(null);
  }

  if (!isClient) {
    return <main className="mx-auto max-w-md p-5 text-sm text-muted-foreground">carregando…</main>;
  }

  const host = session && snapshot ? snapshot.party.hostParticipantId === session.participantId : false;
  const status = snapshot?.party.status;
  const inviteUrl = session && typeof window !== "undefined"
    ? `${window.location.origin}/test?code=${session.code}`
    : "";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-5 pb-16 text-sm">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Teste de integração · iFood Party</h1>
        <p className="text-xs text-muted-foreground">
          API: <code>{apiBase()}</code> (troque com <code>?api=…</code>)
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}
      {notice && busy && <p className="text-xs text-muted-foreground">{notice}</p>}

      {/* ---------- Sem sessão: criar ou entrar ---------- */}
      {!session && (
        <section className="space-y-3 rounded-lg border p-4">
          {codeFromUrl ? (
            <>
              <h2 className="font-bold">Convite para a party <code>{codeFromUrl}</code></h2>
              <input
                className="w-full rounded-md border px-3 py-2"
                placeholder="Seu nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button size="party" className="w-full" disabled={busy} onClick={joinParty}>
                Entrar na party
              </Button>
            </>
          ) : (
            <>
              <h2 className="font-bold">Criar party (você é o host)</h2>
              <input
                className="w-full rounded-md border px-3 py-2"
                placeholder="Nome da party"
                value={partyName}
                onChange={(event) => setPartyName(event.target.value)}
              />
              <input
                className="w-full rounded-md border px-3 py-2"
                placeholder="Seu nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button size="party" className="w-full" disabled={busy} onClick={createParty}>
                Criar party
              </Button>
              <p className="text-xs text-muted-foreground">
                Abra o link gerado em outro aparelho/aba para entrar como convidado.
              </p>
            </>
          )}
        </section>
      )}

      {/* ---------- Com sessão: a party ---------- */}
      {session && (
        <>
          <section className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-secondary px-2 py-1 text-xs font-bold">{status ?? "…"}</span>
              <span className="text-xs text-muted-foreground">
                {host ? "você é o host" : "convidado"}
              </span>
            </div>
            <p className="text-2xl font-black tracking-widest">{session.code}</p>
            <div className="flex gap-2">
              <input readOnly className="min-w-0 flex-1 rounded-md border px-2 py-1 text-xs" value={inviteUrl} />
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl).then(
                    () => setNotice("link copiado"),
                    () => setError("não consegui copiar"),
                  );
                }}
              >
                Copiar
              </Button>
            </div>
            {snapshot?.party.theme && (
              <p className="rounded-md bg-primary/10 p-2 text-xs">
                tema revelado: <strong>{snapshot.party.theme}</strong>
                {snapshot.party.themeReason && (
                  <span className="block text-muted-foreground">{snapshot.party.themeReason}</span>
                )}
              </p>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-bold">Participantes ({snapshot?.participants.length ?? 0})</h2>
            <ul className="space-y-1">
              {(snapshot?.participants ?? []).map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  hostId={snapshot?.party.hostParticipantId ?? ""}
                  isMe={participant.id === session.participantId}
                />
              ))}
            </ul>
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-bold">Ações</h2>

            {host && status === "OPEN" && (
              <Button
                size="party"
                className="w-full"
                disabled={busy || (snapshot?.participants.length ?? 0) < 2}
                onClick={() => act("iniciando party…", async (current) => {
                  setSnapshot(await liveApi.closeParty(current.partyId, current.token));
                })}
              >
                Iniciar party (close)
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => act("abrindo OAuth do iFood…", async (current) => {
                const result = await liveApi.authorizeMcp(current.partyId, current.token);
                setAuthUrl(result.authorizationUrl);
                setNotice(`OAuth (${result.mode}) pronto — abra a URL`);
              })}
            >
              Conectar iFood (OAuth)
            </Button>
            {authUrl && (
              <a
                className="block break-all rounded-md bg-secondary p-2 text-xs text-primary underline"
                href={authUrl}
                target="_blank"
                rel="noreferrer"
              >
                {authUrl}
              </a>
            )}

            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => act("baixando questionário…", async () => {
                setQuestionnaire(await liveApi.getQuestionnaire());
              })}
            >
              {questionnaire ? "Recarregar questionário" : "Baixar questionário (GET /questionnaire)"}
            </Button>
          </section>

          {questionnaire && status !== "OPEN" && (
            <section className="rounded-lg border p-4">
              <h2 className="mb-3 font-bold">Questionário</h2>
              <QuestionnaireForm
                definition={questionnaire}
                initial={
                  snapshot?.participants.find((p) => p.id === session.participantId)?.questionnaireResponse
                    ?.answers
                }
                busy={busy}
                onSubmit={(answers) =>
                  act("enviando respostas…", async (current) => {
                    setSnapshot(await liveApi.submitAnswers(current.partyId, current.token, {
                      questionnaireVersion: questionnaire.version,
                      answers,
                      completed: true,
                    }));
                  })
                }
              />
            </section>
          )}

          {host && status === "READY_FOR_THEME" && (
            <Button
              size="party"
              className="w-full"
              disabled={busy}
              onClick={() => act("revelando tema…", async (current) => {
                setSnapshot(await liveApi.reveal(current.partyId, current.token));
              })}
            >
              Revelar tema
            </Button>
          )}

          {status === "THEME_REVEALED" && (
            <section className="space-y-2 rounded-lg border p-4">
              <h2 className="font-bold">Opções locais</h2>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => act("buscando opções…", async (current) => {
                  const me = snapshot?.participants.find((p) => p.id === current.participantId);
                  const answers = me?.questionnaireResponse?.answers ?? {};
                  setOptions(await liveApi.getOptions(current.partyId, current.token, {
                    budget: budgetFrom(questionnaire, answers),
                    restrictions: restrictionIds(answers),
                  }));
                })}
              >
                Buscar opções (POST /options)
              </Button>
              {options && (
                <div className="space-y-2 text-xs">
                  <p>
                    fonte: <strong>{options.source}</strong> · tema: <strong>{options.theme}</strong>
                  </p>
                  {options.warnings.map((warning) => (
                    <p key={warning} className="text-muted-foreground">⚠ {warning}</p>
                  ))}
                  {options.options.length === 0 && <p>Nenhuma opção retornada.</p>}
                  {options.options.map((option) => (
                    <div key={option.merchant.id} className="rounded-md border p-2">
                      <p className="font-bold">
                        {option.merchant.name} · {option.merchant.distanceKm} km
                      </p>
                      <ul className="mt-1 list-disc pl-4">
                        {option.items.map((item) => (
                          <li key={item.itemId}>
                            {item.quantity}× {item.name} — R$ {item.unitPrice.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1">
                        subtotal R$ {option.subtotal.toFixed(2)} + frete R$ {option.deliveryFee.toFixed(2)} ={" "}
                        <strong>R$ {option.total.toFixed(2)}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <Button variant="ghost" className="w-full" onClick={leave}>
            Sair / começar de novo
          </Button>
        </>
      )}
    </main>
  );
}

function ParticipantRow({
  participant,
  hostId,
  isMe,
}: {
  participant: Participant;
  hostId: string;
  isMe: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">
        {participant.name}
        {participant.id === hostId && <span className="ml-1 text-xs font-bold text-primary">host</span>}
        {isMe && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {participant.answeredCount ?? 0} resp. · {participant.mcpConnectionStatus}
      </span>
    </li>
  );
}
