(() => {
  const root = document.querySelector('[data-people-tabs]');
  if (!root) return;
  const tablist = root.querySelector('[data-people-tablist]');
  const tabs = [...root.querySelectorAll('[data-people-tab]')];
  const panels = [...root.querySelectorAll('[data-people-panel]')];
  const ids = tabs.map(tab => tab.dataset.peopleTab);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let active;
  let transition = 0;

  const stopAnimations = () => {
    transition++;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    root.removeAttribute('aria-busy');
  };
  const show = id => {
    panels.forEach(panel => { panel.hidden = panel.dataset.peoplePanel !== id; });
  };
  const fade = (panel, frames, duration, easing) => new Promise(resolve => {
    let animation;
    let timer;
    const done = () => {
      window.clearTimeout(timer);
      resolve(animation);
    };
    try {
      animation = panel.animate(frames, { duration, easing, fill: 'forwards' });
      animations.add(animation);
      timer = window.setTimeout(done, duration + 80);
      animation.finished.then(done, done);
    } catch { done(); }
  });
  const changePanel = async (previous, next, version, opacity) => {
    root.setAttribute('aria-busy', 'true');
    const outgoing = await fade(previous, [{ opacity }, { opacity: 0 }], 160, 'ease-in');
    if (version !== transition) return;
    show(next.dataset.peoplePanel);
    if (outgoing) { outgoing.cancel(); animations.delete(outgoing); }
    const incoming = await fade(next, [{ opacity: 0 }, { opacity: 1 }], 240, 'ease-out');
    if (version !== transition) return;
    if (incoming) { incoming.cancel(); animations.delete(incoming); }
    root.removeAttribute('aria-busy');
  };
  const activate = (id, updateURL = false, animate = true) => {
    if (!ids.includes(id) || id === active) return;
    const previous = panels.find(panel => !panel.hidden);
    const next = panels.find(panel => panel.dataset.peoplePanel === id);
    const opacity = previous ? window.getComputedStyle(previous).opacity : '1';
    const shouldAnimate = animate && active && previous !== next && !motion.matches && next.animate;
    stopAnimations();
    tabs.forEach(tab => {
      const selected = tab.dataset.peopleTab === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    if (updateURL && active !== id) {
      const url = new URL(window.location.href);
      if (id === 'members') url.searchParams.delete('view');
      else url.searchParams.set('view', id);
      url.hash = '';
      try { window.history.pushState(null, '', url); } catch { /* Tabs work without history access. */ }
    }
    active = id;
    if (shouldAnimate) changePanel(previous, next, transition, opacity);
    else show(id);
  };
  const restore = () => {
    const url = new URL(window.location.href);
    const view = url.searchParams.get('view');
    const anchors = { '#phd': 'members', '#masters': 'members', '#intern': 'interns', '#alumni': 'alumni' };
    activate(ids.includes(view) ? view : (anchors[url.hash] || 'members'));
  };

  panels.forEach(panel => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `people-tab-${panel.dataset.peoplePanel}`);
    panel.tabIndex = 0;
  });
  tablist.addEventListener('click', event => {
    const tab = event.target.closest('[data-people-tab]');
    if (tab && tablist.contains(tab)) activate(tab.dataset.peopleTab, true);
  });
  tablist.addEventListener('keydown', event => {
    const tab = event.target.closest('[data-people-tab]');
    if (!tab || !tablist.contains(tab)) return;
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    activate(ids[next], true);
    tabs[next].focus();
  });
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  motion.addEventListener('change', event => {
    if (event.matches) { stopAnimations(); show(active); }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { stopAnimations(); show(active); }
  });
  restore();
  tablist.hidden = false;
})();

// Email panels float above the cards, without changing either card's height.
(() => {
  const panels = [...document.querySelectorAll('.person-email')];
  document.addEventListener('click', event => panels.forEach(panel => { if (!panel.contains(event.target)) panel.open = false; }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = panels.find(panel => panel.open);
    panels.forEach(panel => { panel.open = false; });
    open?.querySelector('summary')?.focus();
  });
})();
