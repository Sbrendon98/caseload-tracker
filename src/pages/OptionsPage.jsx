// Options: backup and restore, CSV export, week start, storage, and the tutorials.
import { Page } from '../components/Page.jsx';
import { BackupCard, ExportCard, StorageCard, TutorialsCard, WeekStartCard } from '../components/OptionsCards.jsx';
import { useTutorial } from '../hooks/useTutorial.jsx';
import { routes } from '../../js/router.js';

export function OptionsPage() {
  useTutorial('exportBackup');
  return (
    <Page title="Options" back={{ label: 'Cases', href: routes.list() }}>
      <BackupCard />
      <ExportCard />
      <WeekStartCard />
      <StorageCard />
      <TutorialsCard />
    </Page>
  );
}
