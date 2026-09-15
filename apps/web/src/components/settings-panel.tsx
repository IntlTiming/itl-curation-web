import { format } from 'date-fns';
import { Globe, Lock } from 'lucide-react';
import { useState } from 'react';
import { AddCuratorDialog } from '@/components/add-curator-dialog';
import { Loading } from '@/components/loading';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAccessRequests } from '@/hooks/use-access-requests';
import { useAuth } from '@/hooks/use-auth';
import { useCurators } from '@/hooks/use-curators';
import type { EventDetail } from '@/hooks/use-event';
import { discordAvatarUrl } from '@/lib/discord-avatar';

function displayNameOf(person: { discordUsername: string; displayName: string | null }): string {
  return person.displayName ?? person.discordUsername;
}

function VisibilitySection({
  event,
  onEventChanged,
}: {
  event: EventDetail;
  onEventChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPublic = event.visibility === 'PUBLIC';

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: isPublic ? 'PRIVATE' : 'PUBLIC' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'Failed to update visibility');
      }
      onEventChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Visibility</CardTitle>
        <CardDescription>
          {isPublic
            ? 'Anyone signed in can see this event and request access.'
            : 'Only members can see this event.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            {isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
            {isPublic ? 'Public' : 'Private'}
          </div>
          <Button variant="outline" size="sm" disabled={pending} onClick={toggle}>
            {pending ? 'Updating…' : isPublic ? 'Make private' : 'Make public'}
          </Button>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}

function AccessRequestsSection({
  result,
  onMembershipChanged,
}: {
  result: ReturnType<typeof useAccessRequests>;
  onMembershipChanged: () => void;
}) {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleApprove(userId: string) {
    setPendingUserId(userId);
    setActionError(null);
    try {
      await result.approve(userId);
      onMembershipChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleDeny(userId: string) {
    setPendingUserId(userId);
    setActionError(null);
    try {
      await result.deny(userId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to deny request');
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Access requests</CardTitle>
        <CardDescription>People who've asked to be added to this event.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {result.status === 'loading' && <Loading message="Loading requests…" />}
        {result.status === 'error' && (
          <p className="text-destructive text-sm">Couldn't load requests. Try refreshing.</p>
        )}
        {result.status === 'loaded' && result.requests.length === 0 && (
          <p className="text-muted-foreground text-sm">No pending requests.</p>
        )}
        {result.status === 'loaded' &&
          result.requests.map((request) => (
            <div key={request.userId} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage src={discordAvatarUrl(request)} alt={displayNameOf(request)} />
                  <AvatarFallback className="text-[10px]">
                    {displayNameOf(request).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{displayNameOf(request)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingUserId === request.userId}
                  onClick={() => handleDeny(request.userId)}
                >
                  Deny
                </Button>
                <Button
                  size="sm"
                  disabled={pendingUserId === request.userId}
                  onClick={() => handleApprove(request.userId)}
                >
                  Approve
                </Button>
              </div>
            </div>
          ))}
        {actionError && <p className="text-destructive text-sm">{actionError}</p>}
      </CardContent>
    </Card>
  );
}

function MembersSection({
  eventSlug,
  curators,
  onAddCurator,
}: {
  eventSlug: string;
  curators: ReturnType<typeof useCurators>;
  onAddCurator: (userId: string) => Promise<void>;
}) {
  const auth = useAuth();
  const currentUserId = auth.status === 'authenticated' ? auth.user.id : null;
  // A global admin's access never actually depends on their EventRole (see EventsService's
  // isGlobalAdmin bypass), so the self-lockout protection below - which exists purely to stop a
  // member from accidentally revoking their own access - doesn't apply to them; let them manage
  // their own row like any other member's.
  const currentUserIsGlobalAdmin = auth.status === 'authenticated' && auth.user.isGlobalAdmin;
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleSetAdmin(userId: string, isAdmin: boolean) {
    setPendingUserId(userId);
    setRowError((prev) => ({ ...prev, [userId]: '' }));
    try {
      await curators.setCuratorAdmin(userId, isAdmin);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [userId]: err instanceof Error ? err.message : 'Failed to update admin access',
      }));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRemove(userId: string) {
    setPendingUserId(userId);
    setRowError((prev) => ({ ...prev, [userId]: '' }));
    try {
      await curators.removeCurator(userId);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [userId]: err instanceof Error ? err.message : 'Failed to remove member',
      }));
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Members</CardTitle>
          <CardDescription>Everyone with access to this event.</CardDescription>
        </div>
        <AddCuratorDialog
          eventSlug={eventSlug}
          onAdd={onAddCurator}
          trigger={<Button size="sm">Add member</Button>}
        />
      </CardHeader>
      <CardContent>
        {curators.status === 'loading' && <Loading message="Loading members…" />}
        {curators.status === 'error' && (
          <p className="text-destructive text-sm">Couldn't load members. Try refreshing.</p>
        )}
        {curators.status === 'loaded' && curators.curators.length === 0 && (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        )}
        {curators.status === 'loaded' && curators.curators.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Added</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {curators.curators.map((curator) => {
                const isSelf = curator.userId === currentUserId;
                const lockSelf = isSelf && !currentUserIsGlobalAdmin;
                return (
                  <TableRow key={curator.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage
                            src={discordAvatarUrl(curator)}
                            alt={displayNameOf(curator)}
                          />
                          <AvatarFallback className="text-[10px]">
                            {displayNameOf(curator).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{displayNameOf(curator)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {lockSelf ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block">
                              <Checkbox checked={curator.isAdmin} disabled />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>You can't change your own admin access</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Checkbox
                          checked={curator.isAdmin}
                          disabled={pendingUserId === curator.userId}
                          onCheckedChange={(checked) =>
                            handleSetAdmin(curator.userId, checked === true)
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(curator.grantedAt), 'PP')}
                    </TableCell>
                    <TableCell>
                      {lockSelf ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block">
                              <Button variant="outline" size="sm" disabled>
                                Remove
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>You can't remove your own access</TooltipContent>
                        </Tooltip>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pendingUserId === curator.userId}
                            >
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {displayNameOf(curator)}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {isSelf
                                  ? "You'll keep access as a global admin, but lose your explicit membership row. Your existing reviews and comments are kept."
                                  : "They'll lose access to this event. Their existing reviews and comments are kept."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemove(curator.userId)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {rowError[curator.userId] && (
                        <p className="text-destructive mt-1 text-xs">{rowError[curator.userId]}</p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPanel({
  event,
  onEventChanged,
}: {
  event: EventDetail;
  onEventChanged: () => void;
}) {
  const curators = useCurators(event.slug);
  const accessRequests = useAccessRequests(event.slug);

  // Adding someone directly also clears any pending request of theirs on the backend (see
  // CuratorsService.addCurator) - refetch here so that stale "pending" row disappears from the
  // Access requests list immediately, instead of only on the next full reload.
  async function addCurator(userId: string) {
    await curators.addCurator(userId);
    accessRequests.refetch();
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <VisibilitySection event={event} onEventChanged={onEventChanged} />
      <AccessRequestsSection result={accessRequests} onMembershipChanged={curators.refetch} />
      <MembersSection eventSlug={event.slug} curators={curators} onAddCurator={addCurator} />
    </div>
  );
}
