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
    getInitialState() { return { error: '', revision: 0, link: null }; },
    // Decap's wrapper otherwise ignores updates that only contain media results.
    shouldComponentUpdate(next, nextState) { return (nextState && nextState !== this.state) || this.props.value !== next.value || this.props.mediaPaths !== next.mediaPaths || this.props.getAsset !== next.getAsset || this.props.entry !== next.entry || this.props.hasActiveStyle !== next.hasActiveStyle; },
    componentDidMount() { this.mediaID = crypto.randomUUID(); this.mountEditor(this.props.value || ''); },
    componentDidUpdate(previous) {
      if (previous.entry?.get('path') !== this.props.entry?.get('path')) { this.destroyEditor(); this.mountEditor(this.props.value || ''); }
      else if (previous.value !== this.props.value && this.props.value !== this.lastSent) {
        this.destroyEditor(); this.mountEditor(this.props.value || '');
      }
      const path = this.props.mediaPaths?.get(this.mediaID);
      if (path && path !== previous.mediaPaths?.get(this.mediaID) && this.editor) {
        const position = Math.min(this.insertPosition ?? this.editor.state.selection.from, this.editor.state.doc.content.size);
        const src = Array.isArray(path) ? path[0] : path;
        this.editor.chain().focus().setTextSelection(position).setImage({ src, widthPercent: 45, alignment: 'left', wrap: true }).run();
        this.editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image' && node.attrs.src === src) this.insertedImage = pos; });
        if (this.insertedImage != null) this.editor.commands.setNodeSelection(this.insertedImage);
        this.props.onClearMediaControl(this.mediaID);
      }
      if (this.editor) api.refreshImages(this.editor, path => resolve(this.props, path));
    },
    componentWillUnmount() { this.destroyEditor(); this.props.onRemoveMediaControl?.(this.mediaID); },
    destroyEditor() { this.editor?.destroy(); this.editor = null; this.activeEditor = null; },
    mountEditor(value) {
      try {
        this.editor = api.createEditor({ element: this.host, value, defaultAlignment: this.props.entry?.getIn(['data', 'body_alignment']) || 'left', coverImage: this.props.entry?.getIn(['data', 'image']) || '', coverAlt: this.props.entry?.getIn(['data', 'image_alt']) || '', resolveAsset: path => resolve(this.props, path),
          onUpdate: next => { this.lastSent = next; this.props.onChange(next); }, onSelection: editor => { this.activeEditor = editor; this.setState(state => ({ revision: state.revision + 1 })); } });
        this.activeEditor = this.editor; this.setState({ error: '' });
      } catch (error) { this.setState({ error: error.message }); }
    },
    focus() { this.editor?.commands.focus(); },
    getValidateValue() { return this.lastSent ?? this.props.value; },
    isValid() { return !this.state.error || { error: { message: this.state.error } }; },
    command(name, ...args) { this.editor?.chain().focus()[name](...args).run(); },
    imageAttribute(name, value) { this.editor?.commands.updateAttributes('image', { [name]: value }); },
    typography(name, value) { this.command('setMark', 'textStyle', { [name]: value }); },
    imageLayout(alignment, wrap) { this.editor?.chain().focus().updateAttributes('image', { alignment, wrap, ...(wrap && this.editor.getAttributes('image').widthPercent > 80 ? { widthPercent: 45 } : {}) }).run(); },
    belowImage() {
      const editor = this.editor; if (!editor) return;
      const position = editor.state.selection.to;
      editor.chain().focus().insertContentAt(position, { type: 'paragraph', attrs: { clear: 'both' } }).setTextSelection(position + 1).run();
    },
    openLink() {
      const editor = this.editor; if (!editor) return;
      if (editor.isActive('link')) editor.commands.extendMarkRange('link');
      const { from, to } = editor.state.selection;
      this.linkRange = { from, to };
      this.setState({ link: { url: editor.getAttributes('link').href || '', text: editor.state.doc.textBetween(from, to, ' ') } });
    },
    saveLink() {
      const value = this.state.link; if (!value) return;
      let url = value.url.trim();
      if (url && !/^(?:[a-z]+:|\/|#)/i.test(url)) url = `https://${url}`;
      if (url && !api.safeLink(url)) return;
      const chain = this.editor.chain().focus().setTextSelection(this.linkRange);
      if (!url) chain.extendMarkRange('link').unsetLink().run();
      else if (this.linkRange.from !== this.linkRange.to && value.text === this.editor.state.doc.textBetween(this.linkRange.from, this.linkRange.to, ' ')) chain.setLink({ href: url }).run();
      else chain.insertContent({ type: 'text', text: value.text || url, marks: [{ type: 'link', attrs: { href: url } }] }).command(({ tr }) => { tr.removeStoredMark(this.editor.schema.marks.link); return true; }).run();
      this.setState({ link: null });
    },
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
          h('select', { 'aria-label': 'Paragraph or heading', value: editor?.isActive('heading') ? editor.getAttributes('heading').level : 'paragraph', onChange: event => event.target.value === 'paragraph' ? this.command('setParagraph') : this.command('setHeading', { level: Number(event.target.value) }) },
            h('option', { value: 'paragraph' }, 'Paragraph'), ...[1, 2, 3, 4, 5, 6].map(level => h('option', { key: level, value: level }, `Heading ${level}`))),
          h('select', { 'aria-label': 'Font family', value: editor?.getAttributes('textStyle').fontFamily || '', onChange: event => this.typography('fontFamily', event.target.value || null) }, h('option', { value: '' }, 'Default font'), ...Object.keys(api.fonts).map(key => h('option', { key, value: key }, { sans: 'Sans serif', serif: 'Serif', mono: 'Monospace' }[key]))),
          h('label', null, 'Size ', h('input', { type: 'number', min: 10, max: 72, key: `font-${editor?.getAttributes('textStyle').fontSize || 'auto'}`, defaultValue: editor?.getAttributes('textStyle').fontSize || '', placeholder: 'Auto', 'aria-label': 'Font size in pixels', onBlur: event => this.typography('fontSize', event.target.value ? api.fontSize(event.target.value) : null) })),
          h('input', { type: 'color', 'aria-label': 'Text color', value: editor?.getAttributes('textStyle').color || '#263442', onChange: event => this.typography('color', event.target.value) }),
          h('select', { 'aria-label': 'Line spacing', value: editor?.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph').lineHeight || '', onChange: event => this.command('updateAttributes', editor.isActive('heading') ? 'heading' : 'paragraph', { lineHeight: event.target.value || null }) }, h('option', { value: '' }, 'Line spacing'), ...['1.2', '1.5', '1.8', '2'].map(value => h('option', { key: value, value }, value))),
          button('• List', () => this.command('toggleBulletList'), !!editor?.isActive('bulletList'), 'Bullet list'),
          button('1. List', () => this.command('toggleOrderedList'), !!editor?.isActive('orderedList'), 'Numbered list'),
          ...['left', 'center', 'right', 'justify'].filter(value => !selectedImage || value !== 'justify').map(value => button(value[0].toUpperCase() + value.slice(1), () => alignment(value), selectedImage ? attrs.alignment === value : !!editor?.isActive({ textAlign: value }), `Align ${value}`)),
          button('Link', () => this.openLink(), !!editor?.isActive('link')),
          button('Image', () => this.openImage(), false, 'Insert image from Media Library'),
          button('Undo', () => this.command('undo')), button('Redo', () => this.command('redo'))),
        this.state.link && h('div', { className: 'sds-link-toolbar', role: 'group', 'aria-label': 'Insert or edit link' },
          h('input', { type: 'url', placeholder: 'https://…', 'aria-label': 'Link URL', value: this.state.link.url, onChange: event => this.setState({ link: { ...this.state.link, url: event.target.value } }), onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); this.saveLink(); } } }),
          h('input', { type: 'text', placeholder: 'Display text (optional)', 'aria-label': 'Link text', value: this.state.link.text, onChange: event => this.setState({ link: { ...this.state.link, text: event.target.value } }) }),
          button('Apply link', () => this.saveLink()), button('Cancel', () => this.setState({ link: null }))),
        selectedImage && h('div', { className: 'sds-image-toolbar', role: 'group', 'aria-label': 'Selected image layout' },
          h('label', null, h('input', { type: 'checkbox', checked: !!attrs.cover, 'aria-label': 'Use as cover image', onChange: event => api.selectCover(this.editor, event.target.checked) }), ' Cover'),
          h('label', null, 'Width ', h('input', { type: 'range', min: 10, max: 100, value: attrs.widthPercent || 100, 'aria-label': 'Image width percent', onChange: event => this.imageAttribute('widthPercent', api.width(event.target.value)) })),
          h('label', null, h('input', { type: 'number', min: 10, max: 100, key: `width-${attrs.widthPercent}`, defaultValue: attrs.widthPercent || 100, 'aria-label': 'Image width', onBlur: event => this.imageAttribute('widthPercent', api.width(event.target.value)) }), ' %'),
          h('label', null, 'Max px ', h('input', { type: 'number', min: 0, max: 2400, key: `max-${attrs.maxWidth}`, defaultValue: attrs.maxWidth || '', placeholder: 'Auto', 'aria-label': 'Image maximum width in pixels', onBlur: event => this.imageAttribute('maxWidth', Math.max(0, Math.min(2400, Number(event.target.value) || 0))) })),
          h('label', null, h('input', { type: 'checkbox', checked: !!attrs.wrap, onChange: event => this.imageAttribute('wrap', event.target.checked) }), ' Wrap text'),
          button('Text right', () => this.imageLayout('left', true), attrs.wrap && attrs.alignment === 'left'),
          button('Text left', () => this.imageLayout('right', true), attrs.wrap && attrs.alignment === 'right'),
          button('Separate block', () => this.imageLayout('center', false), !attrs.wrap),
          button('Write below image', () => this.belowImage()),
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
