import { Delayed } from '@/components/delayed'

export function Loading({ message = 'Loading…' }: { message?: string }) {
  return (
    <Delayed>
      <p className="text-sm text-muted-foreground">{message}</p>
    </Delayed>
  )
}
