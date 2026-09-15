import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { discordAvatarUrl } from '@/lib/discord-avatar';

const SEARCH_DEBOUNCE_MS = 300;

type SearchResult = {
  id: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
};

// No combobox/command primitive exists in this codebase, and adding one (e.g. cmdk) isn't
// warranted for a single click-to-add search box - a plain debounced Input + result list
// suffices, since results are actions (Add) rather than a form field value to select.
export function AddCuratorDialog({
  eventSlug,
  onAdd,
  trigger,
}: {
  eventSlug: string;
  onAdd: (userId: string) => Promise<void>;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timeout = setTimeout(() => {
      fetch(
        `/api/events/${encodeURIComponent(eventSlug)}/curators/search-users?q=${encodeURIComponent(trimmed)}`,
      )
        .then((res) => (res.ok ? (res.json() as Promise<SearchResult[]>) : Promise.reject()))
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, eventSlug, open]);

  async function handleAdd(userId: string) {
    setAddingUserId(userId);
    setError(null);
    try {
      await onAdd(userId);
      // Stays open so an admin can add several people in one sitting.
      setResults((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add curator');
    } finally {
      setAddingUserId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setResults([]);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>Search by Discord username to grant event access.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            autoFocus
            placeholder="Search Discord username…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {searching && <p className="text-muted-foreground text-sm">Searching…</p>}
            {!searching && query.trim() !== '' && results.length === 0 && (
              <p className="text-muted-foreground text-sm">No matching users.</p>
            )}
            {results.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-2 rounded-md p-1.5"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarImage
                      src={discordAvatarUrl(user)}
                      alt={user.displayName ?? user.discordUsername}
                    />
                    <AvatarFallback className="text-[10px]">
                      {(user.displayName ?? user.discordUsername).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.displayName ?? user.discordUsername}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={addingUserId === user.id}
                  onClick={() => handleAdd(user.id)}
                >
                  {addingUserId === user.id ? 'Adding…' : 'Add'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
