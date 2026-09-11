import { Inbox, Upload } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router';
import { ImportPanel } from '@/components/import-panel';
import { Loading } from '@/components/loading';
import { SubmissionsPanel } from '@/components/submissions-panel';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvent } from '@/hooks/use-event';
import { usePageBreadcrumb } from '@/hooks/use-breadcrumb';

const DEFAULT_TAB = 'submissions';

export function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const result = useEvent(slug ?? '');
  const [searchParams, setSearchParams] = useSearchParams();
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

  const { event } = result;
  const requestedTab = searchParams.get('tab') ?? DEFAULT_TAB;
  const tab = requestedTab === 'import' && !event.isEventAdmin ? DEFAULT_TAB : requestedTab;

  return (
    <Tabs
      className="w-full self-start"
      value={tab}
      onValueChange={(value) => {
        setSearchParams(
          (params) => {
            if (value === DEFAULT_TAB) {
              params.delete('tab');
            } else {
              params.set('tab', value);
            }
            return params;
          },
          { replace: true },
        );
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="submissions">
          <Inbox />
          Submissions
        </TabsTrigger>
        {event.isEventAdmin && (
          <TabsTrigger value="import">
            <Upload />
            Import
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="submissions">
        <SubmissionsPanel eventSlug={event.slug} />
      </TabsContent>
      {event.isEventAdmin && (
        <TabsContent value="import">
          <ImportPanel eventSlug={event.slug} />
        </TabsContent>
      )}
    </Tabs>
  );
}
