import { SegmentedProgress } from "@/components/party/segmented-progress";

export function QuestionProgress({ current, total }: { current: number; total: number }) {
  return (
    <div data-question-progress className="space-y-2">
      <p className="text-xs leading-5 font-bold">Etapa {current} de {total}</p>
      <SegmentedProgress current={current} total={total} label="Progresso do questionário" />
    </div>
  );
}
