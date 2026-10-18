"use client";

import { useState } from "react";
import { AddressOption } from "@/components/party/address-option";
import Link from "next/link";
import { ParticipantAvatar, ParticipantList } from "@/components/party/participant-list";
import { getMockPreparationGroup } from "@/lib/mock-preparation";
import { QuestionProgress } from "@/components/party/question-progress";
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

  return (
    <section aria-labelledby="party-components-title" className="rounded-xl border bg-card p-6 sm:p-8">
      <h2 id="party-components-title" className="text-xl font-semibold">Componentes da Party</h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-bold">Participantes</h3>
          <ParticipantList participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} currentParticipantId={snapshot.party.hostParticipantId} />
          <h3 className="font-bold">Progresso</h3>
          <QuestionProgress current={1} total={MOCK_QUESTIONNAIRE_STEPS} />
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
        </div>
      </div>
    </section>
  );
}
