// Filter logic is independent of rendering, so content remains usable without JS.
const PublicationFilters = (() => {
  const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const searchTerms = query => normalize(query).split(/\s+/).filter(Boolean);
  const matches = (paper, state, terms = searchTerms(state.q)) => {
    return terms.every(term => term.length === 1 ? paper.search.split(/\s+/).includes(term) : paper.search.includes(term))
      && (!state.kind || paper.kind === state.kind)
      && (!state.year || paper.year === state.year)
      && (!state.topics.length || state.topics.some(topic => paper.topics.includes(topic)));
  };
  const compare = (a, b, sort) => {
    if (sort !== 'title') {
      const date = sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      if (date) return date;
    }
    return a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });
  };
  return { normalize, searchTerms, matches, compare };
})();

if (typeof document !== 'undefined') (() => {
  const root = document.querySelector('[data-publications]');
  if (!root) return;
  const list = root.querySelector('[data-paper-list]');
  const query = root.querySelector('#publication-query');
  const sort = root.querySelector('#publication-sort');
  const count = root.querySelector('[data-result-count]');
  const empty = root.querySelector('[data-empty]');
  const pagination = root.querySelector('[data-pagination]');
  const pageNumbers = root.querySelector('[data-page-numbers]');
  const previousPage = root.querySelector('[data-page-prev]');
  const nextPage = root.querySelector('[data-page-next]');
  const labels = JSON.parse(root.dataset.labels);
  const label = (name, values = {}) => labels[name].replace(/\{(\w+)\}/g, (placeholder, key) => values[key] ?? placeholder);
  const pageSize = Math.max(1, Math.min(100, Number(labels.page_size) || 10));
  const buttons = () => Array.from(root.querySelectorAll('button[data-filter]'));
  const topicRow = root.querySelector('[data-topic-filter-row]');
  const topicOptions = root.querySelector('[data-topic-filter-options]');
  const permanentTopics = new Set(buttons().filter(button => button.dataset.filter === 'topic' && button.dataset.value).map(button => button.dataset.value));
  const topicCatalog = new Map(JSON.parse(root.dataset.topicCatalog || '[]').map(topic => [topic.id, topic]));
  const papers = Array.from(list.querySelectorAll('[data-paper]')).map(element => ({
    element, title: element.dataset.title, search: PublicationFilters.normalize(element.dataset.search),
    kind: element.dataset.kind, year: element.dataset.year,
    date: element.dataset.date,
    topics: JSON.parse(element.dataset.topics || '[]')
  }));
  const defaults = () => ({ q: '', kind: '', year: '', topics: [], sort: 'newest', page: 1 });
  // Display choices do not restrict valid paper metadata or linked group topics.
  const topicIDs = JSON.parse(root.dataset.topicIds || '[]');
  const allowed = filter => {
    if (filter === 'topic') return topicIDs;
    const displayed = buttons().filter(button => button.dataset.filter === filter).map(button => button.dataset.value);
    return filter === 'year' ? [...displayed, ...papers.map(paper => paper.year)] : displayed;
  };
  let state = defaults();
  let renderedSort;
  const readURL = () => {
    const params = new URL(window.location.href).searchParams;
    state = defaults();
    state.q = params.get('q') || '';
    for (const key of ['kind', 'year']) {
      const value = params.get(key) || '';
      if (allowed(key).includes(value)) state[key] = value;
    }
    // Continue accepting old hyphenated topic links after switching to names.
    state.topics = [...new Set(params.getAll('topic').map(topic =>
      topicIDs.find(id => id === topic) || topicIDs.find(id => PublicationFilters.normalize(id) === PublicationFilters.normalize(topic))
    ).filter(Boolean))];
    const value = params.get('sort');
    if (['newest', 'oldest', 'title'].includes(value)) state.sort = value;
    const page = Number(params.get('page'));
    if (Number.isSafeInteger(page) && page > 0) state.page = page;
    query.value = state.q;
    sort.value = state.sort;
  };
  const writeURL = () => {
    const url = new URL(window.location.href);
    for (const key of ['q', 'kind', 'year', 'topic', 'sort', 'page']) url.searchParams.delete(key);
    if (state.q.trim()) url.searchParams.set('q', state.q.trim());
    for (const key of ['kind', 'year']) if (state[key]) url.searchParams.set(key, state[key]);
    state.topics.forEach(topic => url.searchParams.append('topic', topic));
    if (state.sort !== 'newest') url.searchParams.set('sort', state.sort);
    if (state.page > 1) url.searchParams.set('page', state.page);
    try { window.history.replaceState(null, '', url); } catch { /* Filtering works even if URL updates are unavailable. */ }
  };
  const renderTopics = () => {
    const temporary = state.topics.filter(id => !permanentTopics.has(id) && topicCatalog.has(id))
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }));
    let restoreFocus = false;
    topicOptions.querySelectorAll('[data-temporary-topic]').forEach(button => {
      if (temporary.includes(button.dataset.value)) return;
      restoreFocus = restoreFocus || button === document.activeElement;
      button.remove();
    });
    temporary.forEach(id => {
      let button = [...topicOptions.querySelectorAll('[data-temporary-topic]')].find(button => button.dataset.value === id);
      if (!button) {
        const topic = topicCatalog.get(id);
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.filter = 'topic';
        button.dataset.value = id;
        button.setAttribute('data-temporary-topic', '');
        button.textContent = topic.label;
        button.style.setProperty('--topic-color', topic.color);
        button.style.setProperty('--topic-soft', `color-mix(in srgb, ${topic.color} 9%, white)`);
        button.style.setProperty('--topic-line', `color-mix(in srgb, ${topic.color} 25%, white)`);
      }
      topicOptions.appendChild(button);
    });
    topicRow.hidden = !permanentTopics.size && !temporary.length;
    if (restoreFocus) (topicRow.hidden ? query : topicOptions.querySelector('[data-value=""]')).focus({ preventScroll: true });
  };
  const renderPages = totalPages => {
    pagination.hidden = totalPages <= 1;
    previousPage.disabled = state.page === 1;
    previousPage.dataset.page = String(state.page - 1);
    nextPage.disabled = state.page === totalPages;
    nextPage.dataset.page = String(state.page + 1);
    const fragment = document.createDocumentFragment();
    let slots;
    if (totalPages <= 7) {
      slots = Array.from({ length: totalPages }, (_, index) => index + 1);
    } else if (state.page <= 4) {
      slots = [1, 2, 3, 4, 5, '…', totalPages];
    } else if (state.page >= totalPages - 3) {
      slots = [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      slots = [1, '…', state.page - 1, state.page, state.page + 1, '…', totalPages];
    }
    for (const page of slots) {
      if (page === '…') {
        const gap = document.createElement('span');
        gap.textContent = page;
        gap.setAttribute('aria-hidden', 'true');
        fragment.appendChild(gap);
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.page = String(page);
      button.textContent = String(page);
      button.setAttribute('aria-label', label('page_label', { page }));
      if (page === state.page) button.setAttribute('aria-current', 'page');
      fragment.appendChild(button);
    }
    pageNumbers.replaceChildren(fragment);
  };
  const render = (updateURL = true) => {
    renderTopics();
    // Search and filters do not change order. Move nodes only on sort changes.
    if (renderedSort !== state.sort) {
      papers.sort((a, b) => PublicationFilters.compare(a, b, state.sort));
      const fragment = document.createDocumentFragment();
      papers.forEach(paper => fragment.appendChild(paper.element));
      list.appendChild(fragment);
      renderedSort = state.sort;
    }
    const terms = PublicationFilters.searchTerms(state.q);
    const matched = papers.filter(paper => PublicationFilters.matches(paper, state, terms));
    const total = matched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * pageSize;
    const visiblePapers = new Set(matched.slice(start, start + pageSize));
    papers.forEach(paper => {
      const visible = visiblePapers.has(paper);
      if (paper.element.hidden !== !visible) paper.element.hidden = !visible;
    });
    buttons().forEach(button => {
      const key = button.dataset.filter;
      const value = button.dataset.value;
      const pressed = key === 'topic' ? (value ? state.topics.includes(value) : !state.topics.length) : state[key] === value;
      button.setAttribute('aria-pressed', String(pressed));
    });
    const noun = total === 1 ? labels.singular : labels.plural;
    count.textContent = label(total ? 'count' : 'empty_count', { start: start + 1, end: Math.min(start + pageSize, total), total, noun })
      + (total !== papers.length ? label('total_suffix', { total: papers.length }) : '');
    empty.hidden = total !== 0;
    renderPages(totalPages);
    if (updateURL) writeURL();
  };
  const toggleTopic = value => {
    state.topics = !value ? [] : state.topics.includes(value) ? state.topics.filter(topic => topic !== value) : [...state.topics, value];
  };
  root.addEventListener('click', event => {
    const pageButton = event.target.closest('button[data-page]');
    if (pageButton && root.contains(pageButton) && !pageButton.disabled) {
      const page = Number(pageButton.dataset.page);
      if (!Number.isSafeInteger(page) || page < 1 || page === state.page) return;
      state.page = page;
      render();
      count.focus({ preventScroll: true });
      count.scrollIntoView({ block: 'start' });
      return;
    }
    const button = event.target.closest('button[data-filter]');
    if (button && root.contains(button)) {
      const key = button.dataset.filter;
      if (key === 'topic') toggleTopic(button.dataset.value);
      else state[key] = button.dataset.value;
      state.page = 1;
      render();
      return;
    }
    const topic = event.target.closest('a[data-topic]');
    if (topic && root.contains(topic)) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const selectedTopic = topic.dataset.topic;
      toggleTopic(selectedTopic);
      state.page = 1;
      render();
      const target = topicRow.hidden ? query : [...topicOptions.querySelectorAll('button')].find(button => button.dataset.value === selectedTopic)
        || topicOptions.querySelector('[data-value=""]');
      target.focus({ preventScroll: true });
      const bounds = topicRow.getBoundingClientRect();
      if (!topicRow.hidden && (bounds.top < 0 || bounds.bottom > window.innerHeight)) topicRow.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.target.closest('[data-reset]')) {
      state = defaults(); query.value = ''; sort.value = state.sort;
      render();
    }
  });
  query.addEventListener('input', () => { state.q = query.value; state.page = 1; render(); });
  sort.addEventListener('change', () => { state.sort = sort.value; state.page = 1; render(); });
  window.addEventListener('popstate', () => { readURL(); render(false); });
  readURL();
  render(false);
  root.querySelectorAll('[data-controls]').forEach(element => { element.hidden = false; });
})();
