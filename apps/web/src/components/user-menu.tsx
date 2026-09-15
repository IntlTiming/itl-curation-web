import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserSettingsDialog } from '@/components/user-settings-dialog';
import type { AuthUser } from '@/hooks/use-auth';
import { discordAvatarUrl } from '@/lib/discord-avatar';

export function UserMenu({
  user,
  onUpdateDisplayName,
}: {
  user: AuthUser;
  onUpdateDisplayName: (displayName: string) => Promise<void>;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const name = user.displayName ?? user.discordUsername;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="size-7">
              <AvatarImage src={discordAvatarUrl(user)} alt={name} />
              <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {name}
            {user.isGlobalAdmin && (
              <span className="text-muted-foreground block text-xs font-normal">Global admin</span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void logout()}>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UserSettingsDialog
        user={user}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={onUpdateDisplayName}
      />
    </>
  );
}
