import { createContext, useContext } from 'react';

export interface SoundPref {
  enabled: boolean;
  toggle: () => void;
}

export const SoundPrefContext = createContext<SoundPref>({ enabled: true, toggle: () => undefined });

export function useSoundPref() {
  return useContext(SoundPrefContext);
}
