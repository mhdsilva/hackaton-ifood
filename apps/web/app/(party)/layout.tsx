import { MockPartyProvider } from "@/components/party/mock-party-provider";

export default function PartyLayout({ children }: { children: React.ReactNode }) {
  return <MockPartyProvider>{children}</MockPartyProvider>;
}
