import { ClipboardCheck, Globe, Inbox, Settings, Star, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ImportPanel } from '@/components/import-panel';
import { Loading } from '@/components/loading';
import { ReviewersPanel } from '@/components/reviewers-panel';
import { ReviewsPanel } from '@/components/reviews-panel';
import { SettingsPanel } from '@/components/settings-panel';
import { SubmissionsPanel } from '@/components/submissions-panel';
import { SubmittersPanel } from '@/components/submitters-panel';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvent, type EventDetail as EventDetailData } from '@/hooks/use-event';
import { usePageBreadcrumb } from '@/hooks/use-breadcrumb';
import { usePageTitle } from '@/hooks/use-page-title';
import { FILTER_PARAM_KEYS } from '@/hooks/use-reviews-filters';
import { SORT_PARAM_KEYS } from '@/hooks/use-reviews-sort';

const DEFAULT_TAB = 'reviews';

const TAB_LABELS: Record<string, string> = {
  reviews: 'Reviews',
  submissions: 'Submissions',
  submitters: 'Submitters',
  reviewers: 'Reviewers',
  import: 'Import',
  settings: 'Settings',
};

function accessRequestsUrl(slug: string): string {
  return `/api/events/${encodeURIComponent(slug)}/access-requests`;
}

// Shown instead of the Tabs UI for a logged-in, non-admin, non-member viewer of a PUBLIC
// event - global admins always come back with isMember: true (see EventsService.findVisible),
// so reaching this branch means the event is genuinely public and this user hasn't been added.
function RequestAccessCard({
  event,
  onChanged,
}: {
  event: EventDetailData;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(method: 'POST' | 'DELETE', failureMessage: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(accessRequestsUrl(event.slug), { method });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? failureMessage);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : failureMessage);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <Globe className="size-3.5" />
          Public event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          {event.hasPendingRequest
            ? "You've requested access to this event. An admin needs to approve it before you can see anything else."
            : "You don't have access to this event yet. You can request it below."}
        </p>
        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
      </CardContent>
      <CardFooter>
        {event.hasPendingRequest ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => submit('DELETE', 'Failed to cancel request')}
          >
            {pending ? 'Cancelling…' : 'Cancel request'}
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => submit('POST', 'Failed to request access')}
          >
            {pending ? 'Requesting…' : 'Request access'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const result = useEvent(slug ?? '');
  const [searchParams, setSearchParams] = useSearchParams();
  usePageBreadcrumb(result.status === 'loaded' ? [{ label: result.event.name }] : []);

  const requestedTab = searchParams.get('tab') ?? DEFAULT_TAB;
  const isAdminOnlyTab = requestedTab === 'import' || requestedTab === 'settings';
  const tab =
    isAdminOnlyTab && !(result.status === 'loaded' && result.event.isEventAdmin)
      ? DEFAULT_TAB
      : requestedTab;

  usePageTitle(
    result.status !== 'loaded'
      ? null
      : !result.event.isMember
        ? result.event.name
        : `${TAB_LABELS[tab]} - ${result.event.name}`,
  );

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

  if (!event.isMember) {
    return <RequestAccessCard event={event} onChanged={result.refetch} />;
  }

  return (
    <Tabs
      className="w-full gap-6 self-start"
      value={tab}
      onValueChange={(value) => {
        setSearchParams(
          (params) => {
            if (value === DEFAULT_TAB) {
              params.delete('tab');
            } else {
              params.set('tab', value);
            }
            // Reviews' own sort/filter params are meaningless on any other tab. Stripped here,
            // atomically with the tab change itself, rather than via an effect cleanup in
            // ReviewsPanel's hooks - see SORT_PARAM_KEYS's comment in use-reviews-sort.ts for
            // why that approach races this navigation and was reverted.
            if (value !== 'reviews') {
              for (const key of [...SORT_PARAM_KEYS, ...FILTER_PARAM_KEYS]) params.delete(key);
            }
            return params;
          },
          { replace: true },
        );
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="reviews">
          <ClipboardCheck />
          Reviews
        </TabsTrigger>
        <TabsTrigger value="submissions">
          <Inbox />
          Submissions
        </TabsTrigger>
        <TabsTrigger value="submitters">
          <Users />
          Submitters
        </TabsTrigger>
        <TabsTrigger value="reviewers">
          <Star />
          Reviewers
        </TabsTrigger>
        {event.isEventAdmin && (
          <TabsTrigger value="import">
            <Upload />
            Import
          </TabsTrigger>
        )}
        {event.isEventAdmin && (
          <TabsTrigger value="settings">
            <Settings />
            Settings
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="reviews">
        <ReviewsPanel eventSlug={event.slug} />
      </TabsContent>
      <TabsContent value="submissions">
        <SubmissionsPanel eventSlug={event.slug} />
      </TabsContent>
      <TabsContent value="submitters">
        <SubmittersPanel eventSlug={event.slug} />
      </TabsContent>
      <TabsContent value="reviewers">
        <ReviewersPanel eventSlug={event.slug} />
      </TabsContent>
      {event.isEventAdmin && (
        <TabsContent value="import">
          <ImportPanel eventSlug={event.slug} />
        </TabsContent>
      )}
      {event.isEventAdmin && (
        <TabsContent value="settings">
          <SettingsPanel event={event} onEventChanged={result.refetch} />
        </TabsContent>
      )}
    </Tabs>
  );
}
