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
  const seed = JSON.parse(document.getElementById('cms-preview-settings').textContent).data;
  const roster = new Map(seed.people.map(person => [person._slug, person]));
  const utf8 = new TextEncoder();
  const entrySlug = entry => entry?.get('slug') || '';
  const keyForMember = person => {
    const order = Number(person.order);
    const oldOrder = Number.isSafeInteger(order) && order >= 0 ? order : 0;
    const rank = /^[0-9a-f]+$/.test(person.member_order || '') ? person.member_order : oldOrder.toString(16).padStart(16, '0');
    const slug = utf8.encode(person._slug);
    // Use the same key as people/sort.html. The slug separates equal ranks.
    const suffix = Array.from(slug, byte => byte.toString(16).padStart(2, '0')).join('');
    return rank + suffix + slug.length.toString(16).padStart(4, '0') + '1';
  };
  const compareMembers = (a, b) => {
    const left = keyForMember(a), right = keyForMember(b);
    return left < right ? -1 : left > right ? 1 : 0;
  };
  const rankBetween = (before, after) => {
    const lower = before ? keyForMember(before) : '';
    let upper = after ? keyForMember(after) : null;
    let prefix = '';
    // A differing digit leaves a gap for this member's slug suffix.
    for (let i = 0; ; i++) {
      const left = parseInt(lower[i] || '0', 16);
      const right = upper === null ? 16 : parseInt(upper[i] || '0', 16);
      if (right - left > 1) return prefix + Math.floor((left + right) / 2).toString(16);
      if (right > left) upper = null;
      prefix += left.toString(16);
    }
  };
  const memberPosition = props => {
    const slug = entrySlug(props.entry);
    const member = { _slug: slug, order: props.entry?.getIn(['data', 'order']), member_order: props.value };
    const peers = [...roster.values()].filter(person => person.group === group(props) && person._slug !== slug).sort(compareMembers);
    const next = peers.findIndex(person => compareMembers(member, person) < 0);
    return { peers, index: next < 0 ? peers.length : next };
  };
  window.SDSCMSPeople = { records: () => [...roster.values()], compareMembers };
  CMS.registerEventListener({ name: 'postSave', handler: ({ entry }) => {
    const slug = entrySlug(entry);
    if (entry.get('collection') === 'people' && slug) {
      roster.set(slug, { ...plain(entry.get('data')), _slug: slug });
    }
  } });
  CMS.registerWidget('member-order', createClass({
    focus() {
      this.buttons?.querySelector('button[aria-disabled="false"]')?.focus({ preventScroll: true });
    },
    move(offset) {
      const { peers, index } = memberPosition(this.props);
      const target = index + offset;
      if (target >= 0 && target <= peers.length) {
        this.props.onChange(rankBetween(peers[target - 1], peers[target]));
      }
    },
    render() {
      const { peers, index } = memberPosition(this.props);
      const button = (offset, icon, label) => {
        const unavailable = offset < 0 ? index === 0 : index === peers.length;
        return h('button', {
          type: 'button', title: label, 'aria-label': label, 'aria-disabled': unavailable,
          tabIndex: unavailable ? -1 : 0, onClick: () => this.move(offset)
        }, icon);
      };
      return h('div', { className: 'cms-person-order', ref: element => { this.buttons = element; } },
        button(-1, '←', 'Move earlier'),
        h('span', { role: 'status' }, `Position ${index + 1} of ${peers.length + 1}`),
        button(1, '→', 'Move later'));
    }
  }));
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
