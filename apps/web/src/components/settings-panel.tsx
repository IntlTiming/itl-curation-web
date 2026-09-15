import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsPanel({ eventSlug: _eventSlug }: { eventSlug: string }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Coming soon.</CardDescription>
      </CardHeader>
    </Card>
  );
}
