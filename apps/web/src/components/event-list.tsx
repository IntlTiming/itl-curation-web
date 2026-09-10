import { Link } from 'react-router';
import { CreateEventDialog } from '@/components/create-event-dialog';
import { Loading } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuthUser } from '@/hooks/use-auth';
import { useEvents } from '@/hooks/use-events';

export function EventList({ user }: { user: AuthUser }) {
  const events = useEvents();

  if (events.status === 'loading') {
    return <Loading message="Loading events…" />;
  }

  if (events.status === 'error') {
    return <p className="text-destructive text-sm">Couldn't load events. Try refreshing.</p>;
  }

  const { events: list, refetch } = events;

  if (list.length === 0) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>No events yet</CardTitle>
          <CardDescription>
            {user.isGlobalAdmin
              ? "You don't have access to any events yet."
              : "You don't have access to any events yet. Ask an event admin to grant you a role."}
          </CardDescription>
        </CardHeader>
        {user.isGlobalAdmin && (
          <CardFooter>
            <CreateEventDialog
              onCreated={refetch}
              trigger={<Button className="w-full">Create your first event</Button>}
            />
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Events</h1>
        {user.isGlobalAdmin && (
          <CreateEventDialog onCreated={refetch} trigger={<Button>Create event</Button>} />
        )}
      </div>
      <div className="grid gap-3">
        {list.map((event) => (
          <Link
            key={event.id}
            to={`/events/${event.slug}`}
            className="focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-3"
          >
            <Card className="hover:bg-muted transition-all hover:shadow-md">
              <CardHeader>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>
                  {event.date
                    ? new Date(event.date).toLocaleDateString(undefined, { timeZone: 'UTC' })
                    : 'No date set'}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
