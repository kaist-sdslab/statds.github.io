(() => {
  const key = value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const clean = value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  const colorValue = value => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '') ? value : '#285c9b';
  const colorStyle = value => {
    const color = colorValue(value);
    return { '--topic-color': color, '--topic-soft': `color-mix(in srgb, ${color} 9%, white)`, '--topic-line': `color-mix(in srgb, ${color} 25%, white)` };
  };
  const catalog = new Map();
  const listeners = new Set();
  const remember = (topic, persisted = false) => {
    const existing = [...catalog.values()].find(item => key(item.id) === key(topic.id) || key(item.label) === key(topic.label));
    if (!existing) catalog.set(topic.id, { ...topic, persisted });
    else if (persisted) existing.persisted = true;
    return existing || catalog.get(topic.id);
  };
  JSON.parse(document.getElementById('publication-tag-catalog').textContent).forEach(topic => remember(topic, true));
  const sorted = value => [...value].sort((a, b) => (lookup(a) || { label: a }).label.localeCompare((lookup(b) || { label: b }).label, 'en', { sensitivity: 'base', numeric: true }));
  const values = value => value && typeof value.toArray === 'function' ? value.toArray() : (value || []);
  const lookup = (value, persistedOnly = false) => [...catalog.values()].find(item => (!persistedOnly || item.persisted) && (key(item.id) === key(value) || key(item.label) === key(value)));

  const permitted = (topic, field) => field.get('topic_scope') !== 'filters' || filterTopics.some(value => key(value) === key(topic.id));
  const TagsControl = createClass({
    getInitialState() { return { query: '', message: '' }; },
    componentDidMount() {
      this.refresh = () => this.forceUpdate();
      listeners.add(this.refresh);
    },
    componentWillUnmount() { listeners.delete(this.refresh); },
    addTag() {
      const text = clean(this.state.query);
      if (!text) return;
      const canCreate = this.props.field.get('allow_create', false);
      let topic = lookup(text, !canCreate);
      if ((!topic || !permitted(topic, this.props.field)) && !canCreate) {
        this.setState({ message: this.props.field.get('topic_scope') === 'filters' ? 'Choose a topic enabled in Publication Filter Display.' : 'Choose a saved publication tag. Save its publication first if the tag is new.' });
        return;
      }
      if (!topic) {
        topic = remember({ id: text, label: text });
        listeners.forEach(refresh => refresh());
      }
      const selected = sorted(values(this.props.value)).filter(value => this.props.field.get('topic_scope') !== 'filters' || lookup(value, true) && permitted(lookup(value, true), this.props.field));
      if (!selected.some(id => key((lookup(id) || { id }).id) === key(topic.id))) {
        this.props.onChange(sorted([...selected, topic.id]));
      }
      this.setState({ query: '', message: '' });
    },
    render() {
      const selected = sorted(values(this.props.value)).filter(value => this.props.field.get('topic_scope') !== 'filters' || lookup(value, true) && permitted(lookup(value, true), this.props.field));
      const selectedIDs = new Set(selected.map(value => (lookup(value) || { id: value }).id));
      const canCreate = this.props.field.get('allow_create', false);
      const suggestions = [...catalog.values()].filter(topic => (canCreate || topic.persisted) && permitted(topic, this.props.field) && !selectedIDs.has(topic.id)).sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base', numeric: true }));
      const inputID = this.props.forID;
      const listID = `${inputID}-suggestions`;
      const messageID = `${inputID}-message`;
      const canAdd = clean(this.state.query) && (canCreate || lookup(this.state.query, true) && permitted(lookup(this.state.query, true), this.props.field));
      return h('div', { className: `${this.props.classNameWrapper || ''} publication-tag-editor` },
        h('div', { className: 'cms-tag-selection' }, selected.map(id => {
          const label = (lookup(id) || { label: id }).label;
          return h('span', { className: 'cms-tag-chip', key: id, style: colorStyle((lookup(id) || {}).color) },
            label,
            h('button', { type: 'button', 'aria-label': `Remove ${label}`, onClick: () => this.props.onChange(selected.filter(value => value !== id)) }, '×'));
        })),
        h('div', { className: 'cms-tag-input-row' },
          h('input', {
            id: inputID, type: 'text', list: listID, value: this.state.query,
            placeholder: canCreate ? 'Search or create a tag…' : 'Search existing tags…',
            autoComplete: 'off', 'aria-describedby': messageID,
            onChange: event => this.setState({ query: event.target.value, message: '' }),
            onKeyDown: event => {
              if (event.key === 'Enter' && !event.isComposing && !(event.nativeEvent && event.nativeEvent.isComposing) && event.keyCode !== 229) {
                event.preventDefault();
                this.addTag();
              }
            }
          }),
          h('button', { type: 'button', disabled: !canAdd, onClick: this.addTag },
            canCreate && clean(this.state.query) && !lookup(this.state.query) ? 'Create tag' : 'Add tag')),
        h('datalist', { id: listID }, suggestions.map(topic => h('option', { key: topic.id, value: topic.label }))),
        h('p', { id: messageID, className: 'cms-tag-help', role: 'status' }, this.state.message || 'Select a suggestion and press Enter or Add tag.')
      );
    }
  });
  CMS.registerWidget('publication-tags', TagsControl);
  // Tags belong to papers. Filter/Home selections never create or delete them.
  const previewData = JSON.parse(document.getElementById('cms-preview-settings').textContent).data;
  let filterTopics = previewData?.filters?.topics || [];
  let colorAssignments = previewData?.colors?.assignments || [];
  const paperUsage = new Map((previewData?.papers || []).map(paper => [paper._slug, paper.topics || []]));
  const refreshUsage = () => {
    catalog.forEach(topic => { topic.persisted = false; });
    paperUsage.forEach(topics => topics.forEach(value => {
      if (typeof value === 'string' && clean(value)) remember({ id: clean(value), label: clean(value) }, true);
    }));
    for (const [id, topic] of catalog) if (!topic.persisted) catalog.delete(id);
  };
  window.SDSCMSTopics = { resolve: (selected, scope) => sorted(values(selected).map(value => lookup(value, true)?.id).filter(value => value && (scope !== 'filters' || filterTopics.some(topic => key(topic) === key(value))))) };
  CMS.registerEventListener({ name: 'postSave', handler: ({ entry }) => {
    if (entry.get('collection') === 'papers') {
      paperUsage.set(entry.get('slug'), values(entry.getIn(['data', 'topics'])));
      refreshUsage();
    }
    if (entry.get('collection') === 'settings' && entry.get('slug') === 'publication_filters') filterTopics = values(entry.getIn(['data', 'topics']));
    const assignments = entry.getIn(['data', 'assignments']);
    if (assignments !== undefined) colorAssignments = assignments?.toJS ? assignments.toJS() : assignments || [];
    catalog.forEach(topic => { topic.color = '#285c9b'; });
    colorAssignments.forEach(rule => {
      (rule.topics || []).forEach(value => {
        const topic = lookup(value);
        if (topic) topic.color = colorValue(rule.color);
      });
    });
    listeners.forEach(refresh => refresh());
  } });
  CMS.registerEventListener({ name: 'preSave', handler: ({ entry }) => {
    const sortFields = (data, paths) => paths.reduce((result, path) => {
      const current = result.getIn(path);
      const selected = current && path[path.length - 1] === 'publication_topics' ? current.filter(value => window.SDSCMSTopics.resolve([value], 'filters').length) : current;
      return selected && typeof selected.toArray === 'function' ? result.setIn(path, selected.sort((a, b) => clean(a).localeCompare(clean(b), 'en', { sensitivity: 'base', numeric: true }))) : result;
    }, data);
    let data = sortFields(entry.get('data'), [['topics']]);
    for (const [field, nested] of [['research', 'publication_topics'], ['assignments', 'topics']]) {
      if (data.get(field)?.map) data = data.update(field, rows => rows.map(row => sortFields(row, [[nested]])));
    }
    return data;
  } });
  CMS.init();
})();
