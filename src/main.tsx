import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nanum-myeongjo/400.css';
import '@fontsource/nanum-myeongjo/700.css';
import '@fontsource/nanum-myeongjo/800.css';
import '@fontsource/gowun-dodum/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
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
