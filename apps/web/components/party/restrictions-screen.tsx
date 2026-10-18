"use client";

import { useQuestionRouter } from "@/components/party/question-navigation";
import { Button } from "@/components/ui/button";
import { useParty } from "@/components/party/party-provider";
import { PartyShell } from "@/components/party/party-shell";
import { QuestionIntroduction } from "@/components/party/question-introduction";
import { RestrictionChoices } from "@/components/party/restriction-choices";

export function RestrictionsScreen() {
  const { restrictionOptions, restrictions, toggleRestriction, otherRestriction, setOtherRestriction, usingLiveCatalog } = useParty();
  const router = useQuestionRouter();
  const otherId = usingLiveCatalog ? "outro" : "other";
  const canContinue = !restrictions.includes(otherId) || otherRestriction.trim().length > 0;

  return (
    <PartyShell backHref="/party/address" footer={<Button type="submit" form="restrictions-form" size="party" className="w-full" disabled={!canContinue}>Continuar</Button>}>
      <QuestionIntroduction id="restrictions-title" step={2} title="Antes, você possui alguma restrição?" description="Restrições vêm antes das preferências. A restrição é individual, e não do grupo." />
      <form id="restrictions-form" onSubmit={(event) => { event.preventDefault(); if (canContinue) router.push("/party/budget"); }}>
        <RestrictionChoices options={restrictionOptions} selected={restrictions} onToggle={toggleRestriction} otherId={otherId} other={otherRestriction} onOtherChange={setOtherRestriction} inputId="other-restriction" />
      </form>
    </PartyShell>
  );
}
