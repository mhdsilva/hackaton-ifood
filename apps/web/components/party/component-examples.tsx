"use client";

import { useState } from "react";
import { AddressOption } from "@/components/party/address-option";
import { ParticipantList } from "@/components/party/participant-list";
import { QuestionProgress } from "@/components/party/question-progress";
import { getMockAddresses, getMockParty } from "@/lib/mock-party";

export function PartyComponentExamples() {
  const [snapshot] = useState(getMockParty);
  const [addresses] = useState(getMockAddresses);
  const [selectedId, setSelectedId] = useState(addresses[0]?.id ?? "");

  return (
    <section aria-labelledby="party-components-title" className="rounded-xl border bg-card p-6 sm:p-8">
      <h2 id="party-components-title" className="text-xl font-semibold">Componentes da Party</h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-bold">Participantes</h3>
          <ParticipantList participants={snapshot.participants} hostId={snapshot.party.hostParticipantId} currentParticipantId={snapshot.party.hostParticipantId} />
          <h3 className="font-bold">Progresso</h3>
          <QuestionProgress current={1} total={7} />
        </div>
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-4 font-bold">Seleção de endereço · dados simulados</legend>
          {addresses.map((address) => <AddressOption key={address.id} address={address} selected={address.id === selectedId} onSelect={setSelectedId} />)}
        </fieldset>
      </div>
    </section>
  );
}
