import type { PartyRetrospectiveResponse, PartyRetrospectiveSummary, PartySnapshot } from "@sidequest/contracts";
import { revealTheme } from "@/lib/reveal-theme";

export type RetrospectivePreview = "ready" | "waiting" | "no-distance" | "empty";

// Respostas locais no formato de GET /parties/:id/retrospective.
// A distância é ilustrativa: não é calculada a partir dos endereços da sessão.
export function getMockRetrospective(snapshot: PartySnapshot, preview: RetrospectivePreview = "ready"): PartyRetrospectiveResponse {
  if (preview === "waiting") return { state: "waiting_for_deliveries", pendingDeliveryCount: 1 };
  if (preview === "empty" || snapshot.participants.length === 0) return { state: "ready", pendingDeliveryCount: 0 };
  const participantCount = snapshot.participants.length;
  return {
    state: "ready",
    pendingDeliveryCount: 0,
    summary: {
      partyName: snapshot.party.name,
      theme: snapshot.party.theme ?? "italiano",
      participantCount,
      completedOrderCount: participantCount,
      itemCount: participantCount * 3,
      merchantCount: Math.min(participantCount, 3),
      ...(preview !== "no-distance" && participantCount > 1 ? { maxDistanceKm: 312.6 } : {}),
    },
  };
}

export function retrospectiveThemeLabel(theme?: string): string {
  if (!theme) return "Uma temática em comum";
  const copy = revealTheme({ theme });
  return `${copy.introduction} ${copy.emphasis}`;
}

export function buildRetrospectiveShareText(summary: PartyRetrospectiveSummary): string {
  const lines = [
    `${summary.partyName} · iFood Party`,
    "Cada um no seu canto. Todo mundo na mesma vibe.",
    retrospectiveThemeLabel(summary.theme),
    `${summary.participantCount} pessoas · ${summary.completedOrderCount} pedidos concluídos · ${summary.itemCount} itens · ${summary.merchantCount} restaurantes`,
  ];
  if (summary.maxDistanceKm !== undefined) {
    lines.push(`Maior distância entre nós: ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(summary.maxDistanceKm)} km, aproximadamente, em linha reta.`);
  }
  return lines.join("\n");
}
