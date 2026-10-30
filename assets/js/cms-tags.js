(() => {
  const key = value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const clean = value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  const catalog = new Map();
  const listeners = new Set();
  const remember = (topic, persisted = false) => {
    const existing = [...catalog.values()].find(item => key(item.id) === key(topic.id) || key(item.label) === key(topic.label));
    if (!existing) catalog.set(topic.id, { ...topic, persisted });
    else if (persisted) existing.persisted = true;
    return existing || catalog.get(topic.id);
  };
  JSON.parse(document.getElementById('publication-tag-catalog').textContent).forEach(topic => remember(topic, true));
  const values = value => value && typeof value.toArray === 'function' ? value.toArray() : (value || []);
  const lookup = (value, persistedOnly = false) => [...catalog.values()].find(item => (!persistedOnly || item.persisted) && (key(item.id) === key(value) || key(item.label) === key(value)));

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
      if (!topic && !canCreate) {
        this.setState({ message: 'Choose a saved publication tag. Save its publication first if the tag is new.' });
        return;
      }
      if (!topic) {
        topic = remember({ id: text, label: text });
        listeners.forEach(refresh => refresh());
      }
      const selected = values(this.props.value);
      if (!selected.some(id => key((lookup(id) || { id }).id) === key(topic.id))) {
        this.props.onChange([...selected, topic.id]);
      }
      this.setState({ query: '', message: '' });
    },
    render() {
      const selected = values(this.props.value);
      const selectedIDs = new Set(selected.map(value => (lookup(value) || { id: value }).id));
      const canCreate = this.props.field.get('allow_create', false);
      const suggestions = [...catalog.values()].filter(topic => (canCreate || topic.persisted) && !selectedIDs.has(topic.id)).sort((a, b) => a.label.localeCompare(b.label));
      const inputID = this.props.forID;
      const listID = `${inputID}-suggestions`;
      const messageID = `${inputID}-message`;
      const canAdd = clean(this.state.query) && (canCreate || lookup(this.state.query, true));
      return h('div', { className: `${this.props.classNameWrapper || ''} publication-tag-editor` },
        h('div', { className: 'cms-tag-selection' }, selected.map(id => {
          const label = (lookup(id) || { label: id }).label;
          return h('span', { className: 'cms-tag-chip', key: id },
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
        h('datalist', { id: listID }, suggestions.map(topic => h('option', { key: topic.id, value: topic.label }, topic.id))),
        h('p', { id: messageID, className: 'cms-tag-help', role: 'status' }, this.state.message || 'Select a suggestion and press Enter or Add tag.')
      );
    }
  });
  CMS.registerWidget('publication-tags', TagsControl);
  // Keep new tags available across editors in this session, without a second save.
  CMS.registerEventListener({ name: 'postSave', handler: ({ entry }) => {
    const topics = values(entry.getIn(['data', 'topics']));
    topics.forEach(value => { if (typeof value === 'string' && clean(value)) remember({ id: clean(value), label: clean(value) }, true); });
    listeners.forEach(refresh => refresh());
  } });
  CMS.init();
})();
