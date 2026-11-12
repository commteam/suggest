export type StoryNode = { type: 'p'; lines: string[] } | { type: 'ul'; items: string[] };

const BULLET = /^\s*[-•·]\s+(.*)$/;

/**
 * 관리자가 입력한 일반 텍스트를 안전한 블록 구조로 변환합니다.
 * - 빈 줄: 문단 구분
 * - "- " 로 시작하는 줄: 불릿 목록 (연속된 줄은 하나의 목록)
 * - 그 외 줄바꿈은 문단 안의 줄로 보존
 * HTML 은 해석하지 않습니다(렌더링 시 텍스트 노드로만 출력).
 */
export function parseStory(input: string | null | undefined): StoryNode[] {
  if (!input) return [];
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const nodes: StoryNode[] = [];
  let current: StoryNode | null = null;

  const flush = () => {
    if (current) nodes.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') {
      flush();
      continue;
    }
    const m = BULLET.exec(line);
    if (m) {
      if (current?.type !== 'ul') {
        flush();
        current = { type: 'ul', items: [] };
      }
      current.items.push(m[1].trim());
    } else {
      if (current?.type !== 'p') {
        flush();
        current = { type: 'p', lines: [] };
      }
      current.lines.push(line.trim());
    }
  }
  flush();
  return nodes;
}

/** 글자 수(공백 포함, 줄바꿈 제외) */
export function countChars(input: string): number {
  return input.replace(/\r?\n/g, '').length;
}
