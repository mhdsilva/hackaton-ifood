import type { Participant } from "@sidequest/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ParticipantAvatar({ name, isHost, variant = "default", className }: {
  name: string;
  isHost: boolean;
  variant?: "default" | "orbit" | "connected";
  className?: string;
}) {
  const colors = variant === "orbit"
    ? (isHost ? "bg-foreground text-primary" : "bg-secondary text-foreground")
    : variant === "connected"
      ? (isHost ? "bg-primary text-primary-foreground" : "bg-foreground text-background")
      : (isHost ? "bg-primary text-primary-foreground" : "bg-foreground text-primary");
  return (
    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full font-bold", colors, className)}>
      {name.slice(0, 1).toLocaleUpperCase("pt-BR")}
    </span>
  );
}

export function ParticipantList({ participants, hostId, currentParticipantId, readyParticipantIds }: {
  participants: Participant[];
  hostId: string;
  currentParticipantId: string;
  readyParticipantIds?: readonly string[];
}) {
  return (
    <ul>
      {participants.map((participant) => {
        const isHost = participant.id === hostId;
        const isCurrent = participant.id === currentParticipantId;
        const authenticated = participant.mcpConnectionStatus === "connected";
        const authenticating = participant.mcpConnectionStatus === "validating";
        return (
          <li key={participant.id} className="flex min-h-[62px] items-center gap-3 border-b py-2">
            <ParticipantAvatar name={participant.name} isHost={isHost} className={isCurrent ? "bg-primary text-primary-foreground" : "bg-foreground text-primary"} />
            <span className="min-w-0 flex-1 break-words">{participant.name}{isHost ? " (Host)" : ""}{isCurrent && <span className="sr-only"> (Você)</span>}</span>
            {readyParticipantIds ? <Badge variant={readyParticipantIds.includes(participant.id) ? "solid" : "muted"}>
              {readyParticipantIds.includes(participant.id) ? "Pronto" : "Aguardando..."}
            </Badge> : <Badge variant={authenticated ? "soft" : "muted"}>
              {authenticated ? "Autenticado" : authenticating ? "Autenticando-se" : participant.mcpConnectionStatus === "error" ? "Falha no login" : "Não autenticado"}
            </Badge>}
          </li>
        );
      })}
    </ul>
  );
}
