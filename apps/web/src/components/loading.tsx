import { Delayed } from '@/components/delayed';

export function Loading({ message = 'Loading…' }: { message?: string }) {
  return (
    <Delayed>
      <p className="text-muted-foreground text-sm">{message}</p>
    </Delayed>
  );
}
