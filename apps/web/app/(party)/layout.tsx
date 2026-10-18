import { PartyProvider } from "@/components/party/party-provider";
import { QuestionNavigationProvider } from "@/components/party/question-navigation";

export default function PartyLayout({ children }: { children: React.ReactNode }) {
  return <PartyProvider><QuestionNavigationProvider>{children}</QuestionNavigationProvider></PartyProvider>;
}
