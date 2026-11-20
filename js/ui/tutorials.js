// The tutorial popup. showTutorialOnce() is called by each screen; it shows a topic only the
// first time and never on top of another open sheet. Options > Tutorials replays any topic.
import { h } from './dom.js';
import { openModal } from './modal.js';
import { TOPICS, markSeen, shouldShow, topicById } from '../tutorials.js';

export { TOPICS };

/** Steps through a topic with Back / Next / Got it. */
export function openTutorial(id) {
  const topic = topicById(id);
  let index = 0;
  const body = h('div', { class: 'tutorial' });
  const modal = openModal({ title: topic.title, content: body });

  function draw() {
    const step = topic.steps[index];
    const last = index === topic.steps.length - 1;
    body.replaceChildren(
      h('h3', {}, step.heading),
      h('p', {}, step.body),
      h('p', { class: 'muted steps-count' }, `Step ${index + 1} of ${topic.steps.length}`),
      h('div', { class: 'button-row' },
        index > 0 && h('button', { type: 'button', class: 'btn', onClick: () => { index--; draw(); } }, 'Back'),
        h('button', {
          type: 'button', class: 'btn primary',
          onClick: () => (last ? modal.close() : (index++, draw())),
        }, last ? 'Got it' : 'Next')));
  }
  draw();
  return modal;
}

export function showTutorialOnce(ctx, id) {
  const seen = ctx.store.getMeta('tutorialsSeen', {});
  if (!shouldShow(id, seen) || ctx.state.tutorialsShown.has(id)) return;
  if (document.querySelector('dialog[open]')) return; // try again next visit rather than stacking popups
  ctx.state.tutorialsShown.add(id); // set now: the saved flag below lands a moment later
  openTutorial(id);
  ctx.guard(ctx.store.setMeta('tutorialsSeen', markSeen(seen, id)));
}

export async function resetTutorials(ctx) {
  ctx.state.tutorialsShown.clear();
  await ctx.guard(ctx.store.setMeta('tutorialsSeen', undefined));
}
