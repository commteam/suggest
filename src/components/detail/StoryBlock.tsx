import { STORY_PARTS } from './storyParts';
import { StoryText } from './StoryText';


interface BlockProps {
  eyebrow: string;
  label: string;
  text: string;
  step: number;
}

/** AS-IS / 추진 내용 / TO-BE 카드 */
export function StoryBlock({ eyebrow, label, text, step }: BlockProps) {
  return (
    <article className="card-blue relative rounded-xl p-5 sm:p-7" aria-label={label}>
      <header className="mb-3 flex items-baseline gap-3">
        <span className="eyebrow text-lg font-semibold sm:text-xl">{eyebrow}</span>
        <h3 className="font-serif text-base font-bold text-ink sm:text-lg">{label}</h3>
        <span aria-hidden className="ml-auto font-display text-sm text-muted italic">
          0{step}
        </span>
      </header>
      <StoryText text={text} className="text-[0.98rem] text-ink/95 sm:text-base" />
    </article>
  );
}

/** 카드 사이를 잇는 골드 세로선 + 화살표 */
export function FlowConnector() {
  return (
    <div aria-hidden className="flex h-12 flex-col items-center justify-center">
      <span className="h-full w-px bg-[linear-gradient(to_bottom,transparent,var(--c-accent),var(--c-accent))]" />
      <svg width="16" height="10" viewBox="0 0 16 10" className="-mt-px">
        <path d="M1 1l7 7 7-7" stroke="var(--c-accent)" strokeWidth="1.6" fill="none" />
      </svg>
    </div>
  );
}

/** AS-IS → 추진 내용 → TO-BE */
export function StoryFlow({ as_is, actions, to_be }: { as_is: string; actions: string; to_be: string }) {
  const texts = { as_is, actions, to_be };
  return (
    <div>
      {STORY_PARTS.map((p, i) => (
        <div key={p.key}>
          {i > 0 && <FlowConnector />}
          <StoryBlock eyebrow={p.eyebrow} label={p.label} text={texts[p.key]} step={i + 1} />
        </div>
      ))}
    </div>
  );
}

/** 진행 소감 — 인용문 마무리 카드 */
export function ReflectionCard({ text, name }: { text: string; name: string }) {
  return (
    <figure className="card-blue relative mt-10 overflow-hidden rounded-xl px-6 pt-7 pb-7 sm:px-10 sm:pt-8" aria-label="진행 소감">
      <p className="mb-4 flex items-baseline gap-3">
        <span className="eyebrow text-lg font-semibold sm:text-xl">REFLECTION</span>
        <span className="font-serif text-base font-bold text-ink sm:text-lg">진행 소감</span>
      </p>
      <span aria-hidden className="-mb-4 block h-12 font-serif text-7xl leading-none text-accent/80">“</span>
      <blockquote className="font-serif text-lg leading-relaxed text-ink italic sm:text-xl">
        <StoryText text={text} />
      </blockquote>
      <figcaption className="mt-5 text-right font-display text-base text-accent-light italic">— {name}</figcaption>
    </figure>
  );
}
