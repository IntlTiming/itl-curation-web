import { useEffect, useState, type ReactNode } from 'react';

// Mount this only for the duration of a loading state. If that state resolves
// before `ms` elapses, this unmounts before ever rendering, avoiding a flash
// of "Loading…" on fast (typically local) requests.
export function Delayed({ children, ms = 200 }: { children: ReactNode; ms?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(timeout);
  }, [ms]);

  return show ? children : null;
}
