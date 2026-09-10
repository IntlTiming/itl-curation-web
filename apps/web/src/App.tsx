import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EventList } from '@/components/event-list'
import { ModeToggle } from '@/components/mode-toggle'
import { UserMenu } from '@/components/user-menu'
import { useAuth } from '@/hooks/use-auth'

function App() {
  const auth = useAuth()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">ITL Curation</span>
        <div className="flex items-center gap-2">
          <ModeToggle />
          {auth.status === 'authenticated' && <UserMenu user={auth.user} />}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        {auth.status === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {auth.status === 'unauthenticated' && (
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Use your Discord account to access ITL Curation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <a href="/api/auth/discord">Sign in with Discord</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {auth.status === 'authenticated' && <EventList user={auth.user} />}
      </main>
    </div>
  )
}

export default App
