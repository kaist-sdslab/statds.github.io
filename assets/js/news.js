(() => {
  const root = document.querySelector('[data-news]');
  if (!root) return;
  const cards = [...root.querySelectorAll('[data-news-card]')];
  const query = root.querySelector('[data-news-query]');
  const pager = root.querySelector('[data-news-pagination]');
  const pages = root.querySelector('[data-news-pages]');
  const previous = root.querySelector('[data-news-prev]');
  const next = root.querySelector('[data-news-next]');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const size = Math.max(1, Number(root.dataset.pageSize) || 8);
  const params = new URLSearchParams(location.search);
  let page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  query.value = params.get('q') || '';
  const render = (updateURL = false) => {
    const words = normalize(query.value).split(' ').filter(Boolean);
    const matches = cards.filter(card => words.every(word => normalize(card.dataset.search).includes(word)));
    const totalPages = Math.max(1, Math.ceil(matches.length / size));
    page = Math.min(Math.max(page, 1), totalPages);
    const visible = new Set(matches.slice((page - 1) * size, page * size));
    cards.forEach(card => { card.hidden = !visible.has(card); });
    root.querySelector('[data-news-total]').textContent = matches.length;
    root.querySelector('[data-news-empty]').hidden = matches.length > 0 || cards.length === 0;
    pager.hidden = totalPages <= 1;
    previous.disabled = page === 1;
    next.disabled = page === totalPages;
    pages.replaceChildren();
    const slots = new Set([1, totalPages, page - 1, page, page + 1].filter(n => n >= 1 && n <= totalPages));
    let last = 0;
    [...slots].sort((a, b) => a - b).forEach(number => {
      if (last && number - last > 1) { const gap = document.createElement('span'); gap.textContent = '…'; pages.append(gap); }
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = number; button.dataset.page = number;
      button.setAttribute('aria-label', `${root.dataset.pageLabel} ${number}`);
      if (number === page) button.setAttribute('aria-current', 'page');
      pages.append(button); last = number;
    });
    if (updateURL) {
      const url = new URL(location.href);
      if (query.value.trim()) url.searchParams.set('q', query.value.trim()); else url.searchParams.delete('q');
      if (page > 1) url.searchParams.set('page', page); else url.searchParams.delete('page');
      history.replaceState(null, '', url);
    }
  };
  const move = number => { page = number; render(true); pages.querySelector('[aria-current="page"]')?.focus({ preventScroll: true }); root.scrollIntoView({ block: 'start', behavior: 'auto' }); };
  previous.addEventListener('click', () => move(page - 1));
  next.addEventListener('click', () => move(page + 1));
  pages.addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) move(Number(button.dataset.page)); });
  query.addEventListener('input', () => { page = 1; render(true); });
  window.addEventListener('popstate', () => { const p = new URLSearchParams(location.search); query.value = p.get('q') || ''; page = Number.parseInt(p.get('page'), 10) || 1; render(); });
  render();
  root.querySelector('[data-news-search]').hidden = false;
  root.querySelector('[data-news-count]').hidden = false;
})();
