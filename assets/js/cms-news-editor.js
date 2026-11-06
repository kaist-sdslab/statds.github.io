(() => {
  const alignment = value => ['left', 'center', 'right', 'justify'].includes(value) ? value : 'left';
  const imageAlignment = value => ['left', 'center', 'right'].includes(value) ? value : 'center';
  const percent = value => Math.round(Math.max(10, Math.min(100, value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : 100)));
  const maxWidth = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Math.max(40, Math.min(2400, Number(value)))) : 0;
  const quote = value => JSON.stringify(String(value || ''));
  // Encode free text so Hugo's shortcode lexer preserves quotes and backslashes.
  const encode = value => btoa(Array.from(new TextEncoder().encode(String(value || '')), byte => String.fromCharCode(byte)).join(''));
  const decode = value => {
    try { return new TextDecoder().decode(Uint8Array.from(atob(value || ''), char => char.charCodeAt(0))); } catch { return ''; }
  };
  const attributes = source => {
    const result = {};
    const pattern = /(\w+)=("(?:\\.|[^"\\])*"|[^\s]+)/g;
    for (const match of source.matchAll(pattern)) {
      try { result[match[1]] = match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]; } catch { /* Ignore malformed optional attributes. */ }
    }
    return result;
  };
  const choices = [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
    { label: 'Justified', value: 'justify' }
  ];
  CMS.registerEditorComponent({
    id: 'news-image',
    label: 'Image with layout',
    icon: 'image',
    collapsed: false,
    fields: [
      { name: 'image', label: 'Image', widget: 'image', media_library: { allow_multiple: false } },
      { name: 'alt', label: 'Image description (accessibility)', widget: 'string', required: false },
      { name: 'width', label: 'Width (% of article)', widget: 'number', value_type: 'int', min: 10, max: 100, step: 1, default: 100 },
      { name: 'max_width', label: 'Maximum width (pixels)', widget: 'number', value_type: 'int', min: 40, max: 2400, required: false, hint: 'Optional cap; the image always fits the screen. Leave empty for no cap.' },
      { name: 'align', label: 'Image position', widget: 'select', options: choices.slice(0, 3), default: 'center' },
      { name: 'wrap', label: 'Wrap text beside the image', widget: 'boolean', required: false, default: false, hint: 'For left/right images on larger screens. On mobile the text moves below the image.' },
      { name: 'caption', label: 'Caption', widget: 'string', required: false }
    ],
    pattern: /^\{\{< news-image ([^\n]*?) >\}\}$/m,
    fromBlock(match) {
      const data = attributes(match[1]);
      return { image: data.src || '', alt: decode(data.alt64), width: percent(data.width), max_width: maxWidth(data.maxwidth) || undefined, align: imageAlignment(data.align), wrap: data.wrap === 'true', caption: decode(data.caption64) };
    },
    toBlock(data) {
      return `{{< news-image src=${quote(data.image)} alt64="${encode(data.alt)}" width="${percent(data.width)}" maxwidth="${maxWidth(data.max_width)}" align="${imageAlignment(data.align)}" wrap="${!!data.wrap}" caption64="${encode(data.caption)}" >}}`;
    },
    toPreview(data, getAsset, fields) {
      const align = imageAlignment(data.align), wrap = !!data.wrap && align !== 'center';
      const imageField = fields?.find(field => field.get('name') === 'image');
      const src = data.image ? String(window.SDSCMSMedia.resolveAsset(getAsset, data.image, imageField)) : '';
      const style = { width: `${percent(data.width)}%`, maxWidth: maxWidth(data.max_width) ? `${maxWidth(data.max_width)}px` : '100%', marginTop: 0, marginBottom: 22,
        marginLeft: align === 'left' ? 0 : 'auto', marginRight: align === 'right' ? 0 : 'auto', ...(wrap ? { float: align, ...(align === 'left' ? { marginRight: 24 } : { marginLeft: 24 }) } : {}) };
      return h('figure', { className: `news-figure news-figure-${align}${wrap ? ' news-figure-wrap' : ''}`, style },
        src ? h('img', { src, alt: data.alt || '', style: { display: 'block', width: '100%', height: 'auto' } }) : h('p', null, 'Choose an image.'),
        data.caption && h('figcaption', { style: { fontSize: 13, textAlign: 'center', marginTop: 8 } }, data.caption));
    }
  });
  CMS.registerEditorComponent({
    id: 'news-align',
    label: 'Aligned text',
    icon: 'write',
    collapsed: false,
    fields: [
      { name: 'align', label: 'Text alignment', widget: 'select', options: choices, default: 'left' },
      { name: 'body', label: 'Text', widget: 'markdown', editor_components: ['image', 'code-block'], hint: 'Formatting applies only to this block. Other article text keeps the article alignment.' }
    ],
    pattern: /^\{\{< news-align align="(left|center|right|justify)" >\}\}\n([\s\S]*?)\n\{\{< \/news-align >\}\}$/m,
    fromBlock: match => ({ align: alignment(match[1]), body: match[2].trim() }),
    toBlock: data => `{{< news-align align="${alignment(data.align)}" >}}\n\n${String(data.body || '').trim()}\n\n{{< /news-align >}}`,
    toPreview(data, getAsset) {
      return h('div', { className: `news-aligned news-text-${alignment(data.align)}`, style: { textAlign: alignment(data.align), display: 'flow-root' } },
        h(CMS.getWidget('markdown').preview, { value: data.body || '', getAsset, resolveWidget: CMS.getWidget, getRemarkPlugins: CMS.getRemarkPlugins }));
    }
  });
})();
