export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PHOTO_MAX_EDGE = 1200;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_INPUT_MAX_BYTES = 25 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** 출력 크기 계산: 긴 변이 maxEdge 를 넘지 않게 비율 유지 */
export function fitSize(w: number, h: number, maxEdge = PHOTO_MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.'));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** 크롭 영역을 잘라 최대 1200px 로 리사이즈하고 WebP 로 변환 (미지원 브라우저는 JPEG) */
export async function cropAndEncode(src: string, area: PixelArea): Promise<Blob> {
  const img = await loadImage(src);
  const { width, height } = fitSize(area.width, area.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 사진을 편집할 수 없습니다.');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0b1430';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height);
  for (const q of [0.88, 0.78, 0.65, 0.5]) {
    let blob = await toBlob(canvas, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', q);
    if (blob && blob.size <= PHOTO_MAX_BYTES) return blob;
  }
  throw new Error('사진 용량이 너무 큽니다. (최대 5MB)');
}
