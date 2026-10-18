"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuestionRouter } from "@/components/party/question-navigation";
import { Button } from "@/components/ui/button";
import { AddressOption } from "@/components/party/address-option";
import { useParty } from "@/components/party/party-provider";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";

export function AddressScreen() {
  const { addresses, addressesLive, addressesLoading, addressesError, selectedAddressId, setSelectedAddressId } =
    useParty();
  const router = useQuestionRouter();
  const hasSelection = addresses.some((address) => address.id === selectedAddressId);

  return (
    <PartyShell backHref="/" footer={<Button type="submit" form="address-form" size="party" className="w-full" disabled={!hasSelection}>Continuar</Button>}>
      <QuestionIntroduction id="address-title" step={1} title="Onde você vai curtir a party hoje?" description="Usaremos a região para encontrar opções da mesma temática perto de você, mesmo longe dos amigos." />
      <form id="address-form" onSubmit={(event) => {
        event.preventDefault();
        if (hasSelection) router.push("/party/restrictions");
      }}>
        <fieldset className="min-w-0">
          <legend className="mb-4 text-base leading-6 font-bold">
            {addressesLive ? "Seus endereços salvos" : "Endereços de exemplo"}
          </legend>
          {addressesLoading && <p role="status" className="mb-2 text-sm text-muted-foreground">Carregando seus endereços do iFood...</p>}
          {addressesError && <p role="alert" className="mb-2 text-sm text-destructive">{addressesError}</p>}
          <div className="space-y-2">
            {addresses.map((address) => <AddressOption key={address.id} address={address} selected={selectedAddressId === address.id} onSelect={setSelectedAddressId} />)}
          </div>
          {!addressesLoading && addresses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {addressesLive
                ? "Nenhum endereço salvo no iFood. Adicione um endereço para continuar."
                : "Nenhum endereço disponível. Conecte sua conta do iFood no lobby para carregar seus endereços."}
            </p>
          )}
        </fieldset>
        {!addressesLive && !addressesLoading && (
          <p className="mt-4 rounded-lg border border-dashed p-3 text-xs leading-[normal] text-muted-foreground">
            Estes endereços não vêm do iFood. Conecte sua conta no lobby para usar os endereços reais
            da sua conta.
          </p>
        )}
        <Button asChild variant="link" className="mt-4 h-auto min-h-[50px] justify-start gap-3 p-0 text-base font-bold whitespace-normal">
          <Link href="/party/pending/new-address"><Image src="/figma/plus.svg" alt="" width={24} height={24} />Adicionar novo endereço</Link>
        </Button>
      </form>
    </PartyShell>
  );
}
