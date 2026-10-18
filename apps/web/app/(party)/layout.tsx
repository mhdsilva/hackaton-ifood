import { LivePartyProvider } from "@/components/party/live-party-provider";

export default function PartyLayout({ children }: { children: React.ReactNode }) {
  return <LivePartyProvider>{children}</LivePartyProvider>;
}
