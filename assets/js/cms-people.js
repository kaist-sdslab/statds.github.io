(() => {
  const controlInstance = control => control?.getWrappedInstance?.() || control;
  // Decap passes an entry snapshot to controls; broadcast live Group changes.
  const listeners = new Set();
  let current = null;
  const entryKey = props => `${props.entry?.get('collection')}:${props.entry?.get('path') || props.entry?.get('slug') || 'new'}`;
  const group = props => current?.key === entryKey(props) ? current.group : props.entry?.getIn(['data', 'group']);
  const publishGroup = (props, value = props.value) => {
    const key = entryKey(props);
    if (current?.key === key && current.group === value) return;
    current = { key, group: value };
    listeners.forEach(refresh => refresh());
  };
  const select = CMS.getWidget('select');
  CMS.registerWidget({
    name: 'people-group', schema: select.schema, previewComponent: select.preview,
    controlComponent: createClass({
      shouldComponentUpdate() { return true; },
      componentDidMount() { publishGroup(this.props); },
      componentDidUpdate() { publishGroup(this.props); },
      componentWillUnmount() { if (current?.key === entryKey(this.props)) current = null; },
      focus(path) {
        const control = controlInstance(this.control);
        if (control?.focus) control.focus(path);
        else window.document.getElementById(this.props.forID)?.focus({ preventScroll: true });
      },
      render() {
        return h(select.control, { ...this.props, ref: control => { this.control = control; }, onChange: value => {
          publishGroup(this.props, value);
          this.props.onChange(value);
        } });
      }
    })
  });
  const visible = props => props.field.get('groups').includes(group(props));
  const plain = value => value?.toJS ? value.toJS() : value || {};
  const yearOnly = value => /^[1-9]\d{3}$/.test(value || '');
  const validDate = value => yearOnly(value) || /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const dateBound = (value, end = false) => yearOnly(value) ? `${value}-${end ? '12-31' : '01-01'}` : value;
  CMS.registerWidget('people-date', createClass({
    getInitialState() { return { precision: yearOnly(this.props.value) ? 'year' : 'date' }; },
    isValid() { return !this.props.value || validDate(this.props.value); },
    render() {
      const year = this.state.precision === 'year';
      return h('div', { className: 'cms-person-date' },
        h('select', { value: this.state.precision, 'aria-label': 'Date precision', onChange: event => {
          const precision = event.target.value;
          this.setState({ precision });
          this.props.onChange(precision === 'year' ? (this.props.value || '').slice(0, 4) : '');
        } }, h('option', { value: 'date' }, 'Exact date'), h('option', { value: 'year' }, 'Year only')),
        h('input', { type: year ? 'number' : 'date', id: this.props.forID, className: this.props.classNameWrapper,
          ...(year ? { min: 1000, max: 9999, placeholder: 'YYYY' } : {}),
          value: this.props.value || '', onChange: event => this.props.onChange(event.target.value) }));
    }
  }));
  const dateError = (name, value) => {
    if (name !== 'internship') return '';
    const dates = plain(value);
    if (dates.start_date && !validDate(dates.start_date)) return 'Enter a valid start date.';
    if (dates.end_date && !validDate(dates.end_date)) return 'Enter a valid end date.';
    return dates.start_date && dates.end_date && dateBound(dates.end_date, true) < dateBound(dates.start_date)
      ? 'End date must be on or after start date.' : '';
  };
  const ConditionalControl = createClass({
    // Decap otherwise skips updates when only a different field (Group) changes.
    shouldComponentUpdate() { return true; },
    componentDidMount() {
      this.refresh = () => this.forceUpdate();
      listeners.add(this.refresh);
      this.syncVisibility();
    },
    componentDidUpdate() { this.syncVisibility(); },
    componentWillUnmount() { listeners.delete(this.refresh); this.container?.removeAttribute('data-cms-group-hidden'); },
    syncVisibility() {
      this.container = this.host?.closest('[aria-label$=" field"]');
      if (this.container) this.container.toggleAttribute('data-cms-group-hidden', !visible(this.props));
    },
    focus(path) {
      if (!visible(this.props)) return;
      const control = controlInstance(this.control);
      if (control?.focus) control.focus(path);
      else window.document.getElementById(this.props.forID)?.focus({ preventScroll: true });
    },
    getValidateValue() { return controlInstance(this.control)?.getValidateValue?.() ?? this.props.value; },
    validate() {
      this.props.validate?.();
      if (visible(this.props)) controlInstance(this.control)?.validate?.();
    },
    isValid() {
      if (!visible(this.props)) return true;
      const error = dateError(this.props.field.get('name'), this.props.value);
      if (error) return { error };
      return controlInstance(this.control)?.isValid?.() ?? true;
    },
    render() {
      const show = visible(this.props);
      const original = CMS.getWidget(this.props.field.get('control_widget'));
      const error = show && dateError(this.props.field.get('name'), this.props.value);
      return h('div', { ref: element => { this.host = element; } },
        // Keep nested controls in their native object's own ref registry. If
        // forwarded, their refs would overwrite this conditional field's ref
        // in Decap's parent pane after switching groups.
        show && h(original.control, { ...this.props, controlRef: undefined, ref: control => { this.control = control; } }),
        error && h('p', { className: 'cms-person-error', role: 'alert' }, error));
    }
  });
  CMS.registerWidget({ name: 'people-conditional', controlComponent: ConditionalControl, allowMapValue: true });
  CMS.registerEventListener({ name: 'preSave', handler: ({ entry }) => {
    if (entry.get('collection') !== 'people' || entry.getIn(['data', 'group']) !== 'intern') return;
    const internship = plain(entry.getIn(['data', 'internship']));
    if (!internship.start_date) throw new Error('An intern needs a start date.');
    const error = dateError('internship', internship);
    if (error) throw new Error(error);
  } });
})();
