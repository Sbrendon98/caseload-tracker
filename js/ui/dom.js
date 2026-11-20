// Tiny element builder. Text always goes in as text nodes (never innerHTML), so notes and IDs
// typed by the user can never be interpreted as markup.
//   h('button', { class: 'btn', onClick: fn, 'aria-label': 'x' }, 'Label', childEl)

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    // Enumerated attributes need an explicit "false" string; skipping false would leave the default on.
    if (key === 'spellcheck' && typeof value === 'boolean') { el.setAttribute(key, String(value)); continue; }
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (/^on[A-Z]/.test(key)) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && !key.includes('-')) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child);
  }
  return el;
}
