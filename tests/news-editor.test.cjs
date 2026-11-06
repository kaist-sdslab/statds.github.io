const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const components = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/cms-news-editor.js'), 'utf8'), {
  CMS: {
    registerEditorComponent: component => { components[component.id] = component; },
    getWidget: () => ({ preview: 'MarkdownPreview' }),
    getRemarkPlugins: () => []
  },
  window: { SDSCMSMedia: { resolveAsset: (getAsset, value, field) => getAsset(value, field) } },
  h: (type, props, ...children) => ({ type, props, children }),
  TextEncoder, TextDecoder, Uint8Array, btoa, atob
});
const image = components['news-image'];
const aligned = components['news-align'];

// These are stored in Markdown, parsed by Decap, and passed through Hugo's lexer.
test('image layout preserves Unicode, quotes, and backslashes after reopening', () => {
  const data = {
    image: '/statds.github.io/media/news/team dinner.jpeg',
    alt: '사진 "설명" & <tag>', caption: 'KAIST \\ SDS — 행사',
    width: 52, max_width: 420, align: 'right', wrap: true
  };
  const source = image.toBlock(data);
  const parsed = image.fromBlock(source.match(image.pattern));
  for (const key of Object.keys(data)) assert.equal(parsed[key], data[key]);
  assert.equal(image.toBlock(parsed), source);
});

test('optional max width stays empty and unsafe layout values are bounded', () => {
  const source = image.toBlock({ image: 'photo.jpg', width: 300, align: 'invalid' });
  const parsed = image.fromBlock(source.match(image.pattern));
  assert.equal(parsed.width, 100);
  assert.equal(parsed.align, 'center');
  assert.equal(parsed.max_width, undefined);
  assert.equal(image.toBlock(parsed), source);
  const narrow = image.fromBlock(image.toBlock({ width: 1, max_width: 9000 }).match(image.pattern));
  assert.equal(narrow.width, 10);
  assert.equal(narrow.max_width, 2400);
});

test('each aligned text block keeps its own Markdown without swallowing the next block', () => {
  const body = '## Heading\n\n**Bold** text and [a link](https://example.com).\n\n- List item';
  const source = ['left', 'center', 'right', 'justify'].map(align => aligned.toBlock({ align, body })).join('\n\n');
  const matches = [...source.matchAll(new RegExp(aligned.pattern.source, 'gm'))];
  assert.equal(matches.length, 4);
  matches.forEach((match, index) => {
    const parsed = aligned.fromBlock(match);
    assert.equal(parsed.body, body);
    assert.equal(parsed.align, ['left', 'center', 'right', 'justify'][index]);
  });
});

test('image preview resolves uploaded assets and keeps captions as text', () => {
  const preview = image.toPreview({ image: 'photo.jpg', alt: 'Image description', caption: '<script>text</script>', width: 50, align: 'left', wrap: true }, () => 'blob:uploaded-photo', []);
  assert.equal(preview.props.style.width, '50%');
  assert.equal(preview.props.style.float, 'left');
  assert.equal(preview.children[0].props.src, 'blob:uploaded-photo');
  assert.equal(preview.children[0].props.alt, 'Image description');
  assert.equal(preview.children[1].children[0], '<script>text</script>');
});
