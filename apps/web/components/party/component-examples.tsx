"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FlipDigit } from "@/components/party/flip-digit";
import { OrderDetailCard } from "@/components/party/order-detail-card";
import { RetrospectiveStats } from "@/components/party/retrospective-stats";
import { getMockRetrospective } from "@/lib/mock-retrospective";
import { AddressOption } from "@/components/party/address-option";
import Link from "next/link";
import { ParticipantAvatar, ParticipantList } from "@/components/party/participant-list";
import { getMockPreparationGroup } from "@/lib/mock-preparation";
import { QuestionProgress } from "@/components/party/question-progress";
import { SegmentedProgress } from "@/components/party/segmented-progress";
import { RestrictionChoices } from "@/components/party/restriction-choices";
import { BudgetChoices } from "@/components/party/budget-choices";
import { QuestionChoices } from "@/components/party/question-choices";
import { getMockAddresses, getMockParty } from "@/lib/mock-party";
import { getMockBudgetOptions, getMockDesireOptions, getMockPreferenceQuestion, getMockRestrictionOptions, MAX_MOCK_DESIRES, MOCK_QUESTIONNAIRE_STEPS, toggleMockDesire, type BudgetOptionId, type DesireId, type RestrictionId } from "@/lib/mock-questionnaire";

export function PartyComponentExamples() {
  const [snapshot] = useState(getMockParty);
  const [preparationGroup] = useState(getMockPreparationGroup);
  const [addresses] = useState(getMockAddresses);
  const [selectedId, setSelectedId] = useState(addresses[0]?.id ?? "");
  const [restrictions, setRestrictions] = useState<RestrictionId[]>([]);
  const [otherRestriction, setOtherRestriction] = useState("");
  const [budgetId, setBudgetId] = useState<BudgetOptionId | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [energy, setEnergy] = useState<string | null>(null);
  const [desires, setDesires] = useState<DesireId[]>([]);
  const [progressStep, setProgressStep] = useState(1);
  const [flip, setFlip] = useState({ value: 3, previous: 3 });
  const retrospective = getMockRetrospective(snapshot);

  return (
    <section aria-labelledby="party-components-title" className="rounded-xl border bg-card p-6 sm:p-8">
      <h2 id="party-components-title" className="text-xl font-semibold">Componentes da Party</h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-bold">Participantes</h3>
          <ParticipantList participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} currentParticipantId={snapshot.party.hostParticipantId} />
          <h3 className="font-bold">Progresso</h3>
          <QuestionProgress key={progressStep} current={progressStep} total={MOCK_QUESTIONNAIRE_STEPS} />
          <Button variant="outline" onClick={() => setProgressStep((step) => step % MOCK_QUESTIONNAIRE_STEPS + 1)}>Avançar progresso</Button>
          <p className="text-sm text-muted-foreground">Preparação · preenchimento de três segundos</p>
          <SegmentedProgress key={`preparation-${progressStep}`} current={(progressStep - 1) % 3 + 1} total={3} label="Exemplo de preparação simulada" duration={3000} />
        </div>
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-4 font-bold">Seleção de endereço · dados simulados</legend>
          {addresses.map((address) => <AddressOption key={address.id} address={address} selected={address.id === selectedId} onSelect={setSelectedId} />)}
        </fieldset>
        <RestrictionChoices options={getMockRestrictionOptions()} selected={restrictions} onToggle={(id) => setRestrictions((current) => current.includes(id as RestrictionId) ? current.filter((value) => value !== id) : [...current, id as RestrictionId])} otherId="other" other={otherRestriction} onOtherChange={setOtherRestriction} inputId="example-other-restriction" />
        <BudgetChoices options={getMockBudgetOptions()} selected={budgetId} onSelect={(id) => setBudgetId(id as BudgetOptionId)} otherId="other" customValue={customBudget} onCustomChange={setCustomBudget} inputId="example-custom-budget" />
        <QuestionChoices name="example-energy" legend="Escolha única" options={getMockPreferenceQuestion("energy").options} selected={energy ? [energy] : []} onSelect={setEnergy} />
        <QuestionChoices name="example-desires" legend="Desejos · uma ou duas escolhas" options={getMockDesireOptions()} selected={desires} onSelect={(id) => setDesires((current) => toggleMockDesire(current, id))} multiple maxSelections={MAX_MOCK_DESIRES} />
        <div className="space-y-2">
          <h3 className="font-bold">Conclusão individual · simulação</h3>
          <ParticipantList participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} currentParticipantId={snapshot.party.hostParticipantId} readyParticipantIds={[snapshot.party.hostParticipantId]} />
        </div>
        <div className="space-y-4">
          <h3 className="font-bold">Preparação · participantes simulados</h3>
          {(["orbit", "connected"] as const).map((variant) => <div key={variant} className="space-y-2">
            <p className="text-sm text-muted-foreground">{variant === "orbit" ? "Ao redor da ilustração" : "Conectados"}</p>
            <ul className="flex flex-wrap gap-[10px]">
              {preparationGroup.participants.map((participant) => <li key={participant.id} aria-label={participant.name}>
                <ParticipantAvatar name={participant.name} isHost={participant.id === preparationGroup.hostId} variant={variant} className="size-[42px] text-[16.8px]" />
              </li>)}
            </ul>
          </div>)}
          <Link href="/party/preparing" className="inline-block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Testar as três etapas de preparação</Link>
          <Link href="/party/countdown" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Testar a contagem 3 → 2 → 1</Link>
          <Link href="/party/reveal" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Testar a revelação da temática</Link>
          <Link href="/party/unboxing" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Testar a entrada e saída da sacola</Link>
          <Link href="/party/order" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Testar o resumo do pedido simulado</Link>
          <Link href="/party/confirmed" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Testar a confirmação simulada do pedido</Link>
          <Link href="/party/retrospective" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Retrospectiva · Party concluída</Link>
          <Link href="/party/retrospective?preview=waiting" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Retrospectiva · aguardando entregas</Link>
          <Link href="/party/retrospective?preview=no-distance" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Retrospectiva · distância indisponível</Link>
          <Link href="/party/retrospective?preview=empty" className="block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Retrospectiva · sem resumo</Link>
          {retrospective.summary && <RetrospectiveStats summary={retrospective.summary} />}
          <OrderDetailCard icon="/figma/order-motorbike.svg" title="Entrega hoje" detail="Hoje, 35 - 45 min" />
        </div>
        <div className="space-y-4 text-center">
          <h3 className="font-bold">Contagem · split-flap</h3>
          <FlipDigit value={flip.value} previous={flip.previous} />
          <Button variant="outline" onClick={() => setFlip(({ value }) => ({ previous: value, value: value > 1 ? value - 1 : 3 }))}>Trocar número</Button>
        </div>
      </div>
    </section>
  );
}
