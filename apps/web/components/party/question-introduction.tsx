import { QuestionProgress } from "@/components/party/question-progress";
import { MOCK_QUESTIONNAIRE_STEPS } from "@/lib/mock-questionnaire";

export function QuestionIntroduction({ id, step, title, description }: {
  id: string;
  step: number;
  title: string;
  description?: string;
}) {
  return (
    <section className="space-y-4" aria-labelledby={id}>
      <QuestionProgress current={step} total={MOCK_QUESTIONNAIRE_STEPS} />
      <div className="question-copy space-y-4">
        <h1 id={id} className="text-3xl leading-[1.12] font-bold">{title}</h1>
        {description && <p className="text-sm leading-5 text-secondary-foreground">{description}</p>}
      </div>
    </section>
  );
}
