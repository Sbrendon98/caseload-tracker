import { AppProvider } from './context/AppContext.jsx';
import { DialogsProvider } from './context/Dialogs.jsx';
import { ToastProvider } from './context/Toast.jsx';
import { UpdateProvider } from './context/Update.jsx';
import { useRoute } from './hooks/useRoute.js';
import { ListPage } from './pages/ListPage.jsx';
import { ArchivedPage } from './pages/ArchivedPage.jsx';
import { CasePage } from './pages/CasePage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { OptionsPage } from './pages/OptionsPage.jsx';

function Routes() {
  const route = useRoute();
  switch (route.name) {
    case 'archived': return <ArchivedPage />;
    case 'case': return <CasePage key={route.params.id} id={route.params.id} />;
    case 'calendar': return <CalendarPage key={`${route.query.case}|${route.query.date}`} query={route.query} />;
    case 'options': return <OptionsPage />;
    default: return <ListPage />;
  }
}

/** update: false in tests, where there is no service worker to register. */
export function App({ store, now, update = true }) {
  const body = (
    <AppProvider store={store} now={now}>
      <ToastProvider>
        <DialogsProvider>
          <Routes />
        </DialogsProvider>
      </ToastProvider>
    </AppProvider>
  );
  return update ? <UpdateProvider>{body}</UpdateProvider> : body;
}
