import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AuthUser } from '@/hooks/use-auth'

function discordAvatarUrl(user: AuthUser) {
  if (!user.discordAvatarHash) return undefined
  return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatarHash}.png`
}

export function UserMenu({ user }: { user: AuthUser }) {
  const name = user.displayName ?? user.discordUsername

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
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
            <span className="block text-xs font-normal text-muted-foreground">Global admin</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
