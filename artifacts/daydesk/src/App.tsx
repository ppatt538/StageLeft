import { DeskPage } from './pages/DeskPage';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <>
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
    </>
  );
}

export default App;
