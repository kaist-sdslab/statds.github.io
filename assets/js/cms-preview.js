(() => {
  const settings = JSON.parse(document.getElementById('cms-preview-settings').textContent);
  const seed = settings.data;
  settings.styles.forEach(url => CMS.registerPreviewStyle(new URL(url, window.location.origin).href));
  const node = (tag, className, ...children) => h(tag, className ? { className } : null, ...children);
  const edit = (ctx, path, element) => {
    if (!ctx.editable || !element) return element;
    return h(element.type, { ...element.props, 'data-cms-field': path, tabIndex: 0,
      'data-cms-selected': ctx.state.selectedField === path || undefined,
      title: `Edit ${path}`, 'aria-label': `Edit ${path}` });
  };
  const pageEdit = (ctx, path, element) => edit({ ...ctx, editable: ctx.collection === 'pages' }, path, element);
  const labelEdit = (ctx, path, element) => {
    const [section, ...parts] = path.split('.');
    const owner = { about: 'about', professor: 'professors', people: 'people', publications: 'publications', resources: ctx.page }[section];
    const common = section === 'site' || section === 'links';
    return edit({ ...ctx, editable: common ? ctx.name === 'site_settings' : ctx.collection === 'pages' && ctx.name === owner },
      common ? path : `labels.${parts.join('.')}`, element);
  };
  const recordContext = (ctx, record) => ({ ...ctx, editable: record === ctx.data });
  const fieldTarget = (props, path) => {
    let fields = props.fields?.toJS() || [];
    const parts = path.split('.');
    const resolved = [];
    for (let i = 0; i < parts.length; i++) {
      const field = fields.find(item => item.name === parts[i]);
      if (!field) return { path };
      resolved.push(field.name);
      const widget = field.control_widget || field.widget;
      if (widget === 'object') fields = field.fields || [];
      else if (widget === 'list') {
        const hasIndex = /^\d+$/.test(parts[i + 1] || '');
        if (!field.fields && !field.field && !field.types) {
          return { path: resolved.join('.'), inputName: field.name, index: hasIndex ? Number(parts[i + 1]) : null };
        }
        if (hasIndex) resolved.push(parts[++i]);
        else resolved.push('0');
        if (field.field) return { path: [...resolved, field.field.name].join('.') };
        fields = field.fields || [];
      }
    }
    return { path: resolved.join('.') };
  };
  const list = value => Array.isArray(value) ? value : [];
  const text = value => value == null ? '' : String(value);
  const key = value => text(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const sortDate = (year, month) => (Number(year) || 0) * 100 + (Number.isInteger(Number(month)) && Number(month) >= 1 && Number(month) <= 12 ? Number(month) : 0);
  const internshipKey = (value, end = false) => /^[1-9]\d{3}$/.test(value || '') ? `${value}-${end ? '12-31' : '01-01'}` : value || (end ? '9999-12-31' : '0000-01-01');
  const internshipPeriod = internship => {
    const dates = internship || {};
    const format = (value, year = true) => {
      if (/^[1-9]\d{3}$/.test(value || '')) return value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
    };
    return { start: format(dates.start_date, !dates.end_date || dates.start_date?.slice(0, 4) !== dates.end_date.slice(0, 4)), end: dates.end_date ? format(dates.end_date) : 'Present' };
  };
  const accent = value => {
    const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '') ? value : '#285c9b';
    return { '--topic-color': color, '--topic-soft': `color-mix(in srgb, ${color} 9%, white)`, '--topic-line': `color-mix(in srgb, ${color} 25%, white)` };
  };
  const icon = type => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    ...(type === 'github' ? ['M9 19c-4.3 1.3-4.3-2.5-6-3m12 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-6 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22'] : ['M15 3h6v6M10 14 21 3', 'M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5']).map(d => h('path', { d })));
  const link = (label, className, children) => h('a', { href: '#', className, title: label, 'aria-label': label }, children);
  const resource = (type, url, labels, className) => url
    ? link(labels.github_title, className, icon(type))
    : h('span', { className: `${className || ''} resource-unavailable`, role: 'img', title: labels.no_github }, icon(type));
  const image = (path, alt, props, className, extra = {}) => path ? h('img', {
    src: String(window.SDSCMSMedia.resolveAsset(props.getAsset, path)), alt: alt || '', className, decoding: 'async', ...extra
  }) : null;
  const portraitStyle = value => {
    if (window.SDSCMSPortrait) return window.SDSCMSPortrait.style(value);
    const bound = (value, low, high, fallback) => Number.isFinite(Number(value)) ? Math.max(low, Math.min(high, Number(value))) : fallback;
    const x = bound(value?.position_x ?? value?.x ?? 50, 0, 100, 50), y = bound(value?.position_y ?? value?.y ?? 50, 0, 100, 50), zoom = bound(value?.zoom ?? 1, 1, 3, 1);
    return { objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` };
  };
  const paragraphs = value => text(value).trim().split(/\n\s*\n/).filter(Boolean).map(part => node('p', null, part));
  const colorFor = (topic, colors) => {
    let color = '#285c9b';
    list(colors.assignments).forEach(rule => { if (list(rule.topics).some(value => key(value) === key(topic))) color = rule.color; });
    return color;
  };
  const colorEdit = (ctx, topic, element) => {
    const rules = list(ctx.colors.assignments);
    let index = -1;
    rules.forEach((rule, i) => { if (list(rule.topics).some(value => key(value) === key(topic))) index = i; });
    return index < 0 ? element : edit({ ...ctx, editable: ctx.name === 'topic_colors' }, `assignments.${index}.color`, element);
  };
  const availableTopics = (values, ctx, scope) => {
    if (window.SDSCMSTopics) return window.SDSCMSTopics.resolve(values, scope);
    const existing = new Map(ctx.papers.flatMap(paper => list(paper.topics)).map(value => [key(value), value]));
    if (scope === 'filters') for (const id of existing.keys()) if (!list(ctx.filters.topics).some(topic => key(topic) === id)) existing.delete(id);
    return [...new Set(list(values).map(value => existing.get(key(value))).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }));
  };
  const topics = (values, colors, ctx) => list(values).slice().sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })).map(value => colorEdit(ctx, value, h('a', { href: '#', style: accent(colorFor(value, colors)), onClick: event => {
    if (!['publications', 'publication_filters'].includes(ctx.name) && !(ctx.name === 'site_settings' && ctx.state.previewPage === 'publications')) return;
    event.preventDefault();
    const selected = availableTopics(ctx.state.topics || [], ctx);
    ctx.update({ topics: selected.includes(value) ? selected.filter(topic => topic !== value) : [...selected, value], page: 1 });
  } }, value)));
  const socialIcon = type => type === 'linkedin'
    ? h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }), h('path', { d: 'M7 10v7m0-10v.01M11 17v-7m0 3a3 3 0 0 1 6 0v4' }))
    : type === 'website' ? h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('circle', { cx: 12, cy: 12, r: 9 }), h('ellipse', { cx: 12, cy: 12, rx: 4, ry: 9 }), h('path', { d: 'M3 12h18' })) : icon('github');
  const email = (person, ctx) => node('div', 'person-links',
    person.email && h('details', { className: 'person-email', key: person.name },
      h('summary', { 'aria-label': `Email — ${person.name}` }, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }), h('path', { d: 'm3 6 9 7 9-7' })), node('span', 'sr-only', 'Email')),
      node('div', 'person-email-address', edit(ctx, 'email', h('a', { href: `mailto:${person.email}` }, person.email)))),
    ['linkedin', 'github', 'website'].some(type => person[type]) && node('div', 'person-socials',
      ...['linkedin', 'github', 'website'].filter(type => person[type]).map(type => edit(ctx, type, link(type === 'linkedin' ? 'LinkedIn' : type === 'github' ? 'GitHub' : 'Website', 'person-social', socialIcon(type))))));
  const person = (p, context) => {
    const ctx = recordContext(context, p);
    const field = (path, tag, cls, ...children) => edit(ctx, path, node(tag, cls, ...children));
    if (p.group === 'intern') {
      const period = internshipPeriod(p.internship);
      return node('article', 'person-compact intern-row', field('name', 'h3', null, p.name),
        p.affiliation && field('affiliation', 'p', 'person-note', p.affiliation),
        period.start && node('span', 'person-compact-meta', field('internship.start_date', 'span', null, period.start), period.start === period.end ? '' : ' – ', period.start !== period.end && field('internship.end_date', 'span', null, period.end)),
        p.internship?.program && field('internship.program', 'span', 'person-compact-detail', p.internship.program), p.biography && field('biography', 'p', 'person-biography', p.biography));
    }
    if (p.group === 'alumni') {
      const a = p.alumni || {};
      return node('article', 'person-compact alumnus-row', node('div', 'alumnus-identity', field('name', 'h3', null, p.name),
        (a.degree || a.graduation_year) && node('span', 'person-compact-meta alumnus-degree',
          a.degree && field('alumni.degree', 'span', null, a.degree), a.degree && a.graduation_year ? ', ' : '',
          a.graduation_year && field('alumni.graduation_year', 'span', null, a.graduation_year))),
        (a.thesis || a.position) && node('p', 'alumnus-summary', a.thesis && field('alumni.thesis', 'span', 'alumnus-thesis', `“${a.thesis}”`), a.thesis && a.position && node('span', 'alumnus-separator', ' · '), a.position && field('alumni.position', 'span', 'alumnus-position', a.position)), p.biography && field('biography', 'p', 'person-biography', p.biography));
    }
    const interests = list(p.research_interests).filter(topic => text(topic).trim());
    return node('article', 'person-card',
      node('div', 'person-profile', edit(ctx, p.photo ? 'photo_frame' : 'photo', node('div', 'person-portrait', p.photo ? image(p.photo, p.name, ctx.props, undefined, { style: portraitStyle(p.photo_frame) }) : node('div', 'person-initials', text(p.name).split(' ').slice(0, 2).map(word => word[0]).join('')))),
        node('div', 'person-info', field('name', 'h3', null, p.name), p.affiliation && field('affiliation', 'p', 'person-note', p.affiliation), p.member_note && field('member_note', 'p', 'person-member-note', p.member_note),
          interests.length > 0 && node('div', 'person-interests', edit(ctx, 'research_interests', node('ul', 'person-interest-tags', ...interests.map(topic => h('li', { className: 'person-interest-tag', style: accent(colorFor(topic, ctx.colors)) }, topic))))))),
      (p.biography || ctx.editable) && node('div', 'person-body', p.biography ? field('biography', 'p', 'person-biography', p.biography) : field('biography', 'p', 'person-biography-placeholder', 'Add a self-introduction in the form.')),
      email(p, ctx));
  };
  const paper = (p, context, detail = false) => {
    const ctx = recordContext(context, p);
    const field = (path, tag, cls, ...children) => edit(ctx, path, node(tag, cls, ...children));
    return node('article', 'publication-card', field('year', 'div', 'publication-year', p.year), node('div', 'publication-card-body',
      field('title', detail ? 'h1' : 'h2', null, p.url_paper ? h('a', { href: p.url_paper }, p.title) : p.title),
      node('div', 'publication-citation', node('p', 'publication-authors', ...list(p.authors).map((author, index) => field(`authors.${index}`, 'span', null, author, index < p.authors.length - 1 ? ', ' : ''))),
        field('venue', 'p', 'publication-venue', p.venue, p.venue_details && field('venue_details', 'span', null, ` · ${p.venue_details}`))),
      node('div', 'publication-footer', field('publication_type', 'span', 'publication-kind', p.publication_type === 'conference' ? ctx.labels.publications.conference_label : ctx.labels.publications.journal_label),
        field('topics', 'div', 'publication-topics', ...topics(p.topics, ctx.colors, ctx)), p.url_code && node('div', 'publication-resources', edit(ctx, 'url_code', resource('github', p.url_code, ctx.labels.links))))));
  };
  const about = (data, ctx) => node('div', null,
    node('section', 'research-section shell about-research', node('div', 'section-heading', labelEdit(ctx, 'about.research_heading', node('h1', null, ctx.labels.about.research_heading))), node('div', 'research-list', ...list(data.research).map((area, index) =>
      h('article', { className: 'research-item', style: accent(area.color) }, edit(ctx, `research.${index}.title`, node('h2', 'research-heading', link(area.title, null, area.title))), edit(ctx, `research.${index}.image`, node('div', 'research-visual', image(area.image, area.image_alt, ctx.props))),
        node('div', 'research-copy', edit(ctx, `research.${index}.description`, node('div', 'research-description', ...paragraphs(area.description))), availableTopics(area.publication_topics, ctx, 'filters').length > 0 && edit(ctx, `research.${index}.publication_topics`, labelEdit(ctx, 'about.related_publications', link(ctx.labels.about.related_publications, 'research-publications', `${ctx.labels.about.related_publications} →`)))))))));
  const publishedNews = () => list(seed.news).filter(post => !post.draft).slice().sort((a, b) => text(b.date).localeCompare(text(a.date)));
  const newsDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  const home = (data, ctx) => {
    const settings = data.slideshow || {}, labels = data.news || {};
    const published = publishedNews();
    const posts = published.filter(post => post.image && post.show_in_slideshow !== false).slice(0, settings.limit || 5);
    const top = published.slice().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).slice(0, Math.max(1, Math.min(30, Math.floor(Number(labels.limit) || 10))));
    const selected = Math.min(ctx.state.slide || 0, Math.max(0, posts.length - 1));
    const post = posts[selected];
    return node('div', null,
      node('section', 'hero shell home-hero',
        node('div', 'home-hero-gallery', post ? node('div', 'news-slideshow',
          node('article', 'news-slide', node('div', 'news-slide-image', image(post.image, post.image_alt, ctx.props))),
          posts.length > 1 && node('div', 'slideshow-controls', h('button', { type: 'button', onClick: () => ctx.update({ slide: (selected + posts.length - 1) % posts.length }) }, settings.previous), node('span', null, `${selected + 1} / ${posts.length}`), h('button', { type: 'button', onClick: () => ctx.update({ slide: (selected + 1) % posts.length }) }, settings.next)))
          : node('div', 'home-gallery-empty', node('span', 'home-gallery-mark', 'SDS', node('span', null, 'STATISTICAL DATA SCIENCE')), edit(ctx, 'slideshow.empty', node('p', null, settings.empty)))),
        node('div', 'lab-introduction', edit(ctx, 'hero.welcome', node('h1', null, data.hero?.welcome)), edit(ctx, 'hero.description', node('p', 'hero-description', data.hero?.description)), edit(ctx, 'hero.button_label', link(data.hero?.button_label, 'home-research-button', [data.hero?.button_label, ' →'])))),
      node('section', 'shell home-news', node('div', 'section-heading', edit(ctx, 'news.heading', node('h2', null, labels.heading)), edit(ctx, 'news.view_all', link(labels.view_all, 'text-link', `${labels.view_all} →`))),
        top.length ? node('ul', 'home-news-list', ...top.map(post => node('li', null, link(post.title, null, [node('time', null, newsDate(post.date)), node('span', 'home-news-item-title', post.title), post.pinned && node('span', 'news-pin', ctx.labels.news.pinned), node('span', 'home-news-arrow', '↗')]))))
          : edit(ctx, 'news.empty', node('p', 'news-empty', labels.empty))));
  };
  const newsArticle = (data, ctx) => node('article', 'shell news-article',
    node('span', 'text-link news-back', `← ${ctx.labels.news.back}`),
    node('header', null, edit(ctx, 'date', node('time', null, newsDate(data.date))), edit(ctx, 'title', node('h1', null, data.title))),
    data.image && !window.SDSNewsEditor.parseDocument(data.body) && edit(ctx, 'image', node('figure', 'news-cover', image(data.image, data.image_alt, ctx.props))),
    edit(ctx, 'body', node('div', `news-body news-text-${['left', 'center', 'right', 'justify'].includes(data.body_alignment) ? data.body_alignment : 'left'}`, ctx.props.widgetFor('body'))));
  const newsList = (data, ctx) => {
    const labels = data.labels || seed.labels.news;
    const posts = publishedNews().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
    const size = Math.max(1, Number(data.page_size) || 8), pages = Math.max(1, Math.ceil(posts.length / size));
    const page = Math.min(ctx.state.page || 1, pages);
    return node('section', 'shell news-page',
      node('header', 'news-header', node('div', null, pageEdit(ctx, 'title', node('h1', null, data.title)), pageEdit(ctx, 'description', node('p', null, data.description)))),
      node('p', 'news-results', `${posts.length} ${labels.results}`),
      node('div', 'news-list', ...posts.slice((page - 1) * size, page * size).map(post => node('article', 'news-card',
        node('div', `news-thumbnail${post.image ? '' : ' news-thumbnail-empty'}`, post.image ? image(post.image, post.image_alt, ctx.props) : node('span', null, 'SDS', node('span', null, 'LAB NEWS'))),
        node('div', 'news-card-copy', node('div', 'news-meta', node('time', null, newsDate(post.date)), post.pinned && node('span', 'news-pin', labels.pinned)), node('h2', null, post.title), link(labels.read_more, 'text-link', `${labels.read_more} →`))))),
      !posts.length && node('p', 'news-empty', labels.empty),
      pages > 1 && node('nav', 'news-pagination', h('button', { disabled: page === 1, onClick: () => ctx.update({ page: page - 1 }) }, labels.previous), node('span', null, `${labels.page} ${page} / ${pages}`), h('button', { disabled: page === pages, onClick: () => ctx.update({ page: page + 1 }) }, labels.next)));
  };
  const professor = (data, ctx) => {
    const labels = ctx.labels.professor;
    const field = (path, tag, cls, ...children) => edit(ctx, path, node(tag, cls, ...children));
    const section = (labelPath, title, rows) => node('section', 'professor-section', labelEdit(ctx, `professor.${labelPath}`, node('h2', null, title)), node('ul', 'professor-records', ...rows));
    return node('article', 'shell professor-page', field('title', 'h1', 'professor-page-title', data.title),
      node('section', 'professor-profile', edit(ctx, 'photo_frame', node('div', 'professor-portrait', image(data.photo, data.photo_alt, ctx.props, 'professor-photo', { style: portraitStyle(data.photo_frame) }))), node('div', 'professor-identity', field('name', 'h2', null, data.name),
        node('ul', 'professor-roles', ...list(data.roles).map((role, i) => node('li', null, field(`roles.${i}.title`, 'strong', null, role.title), field(`roles.${i}.department`, 'span', null, role.department)))), field('institution', 'p', 'professor-institution', data.institution),
        node('dl', 'professor-contact', node('div', null, labelEdit(ctx, 'professor.email', node('dt', null, labels.email)), field('email', 'dd', null, data.email)), node('div', null, labelEdit(ctx, 'professor.office', node('dt', null, labels.office)), field('office', 'dd', null, data.office))))),
      section('interests', labels.interests, list(data.research_interests).map((row, i) => node('li', null, field(`research_interests.${i}.title`, 'h3', null, row.title), row.detail && field(`research_interests.${i}.detail`, 'p', 'record-detail', row.detail)))),
      section('education', labels.education, list(data.education).map((row, i) => node('li', null, field(`education.${i}.degree`, 'h3', null, row.degree), field(`education.${i}.institution`, 'p', 'record-institution', row.institution), field(`education.${i}.department`, 'p', 'record-detail', row.department)))),
      ...[['experience', labels.experience, 'experience'], ['editorial_service', labels.editorial, 'editorial']].map(([fieldName, title, labelPath]) => section(labelPath, title, list(data[fieldName]).map((row, i) => node('li', 'dated-record', field(`${fieldName}.${i}.period`, 'p', 'record-period', row.period), node('div', null, field(`${fieldName}.${i}.${row.journal ? 'journal' : 'role'}`, 'h3', null, row.journal || row.role), field(`${fieldName}.${i}.${row.journal ? 'role' : 'institution'}`, 'p', 'record-detail', row.journal ? row.role : row.institution)))))));
  };
  const people = (title, records, ctx) => {
    const labels = ctx.labels.people;
    const selected = ctx.state.tab || (ctx.editing?.group === 'intern' ? 'interns' : ctx.editing?.group === 'alumni' ? 'alumni' : 'members');
    const groups = { members: [['phd', labels.phd_heading, 'blue'], ['masters', labels.masters_heading, 'teal']], interns: [['intern', labels.interns_heading, 'purple']], alumni: [['alumni', labels.alumni_heading, 'neutral']] };
    return node('section', 'shell people-page', node('header', 'people-intro', pageEdit(ctx, 'title', node('h1', null, title))),
      h('div', { className: 'people-tabs', role: 'tablist' }, ...['members', 'interns', 'alumni'].map(tab => labelEdit(ctx, `people.${tab}_tab`, h('button', { type: 'button', role: 'tab', 'aria-selected': selected === tab, onClick: () => ctx.update({ tab }) }, labels[`${tab}_tab`])))),
      ...groups[selected].map(([group, heading, color]) => {
        const members = records.filter(p => p.group === group).sort((a, b) => group === 'alumni'
          ? sortDate(b.alumni?.graduation_year, 0) - sortDate(a.alumni?.graduation_year, 0) || text(a.name).localeCompare(text(b.name), 'en', { sensitivity: 'base' })
          : group === 'intern' ? internshipKey(b.internship?.start_date).localeCompare(internshipKey(a.internship?.start_date)) || internshipKey(b.internship?.end_date, true).localeCompare(internshipKey(a.internship?.end_date, true)) || text(a.name).localeCompare(text(b.name), 'en', { sensitivity: 'base' })
          : (a.order || 0) - (b.order || 0));
        return node('section', `people-section people-accent-${color}`, node('div', 'people-section-heading', edit({ ...ctx, editable: ctx.collection === 'people' && ctx.editing?.group === group }, 'group', node('h2', null, heading))), members.length
          ? h('div', group === 'phd' || group === 'masters' ? { className: 'people-grid' } : { className: `people-compact-list people-scroll-list ${group}-list`, tabIndex: 0, role: 'region', 'aria-label': heading }, ...members.map(p => person(p, ctx))) : node('p', 'people-empty', labels.empty));
      }));
  };
  const resources = (title, records, type, ctx) => node('section', 'shell resources-page', pageEdit(ctx, 'title', node('h1', null, title)), node('div', 'resource-list',
    ...records.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => {
      const record = recordContext(ctx, item);
      const field = (path, tag, cls, ...children) => edit(record, path, node(tag, cls, ...children));
      return node('article', `resource-item ${type === 'courses' ? 'course-item' : 'software-item'}`,
        node('div', 'resource-information', type === 'courses' && item.code && field('code', 'p', 'course-code', item.code), field('title', 'h2', null, item.title),
          type === 'courses' ? list(item.terms).length > 0 && node('p', 'course-terms', labelEdit(ctx, 'resources.offered', node('span', null, ctx.labels.resources.offered)), ...item.terms.map((term, i) => field(`terms.${i}`, 'span', null, term, i < item.terms.length - 1 ? ' · ' : ''))) : item.description && field('description', 'p', 'resource-description', item.description)),
        type === 'software' && node('div', 'resource-links software-links', edit(record, 'github', resource('github', item.github, ctx.labels.links, 'software-github'))));
    }), records.length === 0 && node('p', 'resources-empty', ctx.labels.resources.empty)));
  const publications = (title, ctx) => {
    const labels = ctx.labels.publications;
    const state = ctx.state;
    const selectedTopics = availableTopics(state.topics || [], ctx);
    const displayedTopics = availableTopics(ctx.filters.topics, ctx);
    const topicChoices = [...new Set([...displayedTopics, ...selectedTopics])].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }));
    const button = (filter, value, label) => {
      const element = h('button', { type: 'button', 'aria-pressed': filter === 'topics' ? (value ? selectedTopics.includes(value) : !selectedTopics.length) : (state[filter] || '') === value,
      style: filter === 'topics' && value ? accent(colorFor(value, ctx.colors)) : undefined, 'data-filter': filter === 'topics' ? 'topic' : filter, 'data-value': value, 'data-temporary-topic': filter === 'topics' && value && !displayedTopics.includes(value) ? '' : undefined,
      onClick: () => ctx.update({ [filter]: filter === 'topics' ? !value ? [] : selectedTopics.includes(value) ? selectedTopics.filter(v => v !== value) : [...selectedTopics, value] : value, page: 1 }) }, label);
      return filter === 'topics' && value ? colorEdit(ctx, value, element) : element;
    };
    const row = (label, filter, values) => edit({ ...ctx, editable: ctx.name === 'publication_filters' && filter !== 'kind' }, filter === 'year' ? 'years' : 'topics',
      node('div', 'filter-row', labelEdit(ctx, `publications.${filter === 'kind' ? 'type' : filter === 'topics' ? 'topic' : 'year'}`, node('span', 'filter-label', label)), node('div', 'filter-options', button(filter, '', labels.all), ...values.map(v => button(filter, v.value ?? v, v.label ?? v)))));
    const filtered = ctx.papers.filter(p => (!state.kind || p.publication_type === state.kind) && (!state.year || String(p.year) === String(state.year)) && (!selectedTopics.length || selectedTopics.some(t => list(p.topics).includes(t))) && key(state.query).split(' ').filter(Boolean).every(term => key([p.title, ...list(p.authors), p.venue, ...list(p.topics)].join(' ')).includes(term)))
      .sort((a, b) => (state.sort === 'title' ? 0 : state.sort === 'oldest' ? sortDate(a.year, a.month) - sortDate(b.year, b.month) : sortDate(b.year, b.month) - sortDate(a.year, a.month)) || text(a.title).localeCompare(text(b.title), 'en', { sensitivity: 'base' }));
    const size = Math.min(100, Math.max(1, Number(labels.page_size) || 10));
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    const page = Math.min(state.page || 1, pages);
    const slots = pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1) : page <= 4 ? [1, 2, 3, 4, 5, '…', pages] : page >= pages - 3 ? [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages] : [1, '…', page - 1, page, page + 1, '…', pages];
    const format = value => text(value).replace(/\{(start|end|total|noun)\}/g, (_, name) => ({ start: (page - 1) * size + 1, end: Math.min(page * size, filtered.length), total: filtered.length, noun: filtered.length === 1 ? labels.singular : labels.plural }[name]));
    return node('section', 'shell publications-page', pageEdit(ctx, 'title', node('h1', 'publications-title', title)), node('div', 'publication-controls',
      node('div', 'publication-search', node('label', null, labels.search), node('div', 'publication-search-field', h('input', { value: state.query || '', placeholder: labels.search_placeholder, onChange: event => ctx.update({ query: event.target.value, page: 1 }) }), h('button', { type: 'button', className: 'reset-filters', onClick: () => ctx.update({ query: '', topics: [], kind: '', year: '', page: 1 }) }, labels.reset))),
      row(labels.type, 'kind', [{ value: 'journal', label: labels.journal_filter }, { value: 'conference', label: labels.conference_filter }]),
      list(ctx.filters.years).length > 0 && row(labels.year, 'year', [...new Set(ctx.filters.years)].sort((a, b) => b - a).map(String)),
      topicChoices.length > 0 && row(labels.topic, 'topics', topicChoices)),
      node('div', 'publication-results-bar', node('p', null, format(filtered.length ? labels.count : labels.empty_count)),
        node('div', 'publication-sort', node('label', null, labels.sort), h('select', { value: state.sort || 'newest', 'aria-label': labels.sort, onChange: event => ctx.update({ sort: event.target.value, page: 1 }) },
          ...['newest', 'oldest', 'title'].map(value => h('option', { value }, labels[value === 'title' ? 'title_sort' : value]))))),
      node('div', 'publication-list', ...filtered.slice((page - 1) * size, page * size).map(p => paper(p, ctx))),
      filtered.length === 0 && node('div', 'publication-empty', node('h2', null, labels.empty_title), node('p', null, labels.empty_text)),
      pages > 1 && node('nav', 'publication-pagination', h('button', { disabled: page === 1, onClick: () => ctx.update({ page: page - 1 }) }, labels.previous),
        node('span', 'publication-page-numbers', ...slots.map(value => value === '…' ? h('span', { 'aria-hidden': true }, value) : h('button', { 'aria-current': value === page ? 'page' : undefined, 'aria-label': text(labels.page_label).replace('{page}', value), onClick: () => ctx.update({ page: value }) }, value))),
        h('button', { disabled: page === pages, onClick: () => ctx.update({ page: page + 1 }) }, labels.next)));
  };
  const replaceRecord = (records, entry, data) => [...records.filter(item => item._slug !== entry.get('slug')), data];
  const preview = name => createClass({
    getInitialState() { return { tab: null, page: 1, query: '', topics: [], kind: '', year: '', previewPage: 'home' }; },
    componentDidUpdate(previous) {
      if (previous.entry.get('slug') !== this.props.entry.get('slug')) this.setState(this.getInitialState());
      else if (previous.entry.getIn(['data', 'group']) !== this.props.entry.getIn(['data', 'group'])) this.setState({ tab: null });
    },
    componentWillUnmount() { this.cancelFieldFocus?.(); },
    selectField(event) {
      const target = event.target.closest('[data-cms-field]');
      if (!target || typeof this.props.onFieldClick !== 'function') {
        if (event.target.closest('a')) event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const path = target.getAttribute('data-cms-field');
      this.setState({ selectedField: path });
      const destination = fieldTarget(this.props, path);
      this.cancelFieldFocus?.();
      this.cancelFieldFocus = window.SDSCMSFocus.begin(this.props.document);
      this.props.onFieldClick(destination.path);
      // A plain list is one comma-separated input, without child control refs.
      if (destination.inputName) {
        const input = [...window.document.querySelectorAll('input[id]')].find(element => element.id.startsWith(`${destination.inputName}-field-`));
        if (input) {
          input.focus({ preventScroll: true });
          if (destination.index !== null) {
            const values = input.value.split(',');
            const item = values[destination.index];
            if (item !== undefined) {
              const start = values.slice(0, destination.index).reduce((total, value) => total + value.length + 1, 0) + (item.length - item.trimStart().length);
              input.setSelectionRange(start, start + item.trim().length);
            }
          }
        }
      }
    },
    render() {
      const data = this.props.entry.get('data').toJS();
      const collection = this.props.collection.get('name');
      const common = name === 'site_settings' ? data : seed.settings;
      const labels = { ...seed.labels, site: common.site, links: common.links };
      const labelSection = { about: 'about', professors: 'professor', publications: 'publications', people: 'people', news_page: 'news' }[name];
      if (collection === 'pages' && labelSection) labels[labelSection] = data.labels;
      const ctx = { name, data, collection, editable: ['home', 'about', 'professors', 'news'].includes(name), props: this.props, labels, colors: name === 'topic_colors' ? data : seed.colors, filters: name === 'publication_filters' ? data : seed.filters, papers: seed.papers, state: this.state, update: patch => this.setState(patch) };
      let content, page = name;
      if (name === 'site_settings') page = this.state.previewPage;
      ctx.page = page;
      if (page === 'software' || page === 'courses') labels.resources = collection === 'pages' ? data.labels : seed.pages[page].labels;
      const pageData = name === 'site_settings' ? seed.pages[page] : data;
      if (page === 'home') content = home(pageData, ctx);
      else if (page === 'about') content = about(pageData, ctx);
      else if (name === 'news') content = newsArticle(data, ctx);
      else if (page === 'news_page') content = newsList(pageData, ctx);
      else if (page === 'professors') content = professor(pageData, ctx);
      else if (name === 'papers') content = node('div', 'shell publications-page', paper(data, ctx));
      else if (page === 'people') {
        const records = collection === 'people' ? replaceRecord(seed.people, this.props.entry, data) : seed.people;
        ctx.editing = collection === 'people' ? data : null;
        content = people(collection === 'pages' || name === 'site_settings' ? pageData.title : seed.pages.people.title, records, ctx);
      } else if (page === 'software' || page === 'courses') content = resources(collection === 'pages' || name === 'site_settings' ? pageData.title : seed.pages[page].title, collection === 'pages' || name === 'site_settings' ? seed[page] : replaceRecord(seed[page], this.props.entry, data), page, ctx);
      else if (page === 'not_found') content = node('section', 'shell pending-page',
        pageEdit(ctx, 'title', node('h1', null, pageData.title)), pageEdit(ctx, 'description', node('p', null, pageData.description)),
        pageEdit(ctx, 'back', link(pageData.back, 'pending-home', [pageData.back, ' →'])));
      else if (name === 'publications' || name === 'publication_filters' || name === 'topic_colors') { content = publications(data.title || seed.pages.publications.title, ctx); page = 'publications'; }
      else if (page === 'publications') content = publications(pageData.title, ctx);
      else { content = home(seed.home, ctx); page = 'home'; }
      const menu = list(common.navigation).slice().sort((a, b) => (a.weight || 0) - (b.weight || 0));
      const active = { home: '', about: 'about/', news: 'news/', news_page: 'news/', professors: 'professors/', papers: 'publications/', publications: 'publications/', people: 'people/', software: 'software/', courses: 'courses/' }[page];
      const footerContext = { ...ctx, editable: name === 'site_settings' };
      return h('div', { className: 'cms-site-preview', onClick: this.selectField, onKeyDown: event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.matches('input, textarea, select, button')) this.selectField(event);
      } },
        name === 'site_settings' && node('div', 'cms-preview-toolbar', node('label', null, 'Preview page', h('select', {
          value: this.state.previewPage, 'aria-label': 'Preview page', onChange: event => this.setState({ previewPage: event.target.value, tab: null, page: 1 })
        }, ...[['home', 'Home'], ['about', 'About'], ['professors', 'Professor'], ['people', 'Students'], ['publications', 'Publications'], ['news_page', 'News'], ['software', 'Softwares'], ['not_found', 'Not Found']].map(([value, label]) => h('option', { value }, label))))),
        node('header', 'site-header', node('div', 'shell header-inner', link(labels.site.name, 'wordmark', [labelEdit(ctx, 'site.logo', node('span', 'wordmark-logo', labels.site.logo)), node('span', 'wordmark-description', labelEdit(ctx, 'site.name', node('span', null, labels.site.name)), labelEdit(ctx, 'site.institution', node('span', 'wordmark-institution', labels.site.institution)))]),
          node('nav', null, ...menu.map(item => edit({ ...ctx, editable: name === 'site_settings' }, `navigation.${list(common.navigation).indexOf(item)}.name`, link(item.name, (item.url || '').replace(seed.basePath, '') === active ? 'active' : null, item.name)))))),
        node('main', null, content), node('footer', null, node('div', 'shell footer-inner', node('div', null, edit(footerContext, 'contact.title', node('p', 'footer-title', common.contact?.title)), edit(footerContext, 'contact.address', node('address', null, common.contact?.address))), labelEdit(ctx, 'site.copyright', node('span', 'copyright', `© ${seed.year} ${labels.site.copyright}`)))));
    }
  });
  ['home', 'about', 'news', 'news_page', 'professors', 'publications', 'people', 'software', 'not_found', 'site_settings', 'papers', 'publication_filters', 'topic_colors'].forEach(name => CMS.registerPreviewTemplate(name, preview(name)));
})();
