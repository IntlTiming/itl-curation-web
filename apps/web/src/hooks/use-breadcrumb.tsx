import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const BreadcrumbLabelContext = createContext<{
  label: string | null;
  setLabel: (label: string | null) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  return (
    <BreadcrumbLabelContext.Provider value={{ label, setLabel }}>
      {children}
    </BreadcrumbLabelContext.Provider>
  );
}

export function useBreadcrumbLabel() {
  const ctx = useContext(BreadcrumbLabelContext);
  if (!ctx) throw new Error('useBreadcrumbLabel must be used within a BreadcrumbProvider');
  return ctx.label;
}

// Lets the current page announce its own breadcrumb label (e.g. an event's
// name once it loads), clearing it again when the page unmounts.
export function usePageBreadcrumb(label: string | null) {
  const ctx = useContext(BreadcrumbLabelContext);
  if (!ctx) throw new Error('usePageBreadcrumb must be used within a BreadcrumbProvider');
  const { setLabel } = ctx;

  useEffect(() => {
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
}
