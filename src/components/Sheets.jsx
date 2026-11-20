// Sheets that are plain content: the tutorial stepper and the file preview.
import { useState } from 'preact/hooks';
import { Sheet } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { topicById } from '../../js/tutorials.js';

/** Steps through a topic with Back / Next / Got it. */
export function TutorialSheet({ id, onClose }) {
  const topic = topicById(id);
  const [index, setIndex] = useState(0);
  const step = topic.steps[index];
  const last = index === topic.steps.length - 1;
  return (
    <Sheet title={topic.title} onClose={onClose}>
      {({ dismiss }) => (
        <div class="tutorial">
          <h3>{step.heading}</h3>
          <p>{step.body}</p>
          <p class="muted steps-count">Step {index + 1} of {topic.steps.length}</p>
          <div class="button-row">
            {index > 0 && <button type="button" class="btn" onClick={() => setIndex(index - 1)}>Back</button>}
            <button type="button" class="btn primary" onClick={() => (last ? dismiss() : setIndex(index + 1))}>
              {last ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Shown instead of a download inside the installed iOS app: the text, with Copy. */
export function PreviewSheet({ filename, content, url, onClose }) {
  const toast = useToast();
  const copy = async e => {
    const box = e.currentTarget.closest('.sheet-body').querySelector('textarea');
    try { await navigator.clipboard.writeText(content); toast('Copied'); }
    catch { box.select(); toast('Select all and copy manually.'); }
  };
  return (
    <Sheet title={filename} onClose={() => { URL.revokeObjectURL(url); onClose(); }}>
      {({ dismiss }) => (
        <div>
          <p>Your phone could not open the share sheet. Copy this text and paste it into Notes, Mail or a file, or try Open file.</p>
          <textarea readOnly rows={10} value={content} aria-label={filename} spellCheck="false" />
          <div class="button-row">
            <a class="btn" href={url} target="_blank" rel="noopener">Open file</a>
            <button type="button" class="btn primary" onClick={copy}>Copy</button>
            <button type="button" class="btn" onClick={dismiss}>Done</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
