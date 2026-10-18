import type { Participant } from "@sidequest/contracts";
import { getMockParty } from "@/lib/mock-party";

export const MOCK_PREPARATION_STAGE_MS = 3000;

const preparationStages = [
  { title: "Cruzando as escolhas dos participantes...", image: "/figma/preparing-choices.svg", width: 193, height: 200 },
  { title: "Explorando opções perto de cada pessoa...", image: "/figma/preparing-local-options.svg", width: 194, height: 200 },
  { title: "Preparando a experiência de hoje...", image: "/figma/preparing-experience.svg", width: 194, height: 200 },
] as const;

export type PreparationStage = (typeof preparationStages)[number];
export type PreparationParticipant = Pick<Participant, "id" | "name">;

export function getMockPreparationStages() { return preparationStages; }

// Grupo ilustrativo de quatro pessoas, solicitado para esta prévia do Figma.
export function getMockPreparationGroup() {
  const snapshot = getMockParty();
  const names = ["Júlio", "Lucas", "Otávio", "Matheus"];
  const participants: PreparationParticipant[] = names.map((name, index) => ({
    id: snapshot.participants[index]?.id ?? `mock-preparation-${index}`,
    name,
  }));
  return { participants, hostId: snapshot.party.hostParticipantId };
}
