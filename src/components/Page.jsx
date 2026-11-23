// Page chrome shared by every screen: top bar plus any banners that apply right now.
import { useApp } from '../context/AppContext.jsx';
import { useUpdate } from '../context/Update.jsx';
import { useDelivery } from '../hooks/useDelivery.jsx';
import { detectEnv } from '../../js/env.js';
import { backupDue, shouldWarnNotInstalled } from '../../js/reminders.js';
import { routes } from '../../js/router.js';

function Banners() {
  const { store, now, error, setError, session, hideForSession } = useApp();
  const update = useUpdate();
  const { backup } = useDelivery();
  const cases = store.cases();

  const timer = store.getMeta('timer');
  const timed = timer && store.getCase(timer.caseId);
  const notInstalled = shouldWarnNotInstalled({ ...detectEnv(), caseCount: cases.length });
  const nudge = !notInstalled && !session.hideBackupNudge
    && backupDue({ lastBackupMs: store.getMeta('lastBackupAt', null), cases, nowMs: now() });

  return (
    <>
      {error && (
        <div class="banner error" role="alert">
          <span>{error}</span>
          <button type="button" class="banner-btn" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      {update.needRefresh && (
        <div class="banner update" role="status">
          <span>A new version is ready.</span>
          <button type="button" class="banner-btn" onClick={update.apply}>Update</button>
        </div>
      )}
      {timed && (
        <div class="banner timer">
          <span>Timer running for {timed.displayId}</span>
          <a class="banner-btn" href={routes.caseDetail(timed.id)}>Open</a>
        </div>
      )}
      {notInstalled && !session.hideInstallWarning && (
        <div class="banner warn" role="status">
          <span>You are in the browser, not the installed app. Data saved here will not appear in the Home Screen app. Back up here, then restore inside the installed app.</span>
          <span class="banner-actions">
            <button type="button" class="banner-btn" onClick={backup}>Back up</button>
            <button type="button" class="banner-btn" onClick={() => hideForSession('hideInstallWarning')}>Hide for now</button>
          </span>
        </div>
      )}
      {nudge && (
        <div class="banner warn" role="status">
          <span>It has been a while since your last backup.</span>
          <span class="banner-actions">
            <button type="button" class="banner-btn" onClick={backup}>Back up</button>
            <button type="button" class="banner-btn" onClick={() => hideForSession('hideBackupNudge')}>Later</button>
          </span>
        </div>
      )}
    </>
  );
}

/** actions: [{ label, href }] shown top-right. back: { label, href }. */
export function Page({ title, back, actions = [], children }) {
  return (
    <main class="page">
      <header class="topbar">
        {back && <a class="back" href={back.href}>‹ {back.label}</a>}
        <div class="title-row">
          <h1>{title}</h1>
          <nav class="top-actions" aria-label="Sections">
            {actions.map(a => <a key={a.href} class="link-btn" href={a.href}>{a.label}</a>)}
          </nav>
        </div>
      </header>
      <Banners />
      {children}
    </main>
  );
}
