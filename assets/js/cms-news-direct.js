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
    getInitialState() { return { error: '', revision: 0, link: null, fontDraft: null }; },
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
        this.editor.chain().focus().setTextSelection(position).setImage({ src, widthPercent: 100, alignment: 'center', wrap: false }).run();
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
    beginFontSize(event) {
      this.fontSelection = { from: this.editor.state.selection.from, to: this.editor.state.selection.to };
      this.setState({ fontDraft: event.target.value });
    },
    updateFontSize(event) {
      const value = event.target.value; this.setState({ fontDraft: value });
      if (value === '' || (+value >= 10 && +value <= 72)) api.applyFontSize(this.editor, value === '' ? null : +value, this.fontSelection || this.editor.state.selection);
    },
    finishFontSize(event) {
      const value = event.target.value;
      api.applyFontSize(this.editor, value === '' ? null : api.fontSize(value), this.fontSelection || this.editor.state.selection);
      this.fontSelection = null; this.setState({ fontDraft: null });
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
      const editor = this.editor || this.activeEditor, selectedImage = !!editor?.isActive('image'), selectedLayout = editor?.state.selection.node?.type.name === 'imageRow';
      const attrs = selectedImage ? editor.getAttributes('image') : {}, mediaSelected = selectedImage || selectedLayout;
      const layout = selectedLayout ? editor.state.selection.node : selectedImage && editor.state.selection.$from.parent.type.name === 'imageRow' ? editor.state.selection.$from.parent : null;
      const row = layout?.attrs.direction !== 'column' && layout;
      const layoutPos = layout ? selectedLayout ? editor.state.selection.from : editor.state.selection.$from.before() : null;
      const minWidth = row ? 1 : 10, maxWidth = row ? Math.max(1, 101 - row.childCount) : 100;
      const button = (label, action, active = false, title = label) => h('button', { key: title, type: 'button', title, 'aria-label': title, 'aria-pressed': active, disabled: !!this.props.isDisabled || mediaSelected && ['Bold', 'Italic', 'Link', 'Bullet list', 'Numbered list'].includes(title),
        onMouseDown: event => event.preventDefault(), onClick: action }, label);
      const alignment = value => this.command('setTextAlign', value);
      return h('div', { className: 'sds-news-editor' },
        h('div', { className: 'sds-editor-toolbar', role: 'toolbar', 'aria-label': 'Article formatting' },
          button('B', () => this.command('toggleBold'), !!editor?.isActive('bold'), 'Bold'),
          button('I', () => this.command('toggleItalic'), !!editor?.isActive('italic'), 'Italic'),
          h('select', { 'aria-label': 'Paragraph or heading', disabled: mediaSelected, value: editor?.isActive('heading') ? editor.getAttributes('heading').level : 'paragraph', onChange: event => event.target.value === 'paragraph' ? this.command('setParagraph') : this.command('setHeading', { level: Number(event.target.value) }) },
            h('option', { value: 'paragraph' }, 'Paragraph'), ...[1, 2, 3, 4, 5, 6].map(level => h('option', { key: level, value: level }, `Heading ${level}`))),
          h('label', null, 'Size ', h('input', { type: 'number', min: 10, max: 72, disabled: mediaSelected, value: this.state.fontDraft ?? editor?.getAttributes('textStyle').fontSize ?? '', placeholder: 'Auto', 'aria-label': 'Font size in pixels', onFocus: event => this.beginFontSize(event), onChange: event => this.updateFontSize(event), onBlur: event => this.finishFontSize(event) })),
          h('input', { type: 'color', 'aria-label': 'Text color', disabled: mediaSelected, value: editor?.getAttributes('textStyle').color || '#263442', onChange: event => this.typography('color', event.target.value) }),
          h('select', { 'aria-label': 'Line spacing', disabled: mediaSelected, value: editor?.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph').lineHeight || '', onChange: event => this.command('updateAttributes', editor.isActive('heading') ? 'heading' : 'paragraph', { lineHeight: event.target.value || null }) }, h('option', { value: '' }, 'Line spacing'), ...['1.2', '1.5', '1.8', '2'].map(value => h('option', { key: value, value }, value))),
          button('• List', () => this.command('toggleBulletList'), !!editor?.isActive('bulletList'), 'Bullet list'),
          button('1. List', () => this.command('toggleOrderedList'), !!editor?.isActive('orderedList'), 'Numbered list'),
          ...(!mediaSelected ? ['left', 'center', 'right', 'justify'] : []).map(value => button(value[0].toUpperCase() + value.slice(1), () => alignment(value), !!editor?.isActive({ textAlign: value }), `Align ${value}`)),
          button('Link', () => this.openLink(), !!editor?.isActive('link')),
          button('Image', () => this.openImage(), false, 'Insert image from Media Library'),
          button('Undo', () => this.command('undo')), button('Redo', () => this.command('redo'))),
        this.state.link && h('div', { className: 'sds-link-toolbar', role: 'group', 'aria-label': 'Insert or edit link' },
          h('input', { type: 'url', placeholder: 'https://…', 'aria-label': 'Link URL', value: this.state.link.url, onChange: event => this.setState({ link: { ...this.state.link, url: event.target.value } }), onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); this.saveLink(); } } }),
          h('input', { type: 'text', placeholder: 'Display text (optional)', 'aria-label': 'Link text', value: this.state.link.text, onChange: event => this.setState({ link: { ...this.state.link, text: event.target.value } }) }),
          button('Apply link', () => this.saveLink()), button('Cancel', () => this.setState({ link: null }))),
        mediaSelected && h('div', { className: 'sds-image-toolbar', role: 'group', 'aria-label': 'Selected image layout' },
          selectedImage && h('label', null, h('input', { type: 'checkbox', checked: !!attrs.cover, 'aria-label': 'Use as cover image', onChange: event => api.selectCover(this.editor, event.target.checked) }), ' Cover'),
          selectedImage && h('label', null, row ? 'Image share ' : 'Image width ', h('input', { type: 'range', min: minWidth, max: maxWidth, step: row ? .1 : 1, value: attrs.widthPercent || 100, 'aria-label': 'Image width percent', onChange: event => api.setImageWidth(this.editor, event.target.value) })),
          selectedImage && h('label', null, h('input', { type: 'number', min: minWidth, max: maxWidth, step: row ? .1 : 1, key: `width-${attrs.widthPercent}`, defaultValue: Number(Number(attrs.widthPercent || 100).toFixed(1)), 'aria-label': 'Image width', onBlur: event => api.setImageWidth(this.editor, event.target.value) }), ' %'),
          selectedImage && !layout && h('label', null, 'Max px ', h('input', { type: 'number', min: 0, max: 2400, key: `max-${attrs.maxWidth}`, defaultValue: attrs.maxWidth || '', placeholder: 'Auto', 'aria-label': 'Image maximum width in pixels', onBlur: event => this.imageAttribute('maxWidth', Math.max(0, Math.min(2400, Number(event.target.value) || 0))) })),
          layout && h('label', null, `${layout.attrs.direction === 'column' ? 'Column' : 'Row'} width `, h('input', { type: 'range', min: 10, max: 100, value: layout.attrs.widthPercent || 100, 'aria-label': 'Image layout width percent', onChange: event => api.setLayoutWidth(this.editor, layoutPos, event.target.value) })),
          layout && h('label', null, h('input', { type: 'number', min: 10, max: 100, key: `layout-${layoutPos}-${layout.attrs.widthPercent}`, defaultValue: layout.attrs.widthPercent || 100, 'aria-label': 'Image layout width', onBlur: event => api.setLayoutWidth(this.editor, layoutPos, event.target.value) }), ' %'),
          h('span', { className: 'sds-image-help' }, 'Drop beside a photo for a row, above/below it for a column. Drag the Images handle beside text to place all pictures with the article.')),
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
