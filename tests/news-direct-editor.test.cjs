const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
function environment() {
  const dom = new JSDOM('<div id="editor"></div><div id="other"></div>', { url: 'https://example.com/admin/', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.TextEncoder = TextEncoder; dom.window.TextDecoder = TextDecoder;
  dom.window.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  dom.window.Range.prototype.getClientRects = () => [];
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../assets/vendor/news-editor.js'), 'utf8'));
  return { dom, window: dom.window, api: dom.window.SDSNewsEditor };
}
test('text alignment updates the editable document itself and survives saving', () => {
  const { dom, window, api } = environment(); let saved;
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value: 'Original **bold** text.', resolveAsset: x => x, onUpdate: value => { saved = value; }, onSelection: () => {} });
  editor.commands.setTextSelection(1); editor.commands.setTextAlign('right');
  assert.equal(window.document.querySelector('.sds-news-input p').style.textAlign, 'right');
  assert.equal(api.parseDocument(saved).content[0].attrs.textAlign, 'right');
  assert(window.document.querySelector('strong'));
  assert.equal(window.document.querySelectorAll('[contenteditable="true"]').length, 1);
  assert.equal(window.document.querySelectorAll('textarea').length, 0);
  editor.destroy(); dom.window.close();
});
test('image selection exposes a resize handle and width/position update the input DOM', () => {
  const { dom, window, api } = environment(); let saved;
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value: 'Photo:', resolveAsset: () => 'https://example.com/photo.jpg', onUpdate: value => { saved = value; }, onSelection: () => {} });
  editor.commands.setTextSelection(1); editor.commands.setImage({ src: '/media/photo.jpg' });
  let position; editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') position = pos; });
  editor.commands.setNodeSelection(position); editor.commands.updateAttributes('image', { widthPercent: 45, alignment: 'right', caption: '설명' });
  const figure = window.document.querySelector('.sds-inline-image');
  assert.equal(figure.style.width, '45%'); assert.equal(figure.style.marginLeft, 'auto');
  assert.equal(figure.querySelector('img').getAttribute('src'), 'https://example.com/photo.jpg');
  assert.equal(figure.querySelector('figcaption').textContent, '설명');
  figure.querySelector('.sds-image-resize').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(api.parseDocument(saved).content.find(n => n.type === 'image').attrs.widthPercent, 50);
  const second = api.createEditor({ element: window.document.getElementById('other'), value: saved, resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  assert.equal(window.document.querySelector('#other .sds-inline-image').style.width, '50%');
  second.destroy(); editor.destroy(); dom.window.close();
});
test('previous layout blocks become directly editable text/images and unsafe text is escaped', () => {
  const { dom, window, api } = environment();
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode('Old caption')));
  const value = `{{< news-align align="center" >}}\n\nParagraph **bold**.\n\n{{< /news-align >}}\n\n{{< news-image src="/photo.jpg" width="50" align="left" wrap="true" caption64="${encoded}" >}}`;
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value, resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  assert.equal(window.document.querySelector('p').style.textAlign, 'center');
  assert.equal(window.document.querySelector('.sds-inline-image').style.width, '50%');
  assert.equal(window.document.querySelector('figcaption').textContent, 'Old caption');
  const malicious = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] };
  const html = api.renderDocument(malicious); assert(!html.includes('<script>')); assert(!html.includes('javascript:'));
  assert.equal(JSON.stringify(api.parseDocument(api.serialize(malicious))), JSON.stringify(malicious));
  assert.throws(() => api.legacyHTML('{{< unknown >}}'), /unsupported shortcode/);
  editor.destroy(); dom.window.close();
});
test('CMS body widget inserts Media Library selections and retains the cursor on controlled updates', () => {
  const { dom, window } = environment(); let definition, opened, cleared, saved;
  window.CMS = { registerWidget: (_, control) => { definition = control; } };
  window.createClass = x => x; window.h = (type, props, ...children) => ({ type, props, children });
  window.SDSCMSMedia = { resolveAsset: (_, src) => src };
  window.eval(fs.readFileSync(path.join(__dirname, '../assets/js/cms-news-direct.js'), 'utf8'));
  const props = { value: 'Existing text.', entry: { get: () => 'test.md', getIn: keys => keys[1] === 'body_alignment' ? 'left' : '' }, field: {}, getAsset: x => x, mediaPaths: new Map(),
    onChange: value => { saved = value; }, onOpenMediaLibrary: options => { opened = options; }, onClearMediaControl: id => { cleared = id; }, onRemoveMediaControl: () => {} };
  const instance = { props, host: window.document.getElementById('editor'), state: definition.getInitialState(), setState(patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); } };
  for (const [name, value] of Object.entries(definition)) if (typeof value === 'function') instance[name] = value.bind(instance);
  instance.componentDidMount(); instance.editor.commands.setTextSelection(2); instance.openImage();
  assert.equal(opened.forImage, true); assert.equal(opened.allowMultiple, false);
  const before = instance.props; instance.props = { ...props, mediaPaths: new Map([[opened.controlID, '/media/new.jpg']]) }; instance.componentDidUpdate(before);
  assert.equal(cleared, opened.controlID); assert(saved.includes('news-content'));
  const editorBefore = instance.editor, previous = instance.props;
  instance.props = { ...instance.props, value: saved }; instance.componentDidUpdate(previous);
  assert.equal(instance.editor, editorBefore);
  assert.equal(window.document.querySelector('.sds-inline-image img').getAttribute('src'), '/media/new.jpg');
  instance.componentWillUnmount(); dom.window.close();
});

test('only one body image is the cover; deletion clears the cover and legacy covers import once', () => {
  const { dom, window, api } = environment(); let saved;
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value: 'Existing article.', coverImage: '/legacy.jpg', coverAlt: 'Legacy', resolveAsset: x => x, onUpdate: value => { saved = value; }, onSelection: () => {} });
  const photos = () => { const result = []; editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') result.push({ node, pos }); }); return result; };
  assert.equal(photos().length, 1); assert.equal(api.getCover(editor.getJSON()).image, '/legacy.jpg');
  editor.commands.focus('end'); editor.commands.setImage({ src: '/second.jpg', widthPercent: 40, alignment: 'left', wrap: true });
  editor.commands.setNodeSelection(photos()[1].pos); api.selectCover(editor, true);
  assert.equal(photos().filter(p => p.node.attrs.cover).length, 1);
  assert.equal(api.getCover(api.parseDocument(saved)).image, '/second.jpg');
  editor.commands.deleteSelection(); assert.equal(api.getCover(editor.getJSON()).image, '');
  editor.destroy(); dom.window.close();
});

test('font settings, all heading levels and image text wrapping survive editing and reopening', () => {
  const { dom, window, api } = environment(); let saved;
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value: 'Formatted text', resolveAsset: x => x, onUpdate: value => { saved = value; }, onSelection: () => {} });
  editor.commands.selectAll(); editor.commands.setMark('textStyle', { fontFamily: 'serif', fontSize: 24, color: '#123456' });
  editor.commands.setHeading({ level: 4 }); editor.commands.updateAttributes('heading', { lineHeight: '1.5', clear: 'both' });
  assert.equal(window.document.querySelector('h4 span').style.fontSize, '24px');
  assert.equal(window.document.querySelector('h4').style.lineHeight, '1.5');
  const html = api.renderDocument(api.parseDocument(saved));
  assert(html.includes('font-family:Georgia, serif')); assert(html.includes('color:#123456')); assert(html.includes('clear:both'));
  const second = api.createEditor({ element: window.document.getElementById('other'), value: saved, resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  assert.equal(window.document.querySelector('#other h4 span').style.fontSize, '24px');
  second.destroy(); editor.destroy(); dom.window.close();
});

test('CMS wrapper receives media-only updates; links appear immediately without selected text', () => {
  const { dom, window } = environment(); let definition;
  window.CMS = { registerWidget: (_, control) => { definition = control; } };
  window.createClass = x => x; window.h = (type, props, ...children) => ({ type, props, children });
  window.SDSCMSMedia = { resolveAsset: (getAsset, src) => getAsset(src) };
  window.eval(fs.readFileSync(path.join(__dirname, '../assets/js/cms-news-direct.js'), 'utf8'));
  const props = { value: 'Existing text.', entry: { get: () => 'test.md', getIn: () => '' }, field: {}, getAsset: x => x, mediaPaths: new Map(), onChange: () => {}, onClearMediaControl: () => {}, onRemoveMediaControl: () => {} };
  const instance = { props, host: window.document.getElementById('editor'), state: definition.getInitialState(), setState(patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); } };
  for (const [name, value] of Object.entries(definition)) if (typeof value === 'function') instance[name] = value.bind(instance);
  instance.componentDidMount();
  assert(instance.shouldComponentUpdate({ ...props, mediaPaths: new Map([['media', '/new.jpg']]) }));
  assert(instance.shouldComponentUpdate(props, { ...instance.state, revision: 3 }));
  instance.editor.commands.setTextSelection(1); instance.openLink(); instance.state.link = { url: 'example.com', text: '' }; instance.saveLink();
  const anchor = window.document.querySelector('.sds-news-input a');
  assert.equal(anchor.textContent, 'https://example.com'); assert.equal(anchor.getAttribute('href'), 'https://example.com');
  instance.editor.commands.focus('end'); instance.editor.commands.setImage({ src: '/photo.jpg' });
  const previous = instance.props; instance.props = { ...props, getAsset: () => 'blob:https://example.com/new-photo' }; instance.componentDidUpdate(previous);
  assert.equal(window.document.querySelector('.sds-inline-image img').getAttribute('src'), 'blob:https://example.com/new-photo');
  instance.componentWillUnmount(); dom.window.close();
});
