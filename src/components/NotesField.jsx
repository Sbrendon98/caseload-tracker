import { useEffect, useState } from 'preact/hooks';
import { NOTES_PLACEHOLDER } from './Forms.jsx';

/** Saved when she taps away (blur), not on every keystroke. */
export function NotesField({ notes, onSave }) {
  const [text, setText] = useState(notes);
  useEffect(() => setText(notes), [notes]);
  return (
    <textarea
      rows={4} value={text} placeholder={NOTES_PLACEHOLDER} aria-label="Case notes"
      onInput={e => setText(e.currentTarget.value)}
      onBlur={e => { if (e.currentTarget.value !== notes) onSave(e.currentTarget.value); }}
    />
  );
}
