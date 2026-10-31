(() => {
  const photos = new Map();
  const listeners = new Set();
  const entryKey = props => `${props.entry?.get('collection')}:${props.entry?.get('path') || props.entry?.get('slug') || 'new'}`;
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const frame = value => {
    const data = value?.toJS ? value.toJS() : value || {};
    return { x: clamp(data.position_x ?? data.x ?? 50, 0, 100, 50), y: clamp(data.position_y ?? data.y ?? 50, 0, 100, 50), zoom: clamp(data.zoom ?? 1, 1, 3, 1) };
  };
  window.SDSCMSPortrait = {
    update(props) {
      if (props.field.get('name') !== 'photo') return;
      const key = entryKey(props);
      if (photos.has(key) && photos.get(key) === props.value) return;
      photos.set(key, props.value || '');
      listeners.forEach(refresh => refresh());
    },
    style(value) {
      const data = frame(value);
      return { objectPosition: `${data.x}% ${data.y}%`, transform: `scale(${data.zoom})`, transformOrigin: `${data.x}% ${data.y}%` };
    }
  };
  const Control = createClass({
    getInitialState() { return { ratio: null }; },
    componentDidMount() { this.refresh = () => this.forceUpdate(); listeners.add(this.refresh); },
    componentWillUnmount() { listeners.delete(this.refresh); this.drag = null; },
    focus() { this.host?.focus({ preventScroll: true }); },
    isValid() {
      const value = this.props.value?.toJS ? this.props.value.toJS() : this.props.value || {};
      return ['position_x', 'position_y', 'zoom'].every(name => value[name] == null || Number.isFinite(Number(value[name]))) || { error: 'Enter valid photo frame values.' };
    },
    change(patch) { const next = { ...frame(this.props.value), ...patch }; this.props.onChange({ position_x: next.x, position_y: next.y, zoom: next.zoom }); },
    render() {
      const data = frame(this.props.value);
      const key = entryKey(this.props);
      const path = photos.has(key) ? photos.get(key) : this.props.entry?.getIn(['data', 'photo']);
      const source = path ? String(window.SDSCMSMedia.resolveAsset(this.props.getAsset, path)) : '';
      const ratio = this.props.field.get('aspect_ratio') === 'original' ? this.state.ratio || '1.215' : '4 / 5';
      const slider = (name, label, min, max, step, suffix) => h('label', { className: 'cms-portrait-slider' },
        h('span', null, label), h('input', { type: 'range', min, max, step, value: data[name], disabled: !source,
          'aria-label': label, onChange: event => this.change({ [name]: Number(event.target.value) }) }),
        h('output', null, `${Math.round(data[name] * (name === 'zoom' ? 100 : 1))}${suffix}`));
      return h('div', { id: this.props.forID, tabIndex: -1, ref: element => { this.host = element; }, className: 'cms-portrait-control' },
        h('div', { className: 'cms-portrait-frame', style: { aspectRatio: ratio },
          onPointerDown: event => {
            if (!source || event.button !== 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const image = event.currentTarget.querySelector('img');
            const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight) * data.zoom;
            this.drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, ...data,
              overflowX: Math.max(0, image.naturalWidth * scale - rect.width), overflowY: Math.max(0, image.naturalHeight * scale - rect.height) };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          },
          onPointerMove: event => {
            if (!this.drag || this.drag.id !== event.pointerId) return;
            const drag = this.drag;
            this.change({ x: drag.overflowX > 0.5 ? clamp(drag.x - (event.clientX - drag.startX) / drag.overflowX * 100, 0, 100, 50) : drag.x,
              y: drag.overflowY > 0.5 ? clamp(drag.y - (event.clientY - drag.startY) / drag.overflowY * 100, 0, 100, 50) : drag.y });
          },
          onPointerUp: () => { this.drag = null; }, onPointerCancel: () => { this.drag = null; }, onLostPointerCapture: () => { this.drag = null; }
        }, source ? h('img', { src: source, alt: 'Drag to position the portrait', draggable: false, style: window.SDSCMSPortrait.style(data),
          onLoad: event => this.setState({ ratio: event.target.naturalWidth / event.target.naturalHeight }) }) : h('span', null, 'Select a photo above.')),
        h('p', { className: 'cms-tag-help' }, 'Drag the photo to position it. The original image is preserved.'),
        slider('x', 'Horizontal position', 0, 100, 1, '%'), slider('y', 'Vertical position', 0, 100, 1, '%'), slider('zoom', 'Zoom', 1, 3, 0.05, '%'),
        h('button', { type: 'button', className: 'cms-portrait-reset', onClick: () => this.props.onChange({ position_x: 50, position_y: 50, zoom: 1 }) }, 'Reset frame'));
    }
  });
  CMS.registerWidget({ name: 'portrait-frame', controlComponent: Control, allowMapValue: true });
})();
