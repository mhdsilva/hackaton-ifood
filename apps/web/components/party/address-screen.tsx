"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddressOption } from "@/components/party/address-option";
import { useMockParty } from "@/components/party/mock-party-provider";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionProgress } from "@/components/party/question-progress";

export function AddressScreen() {
  const { addresses, selectedAddressId, setSelectedAddressId } = useMockParty();
  const router = useRouter();
  const hasSelection = addresses.some((address) => address.id === selectedAddressId);

  return (
    <PartyShell backHref="/" footer={<Button type="submit" form="address-form" size="party" className="w-full" disabled={!hasSelection}>Continuar</Button>}>
      <section className="space-y-4" aria-labelledby="address-title">
        <QuestionProgress current={1} total={7} />
        <h1 id="address-title" className="text-3xl leading-[1.12] font-bold">Onde você vai curtir a party hoje?</h1>
        <p className="text-sm leading-5 text-secondary-foreground">Usaremos a região para encontrar opções da mesma temática perto de você, mesmo longe dos amigos.</p>
      </section>
      <form id="address-form" onSubmit={(event) => {
        event.preventDefault();
        if (hasSelection) router.push("/party/pending/next-question");
      }}>
        <fieldset className="min-w-0">
          <legend className="mb-4 text-base leading-6 font-bold">Seus endereços salvos</legend>
          <div className="space-y-2">
            {addresses.map((address) => <AddressOption key={address.id} address={address} selected={selectedAddressId === address.id} onSelect={setSelectedAddressId} />)}
          </div>
          {addresses.length === 0 && <p className="text-sm text-muted-foreground">Nenhum endereço salvo. Adicione um endereço para continuar.</p>}
        </fieldset>
        <Button asChild variant="link" className="mt-4 h-auto min-h-[50px] justify-start gap-3 p-0 text-base font-bold whitespace-normal">
          <Link href="/party/pending/new-address"><Image src="/figma/plus.svg" alt="" width={24} height={24} />Adicionar novo endereço</Link>
        </Button>
      </form>
    </PartyShell>
  );
}
