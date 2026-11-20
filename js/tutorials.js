// Tutorial content and the "seen once" rule. Pure data and functions; the popup lives in ui/tutorials.js.
// Seen flags are a map { topicId: true } kept in the database, never in localStorage.

export const TOPICS = [
  {
    id: 'welcome',
    title: 'Welcome',
    steps: [
      {
        heading: 'Your caseload, in your pocket',
        body: 'Log the time you spend on each student case. Everything stays on this device. Nothing is ever sent anywhere.',
      },
      {
        heading: 'Initials and a case number only',
        body: 'Never type a student’s full name. A case is identified by initials plus a case number, like A.S-122445543.',
      },
      {
        heading: 'Install it first',
        body: 'On iPhone, open this page in Safari, tap Share, then Add to Home Screen. From then on, open the app only from that icon. The installed app has its own separate storage, so anything entered in a Safari tab will not show up in it.',
      },
      {
        heading: 'Back up now and then',
        body: 'Your data lives only on this device. If Safari data is cleared or you change phones, it is gone. In Options, tap Back up and keep the file somewhere safe, like iCloud Drive.',
      },
    ],
  },
  {
    id: 'addCase',
    title: 'Adding a case',
    steps: [
      {
        heading: 'Initials and a case number',
        body: 'Type the initials any way you like: “a s” becomes A.S. Each ID can only be used once, including cases you have archived.',
      },
      {
        heading: 'Due date and notes',
        body: 'The due date is optional. Use the notes for anything worth remembering, such as a blocker causing delay. Notes are included in your CSV export.',
      },
    ],
  },
  {
    id: 'logTime',
    title: 'Logging time',
    steps: [
      {
        heading: 'Add time',
        body: 'Pick the date, tap a quick button like 30 min or 1 hr, or type hours and minutes, then tap Add time. Your total updates right away.',
      },
      {
        heading: 'Use the timer',
        body: 'Tap Start timer when you begin. When you stop, the time is filled in for you to check and save. The timer keeps running even if you close the app.',
      },
      {
        heading: 'Fix mistakes',
        body: 'Every entry can be edited or deleted from the list below. Deleting asks you to confirm first.',
      },
    ],
  },
  {
    id: 'archive',
    title: 'Archiving finished cases',
    steps: [
      {
        heading: 'Swipe left to archive',
        body: 'Swipe a case to the left and tap Archive. You can also tap the ⋯ button on a case. Archived cases keep all their time, and you can bring them back from Archived cases.',
      },
      {
        heading: 'Up to 50 active cases',
        body: 'When you add a 51st case, the app shows your oldest cases so you can archive finished ones. Your new case is created automatically once there is room.',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    steps: [
      {
        heading: 'See when you worked',
        body: 'A dot marks every day you logged time. Tap a day to see each case you worked on that day, with the total.',
      },
      {
        heading: 'Focus on one student',
        body: 'Use the Show menu to see only one case, or tap View in calendar on a case to jump straight to it.',
      },
    ],
  },
  {
    id: 'exportBackup',
    title: 'Export and backup',
    steps: [
      {
        heading: 'Export a CSV',
        body: 'Choose Week, Month, School year or All, then tap Export CSV to send it to Files, Mail, Numbers or Excel. Archived cases are included.',
      },
      {
        heading: 'Back up and restore',
        body: 'Back up saves everything to a file. To move to a new phone or a computer, open Restore there and choose the file. Merge keeps both sides and the newest version of anything changed; Replace starts over from the file.',
      },
    ],
  },
];

export const topicById = id => TOPICS.find(t => t.id === id);

export const shouldShow = (id, seen) => !seen?.[id];

export const markSeen = (seen, id) => ({ ...(seen ?? {}), [id]: true });
