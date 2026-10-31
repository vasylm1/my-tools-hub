// Command palette: one modal list for tools, pages and actions, opened with Cmd or Ctrl + K.
// It uses the native <dialog> element, so focus is trapped and Escape closes it without extra code.
import { h } from './core/dom.js';
import { icon } from './core/icons.js';

// getGroups(query) -> [{ title, items: [{ name, sub?, ic, run() }] }]
export function createPalette({ tr, getGroups }) {
  let flat = [];
  let active = 0;
  const input = h('input', {
    type: 'text', class: 'palette-input', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list',
    placeholder: tr('Search tools, pages and actions'), 'aria-label': tr('Search tools, pages and actions'), autocomplete: 'off', spellcheck: false,
  });
  const list = h('div', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': tr('Results'), tabindex: -1 });
  const dialog = h('dialog', { class: 'palette', 'aria-label': tr('Command palette') },
    h('div', { class: 'palette-bar' }, icon('search', 16), input),
    list,
    h('p', { class: 'palette-foot' }, tr('Up and Down to move, Enter to open, Esc to close')));

  const mark = () => {
    list.querySelectorAll('[role=option]').forEach((el, i) => {
      el.classList.toggle('on', i === active);
      el.setAttribute('aria-selected', String(i === active));
    });
    const el = list.querySelectorAll('[role=option]')[active];
    if (el) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
  };

  function run(item) {
    close();
    item.run();
  }

  function render() {
    const groups = getGroups(input.value.trim().toLowerCase()).filter((g) => g.items.length);
    flat = [];
    const nodes = groups.map((g, gi) => h('div', { role: 'group', 'aria-labelledby': `palette-g${gi}` },
      h('div', { class: 'palette-title', id: `palette-g${gi}` }, g.title),
      ...g.items.map((item) => {
        const i = flat.push(item) - 1;
        return h('div', { role: 'option', id: `palette-o${i}`, class: 'palette-item', 'aria-selected': 'false', onclick: () => run(item), onmousemove: () => { if (active !== i) { active = i; mark(); } } },
          icon(item.ic, 16), h('span', { class: 'palette-name' }, item.name), item.sub && h('span', { class: 'palette-sub' }, item.sub));
      })));
    list.replaceChildren(...(nodes.length ? nodes : [h('p', { class: 'palette-empty' }, tr('Nothing matches. Try fewer words.'))]));
    active = 0;
    mark();
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(flat.length - 1, active + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
    else if (e.key === 'Home') { e.preventDefault(); active = 0; mark(); }
    else if (e.key === 'End') { e.preventDefault(); active = Math.max(0, flat.length - 1); mark(); }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); run(flat[active]); }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); }); // click on the backdrop

  function open() {
    if (dialog.open) return;
    if (!dialog.isConnected) document.body.append(dialog);
    input.value = '';
    render();
    dialog.showModal();
    input.focus();
  }
  function close() { if (dialog.open) dialog.close(); }
  return { open, close, isOpen: () => dialog.open, toggle: () => (dialog.open ? close() : open()) };
}
