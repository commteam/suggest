import { describe, expect, it } from 'vitest';
import { countChars, parseStory } from './parseStory';

describe('parseStory', () => {
  it('빈 값은 빈 배열', () => {
    expect(parseStory('')).toEqual([]);
    expect(parseStory(null)).toEqual([]);
    expect(parseStory('   \n  \n')).toEqual([]);
  });

  it('줄바꿈은 문단 안의 줄로 보존', () => {
    expect(parseStory('첫 줄\n둘째 줄')).toEqual([{ type: 'p', lines: ['첫 줄', '둘째 줄'] }]);
  });

  it('빈 줄은 문단을 나눔', () => {
    expect(parseStory('가\n\n나')).toEqual([
      { type: 'p', lines: ['가'] },
      { type: 'p', lines: ['나'] },
    ]);
  });

  it('"- " 줄은 불릿 목록으로 묶음', () => {
    expect(parseStory('요약\n- 하나\n- 둘\n마무리')).toEqual([
      { type: 'p', lines: ['요약'] },
      { type: 'ul', items: ['하나', '둘'] },
      { type: 'p', lines: ['마무리'] },
    ]);
  });

  it('하이픈 뒤 공백이 없으면 불릿이 아님 (예: -5%)', () => {
    expect(parseStory('-5% 감소')).toEqual([{ type: 'p', lines: ['-5% 감소'] }]);
  });

  it('CRLF 와 • 기호도 처리', () => {
    expect(parseStory('• a\r\n• b')).toEqual([{ type: 'ul', items: ['a', 'b'] }]);
  });

  it('HTML 은 해석하지 않고 문자열 그대로 둠', () => {
    expect(parseStory('<img src=x onerror=alert(1)>')).toEqual([{ type: 'p', lines: ['<img src=x onerror=alert(1)>'] }]);
  });

  it('글자 수는 줄바꿈 제외', () => {
    expect(countChars('가나\n다')).toBe(3);
    expect(countChars('a b')).toBe(3);
  });
});
