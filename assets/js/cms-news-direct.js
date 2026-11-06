(() => {
  const api = window.SDSNewsEditor;
  const resolve = (props, path) => String(window.SDSCMSMedia.resolveAsset(props.getAsset, path, props.field));
  const previewHTML = (value, props) => {
    const doc = api.parseDocument(value);
    if (doc) return api.renderDocument(doc, path => resolve(props, path));
    const container = document.createElement('div'); container.innerHTML = api.legacyHTML(value);
    container.querySelectorAll('img').forEach(img => { img.src = resolve(props, img.getAttribute('src')); });
    return container.innerHTML;
  };
  const Control = createClass({
    getInitialState() { return { error: '', revision: 0 }; },
    componentDidMount() { this.mediaID = crypto.randomUUID(); this.mountEditor(this.props.value || ''); },
    componentDidUpdate(previous) {
      if (previous.entry?.get('path') !== this.props.entry?.get('path')) { this.destroyEditor(); this.mountEditor(this.props.value || ''); }
      else if (previous.value !== this.props.value && this.props.value !== this.lastSent) {
        this.destroyEditor(); this.mountEditor(this.props.value || '');
      }
      const path = this.props.mediaPaths?.get(this.mediaID);
      if (path && path !== previous.mediaPaths?.get(this.mediaID) && this.editor) {
        const position = Math.min(this.insertPosition ?? this.editor.state.selection.from, this.editor.state.doc.content.size);
        this.editor.chain().focus().setTextSelection(position).setImage({ src: Array.isArray(path) ? path[0] : path }).run();
        this.props.onClearMediaControl(this.mediaID);
      }
    },
    componentWillUnmount() { this.destroyEditor(); this.props.onRemoveMediaControl?.(this.mediaID); },
    destroyEditor() { this.editor?.destroy(); this.editor = null; this.activeEditor = null; },
    mountEditor(value) {
      try {
        this.editor = api.createEditor({ element: this.host, value, defaultAlignment: this.props.entry?.getIn(['data', 'body_alignment']) || 'left', resolveAsset: path => resolve(this.props, path),
          onUpdate: next => { this.lastSent = next; this.props.onChange(next); }, onSelection: editor => { this.activeEditor = editor; this.setState(state => ({ revision: state.revision + 1 })); } });
        this.activeEditor = this.editor; this.setState({ error: '' });
      } catch (error) { this.setState({ error: error.message }); }
    },
    focus() { this.editor?.commands.focus(); },
    getValidateValue() { return this.lastSent ?? this.props.value; },
    isValid() { return !this.state.error || { error: { message: this.state.error } }; },
    command(name, ...args) { this.editor?.chain().focus()[name](...args).run(); },
    imageAttribute(name, value) { this.editor?.commands.updateAttributes('image', { [name]: value }); },
    openImage() {
      if (!this.editor) return;
      this.insertPosition = this.editor.state.selection.from;
      this.props.onOpenMediaLibrary({ controlID: this.mediaID, forImage: true, allowMultiple: false, value: '', field: this.props.field, privateUpload: false });
    },
    render() {
      const editor = this.editor || this.activeEditor, selectedImage = !!editor?.isActive('image'), attrs = selectedImage ? editor.getAttributes('image') : {};
      const button = (label, action, active = false, title = label) => h('button', { key: title, type: 'button', title, 'aria-label': title, 'aria-pressed': active, disabled: !!this.props.isDisabled,
        onMouseDown: event => event.preventDefault(), onClick: action }, label);
      const alignment = value => selectedImage ? this.imageAttribute('alignment', value) : this.command('setTextAlign', value);
      return h('div', { className: 'sds-news-editor' },
        h('div', { className: 'sds-editor-toolbar', role: 'toolbar', 'aria-label': 'Article formatting' },
          button('B', () => this.command('toggleBold'), !!editor?.isActive('bold'), 'Bold'),
          button('I', () => this.command('toggleItalic'), !!editor?.isActive('italic'), 'Italic'),
          button('H2', () => this.command('toggleHeading', { level: 2 }), !!editor?.isActive('heading', { level: 2 }), 'Heading 2'),
          button('H3', () => this.command('toggleHeading', { level: 3 }), !!editor?.isActive('heading', { level: 3 }), 'Heading 3'),
          button('• List', () => this.command('toggleBulletList'), !!editor?.isActive('bulletList'), 'Bullet list'),
          button('1. List', () => this.command('toggleOrderedList'), !!editor?.isActive('orderedList'), 'Numbered list'),
          ...['left', 'center', 'right', 'justify'].filter(value => !selectedImage || value !== 'justify').map(value => button(value[0].toUpperCase() + value.slice(1), () => alignment(value), selectedImage ? attrs.alignment === value : !!editor?.isActive({ textAlign: value }), `Align ${value}`)),
          button('Link', () => {
            const url = window.prompt('Link URL', editor?.getAttributes('link').href || 'https://');
            if (url === null) return;
            if (!url) this.command('unsetLink');
            else if (api.safeLink(url)) this.command('setLink', { href: url });
          }),
          button('Image', () => this.openImage(), false, 'Insert image from Media Library'),
          button('Undo', () => this.command('undo')), button('Redo', () => this.command('redo'))),
        selectedImage && h('div', { className: 'sds-image-toolbar', role: 'group', 'aria-label': 'Selected image layout' },
          h('label', null, 'Width ', h('input', { type: 'range', min: 10, max: 100, value: attrs.widthPercent || 100, 'aria-label': 'Image width percent', onChange: event => this.imageAttribute('widthPercent', api.width(event.target.value)) })),
          h('label', null, h('input', { type: 'number', min: 10, max: 100, value: attrs.widthPercent || 100, 'aria-label': 'Image width', onChange: event => this.imageAttribute('widthPercent', api.width(event.target.value)) }), ' %'),
          h('label', null, 'Max px ', h('input', { type: 'number', min: 0, max: 2400, value: attrs.maxWidth || '', placeholder: 'Auto', 'aria-label': 'Image maximum width in pixels', onChange: event => this.imageAttribute('maxWidth', Math.max(0, Math.min(2400, Number(event.target.value) || 0))) })),
          h('label', null, h('input', { type: 'checkbox', checked: !!attrs.wrap, onChange: event => this.imageAttribute('wrap', event.target.checked) }), ' Wrap text'),
          h('label', null, 'Alt ', h('input', { type: 'text', value: attrs.alt || '', 'aria-label': 'Image description', onChange: event => this.imageAttribute('alt', event.target.value) })),
          h('label', null, 'Caption ', h('input', { type: 'text', value: attrs.caption || '', 'aria-label': 'Image caption', onChange: event => this.imageAttribute('caption', event.target.value) }))),
        h('div', { ref: element => { this.host = element; }, className: 'sds-editor-surface', hidden: !!this.state.error }),
        this.state.error && h('div', { className: 'sds-editor-error' }, h('p', { role: 'alert' }, this.state.error), h('textarea', { 'aria-label': 'Original article source', value: this.props.value || '', onChange: event => this.props.onChange(event.target.value) })));
    }
  });
  const Preview = createClass({ render() {
    try { return h('div', { className: 'sds-article-preview', dangerouslySetInnerHTML: { __html: previewHTML(this.props.value || '', this.props) } }); }
    catch { return h('p', null, 'The original article source is preserved.'); }
  } });
  CMS.registerWidget('news-body', Control, Preview);
})();
