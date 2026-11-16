import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';

// Which variant of a chart's title/subtitle/artist to show. Charts carry both the native
// value and a romanized (romaji) transliteration; the romaji fields are "" when the simfile
// has no translit tag, so each mode falls back to the other variant when its own is empty.
export type TitleDisplay = 'romanized' | 'native';

type TitleDisplayState = {
  titleDisplay: TitleDisplay;
  setTitleDisplay: (titleDisplay: TitleDisplay) => void;
};

const TitleDisplayContext = createContext<TitleDisplayState | undefined>(undefined);

export function TitleDisplayProvider({ children }: { children: ReactNode }) {
  // Defaults to romanized - the app's behavior before this was configurable.
  const [titleDisplay, setTitleDisplay] = useLocalStorageState<TitleDisplay>(
    'itl-curation-title-display',
    'romanized',
  );
  return (
    <TitleDisplayContext.Provider value={{ titleDisplay, setTitleDisplay }}>
      {children}
    </TitleDisplayContext.Provider>
  );
}

export function useTitleDisplay() {
  const context = useContext(TitleDisplayContext);
  if (context === undefined) {
    throw new Error('useTitleDisplay must be used within a TitleDisplayProvider');
  }
  return context;
}

export type PickTitle = (native: string, romaji: string) => string;

// Returns a picker choosing between a field's native and romaji values per the user's
// Song Title Display setting, e.g. `pick(chart.title, chart.titleRomaji)`.
export function useDisplayTitle(): PickTitle {
  const { titleDisplay } = useTitleDisplay();
  return useCallback(
    (native: string, romaji: string) =>
      titleDisplay === 'native' ? native || romaji : romaji || native,
    [titleDisplay],
  );
}
