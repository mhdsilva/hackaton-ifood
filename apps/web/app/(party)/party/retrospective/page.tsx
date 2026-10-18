import { Suspense } from "react";
import { RetrospectiveScreen } from "@/components/party/retrospective-screen";

export const metadata = { title: "Nossa Party em números | iFood Party" };

export default function RetrospectivePage() {
  return <Suspense fallback={<div role="status" className="grid min-h-dvh place-items-center text-muted-foreground">Reunindo os momentos da Party...</div>}><RetrospectiveScreen /></Suspense>;
}
