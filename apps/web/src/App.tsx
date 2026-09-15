import { Route, Routes } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppBreadcrumb } from '@/components/app-breadcrumb';
import { EventDetail } from '@/components/event-detail';
import { EventList } from '@/components/event-list';
import { Loading } from '@/components/loading';
import { ModeToggle } from '@/components/mode-toggle';
import { SubmissionDetailPage } from '@/components/submission-detail-page';
import { UserMenu } from '@/components/user-menu';
import { useAuth } from '@/hooks/use-auth';
import { BreadcrumbProvider } from '@/hooks/use-breadcrumb';

function App() {
  const auth = useAuth();

  return (
    <BreadcrumbProvider>
      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <AppBreadcrumb />
          <div className="flex items-center gap-2">
            <ModeToggle />
            {auth.status === 'authenticated' && (
              <UserMenu user={auth.user} onUpdateDisplayName={auth.updateDisplayName} />
            )}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center p-6">
          {auth.status === 'loading' && <Loading />}

          {auth.status === 'unauthenticated' && (
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Sign in</CardTitle>
                <CardDescription>Use your Discord account to access ITL Curation.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a href="/api/auth/discord">Sign in with Discord</a>
                </Button>
              </CardContent>
            </Card>
          )}

          {auth.status === 'authenticated' && (
            <Routes>
              <Route path="/" element={<EventList user={auth.user} />} />
              <Route path="/events/:slug" element={<EventDetail />} />
              <Route path="/events/:slug/submissions/:fileId" element={<SubmissionDetailPage />} />
            </Routes>
          )}
        </main>
      </div>
    </BreadcrumbProvider>
  );
}

export default App;
