import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Pretendard 가변 글꼴(한글 포함 동적 서브셋, font-display: swap) — 자체 호스팅, 외부 글꼴 주소 없음
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/index.css';
import App from './App';
import { initTeamsIfEmbedded } from './lib/teams/teams';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Microsoft Teams 안에서 열렸을 때만 SDK 초기화 (일반 브라우저에는 영향 없음, 실패해도 화면은 그대로)
void initTeamsIfEmbedded();
