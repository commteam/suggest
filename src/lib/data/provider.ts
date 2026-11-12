import type { DataProvider } from './DataProvider';
import { MockProvider } from './MockProvider';

function createProvider(): DataProvider {
  return new MockProvider();
}

export const provider: DataProvider = createProvider();
export const isDemo = provider.mode === 'demo';
