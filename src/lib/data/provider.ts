import type { DataProvider } from './DataProvider';
import { MockProvider } from './MockProvider';
import { SupabaseProvider } from './SupabaseProvider';

/**
 * VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY 가 있으면 Supabase 모드,
 * 없으면 데모 모드(localStorage). UI 는 같습니다.
 */
function createProvider(): DataProvider {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (url && key) return new SupabaseProvider(url, key);
  return new MockProvider();
}

export const provider: DataProvider = createProvider();
export const isDemo = provider.mode === 'demo';
