// Filter logic is independent of rendering, so content remains usable without JS.
const PublicationFilters = (() => {
  const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const matches = (paper, state) => {
    const terms = normalize(state.q).split(/\s+/).filter(Boolean);
    return terms.every(term => term.length === 1 ? paper.search.split(/\s+/).includes(term) : paper.search.includes(term))
      && (!state.kind || paper.kind === state.kind)
      && (!state.year || paper.year === state.year)
      && (!state.topics.length || state.topics.some(topic => paper.topics.includes(topic)));
  };
  const compare = (a, b, sort) => {
    const title = a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });
    if (sort === 'title') return title;
    if (sort === 'oldest') return a.date.localeCompare(b.date) || title;
    return b.date.localeCompare(a.date) || title;
  };
  return { normalize, matches, compare };
})();

if (typeof document !== 'undefined') (() => {
  const root = document.querySelector('[data-publications]');
  if (!root) return;
  const list = root.querySelector('[data-paper-list]');
  const query = root.querySelector('#publication-query');
  const sort = root.querySelector('#publication-sort');
  const count = root.querySelector('[data-result-count]');
  const empty = root.querySelector('[data-empty]');
  const buttons = Array.from(root.querySelectorAll('button[data-filter]'));
  const papers = Array.from(list.querySelectorAll('[data-paper]')).map(element => ({
    element, title: element.dataset.title, search: PublicationFilters.normalize(element.dataset.search),
    kind: element.dataset.kind, year: element.dataset.year,
    date: element.dataset.date,
    topics: JSON.parse(element.dataset.topics || '[]')
  }));
  const defaults = () => ({ q: '', kind: '', year: '', topics: [], sort: 'newest' });
  const allowed = filter => buttons.filter(button => button.dataset.filter === filter).map(button => button.dataset.value);
  let state = defaults();
  const readURL = () => {
    const params = new URL(window.location.href).searchParams;
    state = defaults();
    state.q = params.get('q') || '';
    for (const key of ['kind', 'year']) {
      const value = params.get(key) || '';
      if (allowed(key).includes(value)) state[key] = value;
    }
    state.topics = [...new Set(params.getAll('topic'))].filter(topic => topic && allowed('topic').includes(topic));
    const value = params.get('sort');
    if (['newest', 'oldest', 'title'].includes(value)) state.sort = value;
    query.value = state.q;
    sort.value = state.sort;
  };
  const writeURL = () => {
    const url = new URL(window.location.href);
    for (const key of ['q', 'kind', 'year', 'status', 'topic', 'selected', 'sort']) url.searchParams.delete(key);
    if (state.q.trim()) url.searchParams.set('q', state.q.trim());
    for (const key of ['kind', 'year']) if (state[key]) url.searchParams.set(key, state[key]);
    state.topics.forEach(topic => url.searchParams.append('topic', topic));
    if (state.sort !== 'newest') url.searchParams.set('sort', state.sort);
    try { window.history.replaceState(null, '', url); } catch { /* Filtering works even if URL updates are unavailable. */ }
  };
  const render = (updateURL = true) => {
    let total = 0;
    const sorted = [...papers].sort((a, b) => PublicationFilters.compare(a, b, state.sort));
    sorted.forEach(paper => {
      const visible = PublicationFilters.matches(paper, state);
      paper.element.hidden = !visible;
      if (visible) total++;
      list.appendChild(paper.element);
    });
    buttons.forEach(button => {
      const key = button.dataset.filter;
      const value = button.dataset.value;
      const pressed = key === 'topic' ? (value ? state.topics.includes(value) : !state.topics.length) : state[key] === value;
      button.setAttribute('aria-pressed', String(pressed));
    });
    count.textContent = `${total} of ${papers.length} publication${papers.length === 1 ? '' : 's'}`;
    empty.hidden = total !== 0;
    if (updateURL) writeURL();
  };
  const toggleTopic = value => {
    state.topics = !value ? [] : state.topics.includes(value) ? state.topics.filter(topic => topic !== value) : [...state.topics, value];
  };
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (button && root.contains(button)) {
      const key = button.dataset.filter;
      if (key === 'topic') toggleTopic(button.dataset.value);
      else state[key] = button.dataset.value;
      render();
      return;
    }
    const topic = event.target.closest('a[data-topic]');
    if (topic && root.contains(topic)) {
      event.preventDefault();
      toggleTopic(topic.dataset.topic);
      render();
      return;
    }
    if (event.target.closest('[data-reset]')) {
      state = defaults(); query.value = ''; sort.value = state.sort;
      render();
    }
  });
  query.addEventListener('input', () => { state.q = query.value; render(); });
  sort.addEventListener('change', () => { state.sort = sort.value; render(); });
  window.addEventListener('popstate', () => { readURL(); render(false); });
  readURL();
  render(false);
  root.querySelectorAll('[data-controls]').forEach(element => { element.hidden = false; });
})();
