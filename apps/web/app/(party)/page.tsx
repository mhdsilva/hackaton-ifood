import { Suspense } from "react";
import { PartyEntry, PartyEntryLoading } from "@/components/party/party-entry";

export default function HomePage() {
  return <Suspense fallback={<PartyEntryLoading />}><PartyEntry /></Suspense>;
}
