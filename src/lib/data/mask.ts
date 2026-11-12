import type { HiddenWinner, PublicWinner, Winner } from './types';

/**
 * 공개 전 데이터 마스킹.
 * SQL 의 get_public_awards() 와 같은 규칙을 따릅니다.
 * 공개 전인 사람은 id·순서·이름·소속만 남기고 사진/직급/제안 내용은 객체에서 아예 제거합니다.
 */
export function toPublicWinner(w: Winner): PublicWinner {
  if (!w.is_revealed) {
    const hidden: HiddenWinner = {
      id: w.id,
      display_order: w.display_order,
      name: w.name,
      dept: w.dept,
      is_revealed: false,
    };
    return hidden;
  }
  return {
    id: w.id,
    display_order: w.display_order,
    name: w.name,
    dept: w.dept,
    position: w.position,
    photo_url: w.photo_url,
    topic: w.topic,
    as_is: w.as_is,
    actions: w.actions,
    to_be: w.to_be,
    reflection: w.reflection,
    is_revealed: true,
  };
}

export function toPublicWinners(list: Winner[]): PublicWinner[] {
  return [...list].sort((a, b) => a.display_order - b.display_order).map(toPublicWinner);
}

export function isRevealed(w: PublicWinner): w is Extract<PublicWinner, { is_revealed: true }> {
  return w.is_revealed;
}
