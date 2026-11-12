import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

/** 로컬 `vite preview` 도 배포(vercel.json)와 같은 보안 헤더(CSP 등)로 띄워 E2E 를 실제와 같게 */
function deployHeaders(): Record<string, string> {
  try {
    const v = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'vercel.json'), 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const all = v.headers.find((h) => h.source === '/(.*)');
    return Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
  } catch {
    return {};
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { headers: deployHeaders() },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('@microsoft/teams-js')) return 'teams-js'; // Teams 안에서만 동적으로 로드
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('framer-motion') || id.includes('motion-dom')) return 'motion';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
});
