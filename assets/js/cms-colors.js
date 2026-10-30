(() => {
  const original = CMS.getWidget('color');
  const hex = value => {
    if (/^#[0-9a-f]{6}$/i.test(value || '')) return value;
    if (/^#[0-9a-f]{3}$/i.test(value || '')) return '#' + [...value.slice(1)].map(char => char + char).join('');
    return '#285c9b';
  };
  CMS.registerWidget({
    name: 'color', schema: original.schema, previewComponent: original.preview,
    controlComponent: createClass({
      render() {
        return h('div', { className: 'cms-color-control' },
          h('input', {
            type: 'color', value: hex(this.props.value), 'aria-label': 'Choose color',
            onChange: event => this.props.onChange(event.target.value)
          }),
          h('input', {
            type: 'text', id: this.props.forID, className: this.props.classNameWrapper,
            value: this.props.value || '', placeholder: '#285c9b', spellCheck: false,
            onChange: event => this.props.onChange(event.target.value)
          })
        );
      }
    })
  });
})();
