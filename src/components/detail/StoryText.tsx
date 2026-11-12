import { Fragment } from 'react';
import { parseStory } from '@/lib/text/parseStory';
import { cn } from '@/lib/utils';

/** 줄바꿈과 "- " 불릿을 살려서 텍스트 노드로만 렌더링 */
export function StoryText({ text, className }: { text: string; className?: string }) {
  const nodes = parseStory(text);
  if (nodes.length === 0) return <p className={cn('text-muted', className)}>내용이 없습니다.</p>;
  return (
    <div className={cn('space-y-3 leading-relaxed', className)}>
      {nodes.map((n, i) =>
        n.type === 'p' ? (
          <p key={i}>
            {n.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {l}
              </Fragment>
            ))}
          </p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {n.items.map((it, j) => (
              <li key={j} className="relative pl-5">
                <span aria-hidden className="absolute top-[0.62em] left-1 h-1.5 w-1.5 rotate-45 bg-accent" />
                {it}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
