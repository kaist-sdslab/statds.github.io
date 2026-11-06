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
  assert.equal(figure.querySelector('figcaption'), null);
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
  assert.equal(window.document.querySelector('figcaption'), null);
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

test('font-size input applies immediately without losing toolbar focus, including an unselected paragraph', () => {
  const { dom, window, api } = environment(); let definition, saved;
  window.CMS = { registerWidget: (_, control) => { definition = control; } };
  window.createClass = x => x; window.h = (type, props, ...children) => ({ type, props, children });
  window.SDSCMSMedia = { resolveAsset: (_, src) => src };
  window.eval(fs.readFileSync(path.join(__dirname, '../assets/js/cms-news-direct.js'), 'utf8'));
  const props = { value: 'Live size', entry: { get: () => 'size.md', getIn: () => '' }, field: {}, getAsset: x => x, mediaPaths: new Map(), onChange: value => { saved = value; } };
  const instance = { props, host: window.document.getElementById('editor'), state: definition.getInitialState(), setState(patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); } };
  for (const [name, value] of Object.entries(definition)) if (typeof value === 'function') instance[name] = value.bind(instance);
  instance.componentDidMount(); instance.editor.commands.setTextSelection(3);
  const field = window.document.createElement('input'); window.document.body.append(field); field.focus(); field.value = '24';
  instance.beginFontSize({ target: field }); instance.updateFontSize({ target: field });
  assert.equal(window.document.querySelector('.sds-news-input span').style.fontSize, '24px');
  assert(api.renderDocument(api.parseDocument(saved)).includes('font-size:24px'));
  assert.equal(window.document.activeElement, field);
  field.value = '32'; instance.updateFontSize({ target: field });
  assert.equal(window.document.querySelector('.sds-news-input span').style.fontSize, '32px');
  instance.editor.commands.setTextSelection({ from: 1, to: 5 }); api.applyFontSize(instance.editor, 20);
  assert.equal(window.document.querySelector('.sds-news-input span').style.fontSize, '20px');
  assert.equal(window.document.querySelectorAll('.sds-news-input span')[1].style.fontSize, '32px');
  const empty = api.createEditor({ element: window.document.getElementById('other'), value: '', resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  api.applyFontSize(empty, 28); empty.commands.insertContent('New text');
  assert.equal(window.document.querySelector('#other span').style.fontSize, '28px'); empty.destroy();
  instance.componentWillUnmount(); dom.window.close();
});

test('dragging an image beside another creates a saved row; extraction, ratios, undo and cover flags survive', () => {
  const { dom, window, api } = environment(); let saved;
  const photo = (src, cover = false) => ({ type: 'image', attrs: { src, cover, widthPercent: 100, alignment: 'center', wrap: false } });
  const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  const value = api.serialize({ type: 'doc', content: [photo('/a.jpg', true), paragraph('Words stay next to the moved photo.'), photo('/b.jpg'), photo('/c.jpg'), paragraph('Final paragraph.')] });
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value, resolveAsset: x => x, onUpdate: next => { saved = next; }, onSelection: () => {} });
  const positions = () => { const result = {}; editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') result[node.attrs.src] = pos; if (node.type.name === 'paragraph' && node.textContent.startsWith('Words')) result.text = pos; }); return result; };
  let p = positions(); assert(api.dropImage(editor, p['/a.jpg'], p['/b.jpg'], 'row-before'));
  let row = editor.getJSON().content.find(n => n.type === 'imageRow');
  assert.deepEqual(Array.from(row.content, n => n.attrs.src), ['/a.jpg', '/b.jpg']);
  assert.equal(api.getCover(api.parseDocument(saved)).image, '/a.jpg');
  assert.equal(window.document.querySelectorAll('.news-image-row > figure').length, 2);
  p = positions(); assert(api.dropImage(editor, p['/c.jpg'], p['/b.jpg'], 'row-after'));
  row = editor.getJSON().content.find(n => n.type === 'imageRow'); assert.equal(row.content.length, 3);
  api.setImageWidth(editor, 50); row = editor.getJSON().content.find(n => n.type === 'imageRow');
  assert.equal(row.content[2].attrs.widthPercent, 50); assert.equal(row.content.reduce((sum, n) => sum + n.attrs.widthPercent, 0), 100);
  p = positions(); assert(api.dropImage(editor, p['/a.jpg'], p['/b.jpg'], 'row-after'));
  row = editor.getJSON().content.find(n => n.type === 'imageRow');
  assert.deepEqual(Array.from(row.content, n => n.attrs.widthPercent), [25, 25, 50]);
  p = positions(); assert(api.dropImage(editor, p['/a.jpg'], p.text, 'wrap-left'));
  const moved = editor.getJSON().content.find(n => n.type === 'image' && n.attrs.src === '/a.jpg');
  assert.equal(moved.attrs.alignment, 'left'); assert.equal(moved.attrs.wrap, true);
  assert.equal(editor.getJSON().content.find(n => n.type === 'imageRow').content.length, 2);
  editor.commands.undo(); assert.equal(editor.getJSON().content.find(n => n.type === 'imageRow').content.length, 3);
  const second = api.createEditor({ element: window.document.getElementById('other'), value: api.serialize(editor.getJSON()), resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  assert.equal(window.document.querySelectorAll('#other .news-image-row > figure').length, 3);
  assert(api.renderDocument(second.getJSON()).includes('news-image-row'));
  second.destroy(); editor.destroy(); dom.window.close();
});

test('actual pointer drag shows the row drop hint and groups on release; cancel is non-destructive', () => {
  const { dom, window, api } = environment();
  const value = api.serialize({ type: 'doc', content: [{ type: 'image', attrs: { src: '/a.jpg' } }, { type: 'image', attrs: { src: '/b.jpg' } }, { type: 'paragraph' }] });
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value, resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  editor.view.dom.getBoundingClientRect = () => rect(0, 0, 600, 600);
  const figures = window.document.querySelectorAll('figure');
  figures[0].getBoundingClientRect = () => rect(20, 40, 240, 120); figures[1].getBoundingClientRect = () => rect(20, 220, 240, 120);
  const fire = (target, type, x, y) => target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, cancelable: true }));
  fire(figures[0].querySelector('.sds-image-move'), 'pointerdown', 30, 50); fire(window.document, 'pointermove', 60, 280);
  assert.equal(window.document.querySelector('.sds-image-drop-hint').textContent, 'Same image row');
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(window.document.querySelector('.sds-image-drop-indicator'), null); assert(!editor.getJSON().content.some(n => n.type === 'imageRow'));
  fire(figures[0].querySelector('img'), 'pointerdown', 30, 50); fire(window.document, 'pointermove', 240, 280); fire(window.document, 'pointerup', 240, 280);
  assert.equal(editor.getJSON().content[0].type, 'imageRow');
  assert.equal(editor.getJSON().content[0].content.length, 2);
  assert.equal(window.document.querySelector('.sds-image-drop-hint'), null);
  editor.destroy(); dom.window.close();
});

test('deleting from a row unwraps a single remaining image without losing its cover', () => {
  const { dom, window, api } = environment();
  const value = api.serialize({ type: 'doc', content: [{ type: 'imageRow', content: [{ type: 'image', attrs: { src: '/a.jpg', cover: true } }, { type: 'image', attrs: { src: '/b.jpg' } }] }, { type: 'paragraph' }] });
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value, resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  let position; editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image' && node.attrs.src === '/b.jpg') position = pos; });
  editor.commands.setNodeSelection(position); editor.commands.deleteSelection();
  assert(!editor.getJSON().content.some(n => n.type === 'imageRow'));
  assert.equal(api.getCover(editor.getJSON()).image, '/a.jpg');
  assert.equal(editor.getJSON().content[0].attrs.widthPercent, 100);
  editor.destroy(); dom.window.close();
});

test('touch uses the image grip while allowing normal scrolling on pictures; keyboard moves and regroups', () => {
  const { dom, window, api } = environment();
  const value = api.serialize({ type: 'doc', content: [{ type: 'image', attrs: { src: '/a.jpg', cover: true } }, { type: 'image', attrs: { src: '/b.jpg' } }, { type: 'paragraph', content: [{ type: 'text', text: 'After photos' }] }] });
  const editor = api.createEditor({ element: window.document.getElementById('editor'), value, resolveAsset: x => x, onUpdate: () => {}, onSelection: () => {} });
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  editor.view.dom.getBoundingClientRect = () => rect(0, 0, 360, 600);
  const images = window.document.querySelectorAll('figure');
  images[0].getBoundingClientRect = () => rect(10, 20, 160, 100); images[1].getBoundingClientRect = () => rect(10, 200, 160, 100);
  const touch = (target, type, x, y) => { const event = new window.MouseEvent(type, { button: 0, bubbles: true, clientX: x, clientY: y, cancelable: true }); Object.defineProperty(event, 'pointerType', { value: 'touch' }); target.dispatchEvent(event); return event; };
  assert(!touch(images[0].querySelector('img'), 'pointerdown', 20, 40).defaultPrevented);
  touch(window.document, 'pointermove', 30, 250); assert.equal(window.document.querySelector('.sds-image-drop-hint'), null);
  assert(touch(images[0].querySelector('.sds-image-move'), 'pointerdown', 20, 40).defaultPrevented);
  touch(window.document, 'pointermove', 140, 250); touch(window.document, 'pointerup', 140, 250);
  assert.equal(editor.getJSON().content[0].type, 'imageRow');
  const key = name => editor.view.nodeDOM(editor.state.selection.from).querySelector('.sds-image-move').dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  key('ArrowDown'); assert(!editor.getJSON().content.some(n => n.type === 'imageRow'));
  key('ArrowLeft'); assert.equal(editor.getJSON().content[0].type, 'imageRow');
  assert.equal(api.getCover(editor.getJSON()).image, '/a.jpg');
  editor.destroy(); dom.window.close();
});
