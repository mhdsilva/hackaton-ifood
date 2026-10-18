export function FlipDigit({ value, previous = value }: { value: number; previous?: number }) {
  const changing = previous !== value;

  return (
    <div key={value} className="flip-digit" data-changing={changing} aria-hidden="true">
      <span className="flip-half flip-top flip-next-top"><span>{value}</span></span>
      <span className="flip-half flip-bottom flip-old-bottom"><span>{previous}</span></span>
      {changing && <>
        <span className="flip-half flip-top flip-falling-top"><span>{previous}</span></span>
        <span className="flip-half flip-bottom flip-falling-bottom"><span>{value}</span></span>
      </>}
    </div>
  );
}
