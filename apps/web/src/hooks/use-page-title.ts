import { useEffect } from 'react';

const DEFAULT_TITLE = 'ITL Curation';

// Lets the current page override the browser tab title, reverting to the app default when the
// page unmounts or while title is null (e.g. still loading).
export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ?? DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
