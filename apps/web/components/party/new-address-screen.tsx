"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AddressCandidate } from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectionCard } from "@/components/ui/selection-card";
import { useParty } from "@/components/party/live-party-provider";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { describeError } from "@/lib/api-client";

/**
 * Tela provisória, sem desenho do Júlio: busca o endereço no iFood
 * (`POST /addresses/resolve`), deixa escolher o candidato e salva (`POST /addresses`).
 * Sem conta conectada a API recusa — a mensagem vem do backend, sem simular sucesso.
 */
export function NewAddressScreen() {
  const { findAddressCandidates, saveAddress } = useParty();
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [candidates, setCandidates] = useState<AddressCandidate[] | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [busy, setBusy] = useState<"search" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!address.trim() || busy) return;
    setBusy("search");
    setError(null);
    setCandidates(null);
    setSelectedCandidateId(null);
    try {
      const result = await findAddressCandidates(address.trim());
      setCandidates(result.candidates);
      setSimulated(result.simulated);
      setSelectedCandidateId(result.matchConfidence === "SINGLE" ? result.candidates[0]?.candidateId ?? null : null);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const candidate = candidates?.find((entry) => entry.candidateId === selectedCandidateId);
    if (!candidate || busy) return;
    setBusy("save");
    setError(null);
    try {
      const saved = await saveAddress({
        address: address.trim(),
        candidateId: candidate.candidateId,
        ...(candidate.neighborhood ? { neighborhood: candidate.neighborhood } : {}),
      });
      if (saved) router.push("/party/address");
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <PartyShell
      backHref="/party/address"
      footer={
        <Button size="party" className="w-full" disabled={!selectedCandidateId || busy !== null} onClick={save}>
          {busy === "save" ? "Salvando..." : "Usar este endereço"}
        </Button>
      }
    >
      <QuestionIntroduction
        id="new-address-title"
        step={1}
        title="Adicionar novo endereço"
        description="Buscamos o endereço na sua conta do iFood para garantir que a entrega chegue no lugar certo."
      />
      <form className="space-y-4" onSubmit={search}>
        <label className="block space-y-2">
          <span className="text-base leading-6 font-bold">Endereço completo</span>
          <Input
            aria-label="Endereço completo"
            placeholder="Rua, número, bairro e cidade"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            required
          />
        </label>
        <Button type="submit" size="party" variant="outline" className="w-full" disabled={busy !== null || !address.trim()}>
          {busy === "search" ? "Buscando..." : "Buscar endereço"}
        </Button>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {simulated && <p className="text-xs text-muted-foreground">Busca simulada: nenhuma conta real do iFood foi consultada.</p>}

      {candidates !== null && (
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-base leading-6 font-bold">
            {candidates.length === 0 ? "Nenhum endereço encontrado" : "Confirme o endereço"}
          </legend>
          {candidates.length === 0 && (
            <p className="text-sm text-muted-foreground">Não encontramos esse endereço. Tente incluir número, bairro e cidade.</p>
          )}
          {candidates.map((candidate) => (
            <SelectionCard
              key={candidate.candidateId}
              name="address-candidate"
              value={candidate.candidateId}
              checked={selectedCandidateId === candidate.candidateId}
              onSelect={() => setSelectedCandidateId(candidate.candidateId)}
            >
              <span className="min-w-0 flex-1 space-y-[3px]">
                <span className="block text-[15px] leading-[21px] font-medium">{candidate.formattedAddress}</span>
                {(candidate.neighborhood || candidate.city) && (
                  <span className="block text-xs leading-[normal] text-muted-foreground">
                    {[candidate.neighborhood, candidate.city, candidate.state].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </SelectionCard>
          ))}
        </fieldset>
      )}
    </PartyShell>
  );
}
