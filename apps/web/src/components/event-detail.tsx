import { useParams } from 'react-router';
import { Loading } from '@/components/loading';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '@/hooks/use-event';
import { usePageBreadcrumb } from '@/hooks/use-breadcrumb';

export function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const result = useEvent(slug ?? '');
  usePageBreadcrumb(result.status === 'loaded' ? result.event.name : null);

  if (result.status === 'loading') {
    return <Loading message="Loading event…" />;
  }

  if (result.status === 'error') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{result.notFound ? 'Event not found' : "Couldn't load event"}</CardTitle>
          <CardDescription>
            {result.notFound
              ? "This event doesn't exist, or you don't have access to it."
              : 'Try refreshing.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Scaffold - the event's own page content (submissions, etc.) isn't built
  // yet. Navigation context is already shown via the header breadcrumb.
  return null;
}
