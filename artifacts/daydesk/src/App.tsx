import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { DeskPage } from './pages/DeskPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          <Route path="/" component={DeskPage} />
          <Route>
            <div className="min-h-screen flex items-center justify-center">
              <h1 className="text-xl font-medium">Page not found</h1>
            </div>
          </Route>
        </Switch>
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
