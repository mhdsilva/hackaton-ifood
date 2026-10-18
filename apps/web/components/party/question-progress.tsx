export function QuestionProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 font-bold">Etapa {current} de {total}</p>
      <div role="progressbar" aria-label="Progresso do questionário simulado" aria-valuemin={0} aria-valuemax={total} aria-valuenow={current} className="flex h-[5px] gap-1">
        {Array.from({ length: total }, (_, index) => <span key={index} className={`h-full flex-1 rounded-full ${index < current ? "bg-primary" : "bg-secondary"}`} />)}
      </div>
    </div>
  );
}
