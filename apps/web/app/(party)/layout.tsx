import { PartyProvider } from "@/components/party/party-provider";

export default function PartyLayout({ children }: { children: React.ReactNode }) {
  return <PartyProvider>{children}</PartyProvider>;
}
