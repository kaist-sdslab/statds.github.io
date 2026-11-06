(() => {
  const seed = JSON.parse(document.getElementById('cms-preview-settings').textContent).data;
  const clean = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const key = value => clean(value).toLocaleLowerCase();
  const values = value => value?.toArray ? value.toArray() : Array.isArray(value) ? value : [];
  const suggestions = new Map();
  [...(seed.people || []).flatMap(person => person.research_interests || []), ...(seed.papers || []).flatMap(paper => paper.topics || [])]
    .forEach(topic => { if (clean(topic)) suggestions.set(key(topic), clean(topic)); });
  const style = topic => {
    let color = '#285c9b';
    (seed.colors?.assignments || []).forEach(rule => {
      if ((rule.topics || []).some(value => key(value) === key(topic)) && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(rule.color || '')) color = rule.color;
    });
    return { '--topic-color': color, '--topic-soft': `color-mix(in srgb, ${color} 9%, white)`, '--topic-line': `color-mix(in srgb, ${color} 25%, white)` };
  };
  CMS.registerWidget('student-interests', createClass({
    getInitialState() { return { query: '' }; },
    focus() { this.input?.focus({ preventScroll: true }); },
    add() {
      const label = clean(this.state.query);
      if (!label) return;
      const current = values(this.props.value);
      const canonical = suggestions.get(key(label)) || label;
      if (!current.some(value => key(value) === key(canonical))) {
        suggestions.set(key(canonical), canonical);
        this.props.onChange([...current, canonical]);
      }
      this.setState({ query: '' });
    },
    render() {
      const current = values(this.props.value), listID = `${this.props.forID}-suggestions`;
      const choices = [...suggestions.values()].filter(topic => !current.some(value => key(value) === key(topic))).sort((a, b) => a.localeCompare(b));
      return h('div', { className: `${this.props.classNameWrapper || ''} publication-tag-editor` },
        h('div', { className: 'cms-tag-selection' }, ...current.map((topic, index) => h('span', { key: index, className: 'cms-tag-chip', style: style(topic) }, topic,
          h('button', { type: 'button', 'aria-label': `Remove ${topic}`, onClick: () => this.props.onChange(current.filter((_, i) => i !== index)) }, '×')))),
        h('div', { className: 'cms-tag-input-row' },
          h('input', { id: this.props.forID, ref: input => { this.input = input; }, list: listID, value: this.state.query, placeholder: 'Add a research area…', autoComplete: 'off',
            onChange: event => this.setState({ query: event.target.value }), onKeyDown: event => {
              if (event.key === 'Enter' && !event.isComposing && !event.nativeEvent?.isComposing && event.keyCode !== 229) { event.preventDefault(); this.add(); }
            } }),
          h('button', { type: 'button', disabled: !clean(this.state.query), onClick: this.add }, 'Add tag')),
        h('datalist', { id: listID }, ...choices.map(topic => h('option', { key: topic, value: topic }))),
        h('p', { className: 'cms-tag-help' }, 'Choose a suggestion or enter a new research area. Press Enter to add it.'));
    }
  }));
})();
