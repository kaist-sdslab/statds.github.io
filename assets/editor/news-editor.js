import { Editor, Mark, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import MarkdownIt from 'markdown-it';
import { ImageRow, NormalizeImageRows, share, setImageWidth, beginImageDrag, moveImageWithKey } from './image-layout.js';
export { arrangeDocument, dropImage, locateDrop, setImageWidth } from './image-layout.js';

const markdown = new MarkdownIt({ html: false, breaks: false });
export const align = value => ['left', 'center', 'right', 'justify'].includes(value) ? value : 'left';
export const imageAlign = value => ['left', 'center', 'right'].includes(value) ? value : 'center';
export const width = value => Math.round(Math.max(10, Math.min(100, Number(value) || 100)));
const cap = value => Math.max(0, Math.min(2400, Math.round(Number(value) || 0)));
export const fonts = { sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'monospace' };
export const fontSize = value => Math.max(10, Math.min(72, parseInt(value, 10) || 16));
export const textStyle = attrs => [fonts[attrs.fontFamily] ? `font-family:${fonts[attrs.fontFamily]}` : '', attrs.fontSize ? `font-size:${fontSize(attrs.fontSize)}px` : '', /^#[\da-f]{6}$/i.test(attrs.color) ? `color:${attrs.color}` : ''].filter(Boolean).join(';');
const Typography = Mark.create({
  name: 'textStyle',
  addAttributes() { return {
    fontFamily: { default: null, parseHTML: el => Object.keys(fonts).find(key => el.style.fontFamily.replaceAll('"', '') === fonts[key]) || null },
    fontSize: { default: null, parseHTML: el => el.style.fontSize ? fontSize(el.style.fontSize) : null },
    color: { default: null }
  }; },
  parseHTML() { return [{ tag: 'span[style]' }]; },
  renderHTML({ mark }) { return ['span', { style: textStyle(mark.attrs) }, 0]; }
});
const ParagraphLayout = Extension.create({
  name: 'paragraphLayout',
  addGlobalAttributes() { return [{ types: ['paragraph', 'heading'], attributes: {
    clear: { default: null, parseHTML: el => el.style.clear === 'both' ? 'both' : null, renderHTML: attrs => attrs.clear === 'both' ? { style: 'clear:both' } : {} },
    lineHeight: { default: null, parseHTML: el => ['1.2', '1.5', '1.8', '2'].includes(el.style.lineHeight) ? el.style.lineHeight : null, renderHTML: attrs => ['1.2', '1.5', '1.8', '2'].includes(attrs.lineHeight) ? { style: `line-height:${attrs.lineHeight}` } : {} }
  } }]; }
});
export function applyFontSize(editor, value, selected = editor.state.selection) {
  let { from, to } = selected;
  if (from === to) {
    const position = editor.state.doc.resolve(from);
    if (!position.parent.isTextblock) return;
    from = position.start(); to = position.end();
    if (from === to) { editor.commands.setMark('textStyle', { fontSize: value == null ? null : fontSize(value) }); return; }
  }
  const current = { from: editor.state.selection.from, to: editor.state.selection.to };
  editor.chain().setTextSelection({ from, to }).setMark('textStyle', { fontSize: value == null ? null : fontSize(value) }).setTextSelection(current).run();
}
export function selectCover(editor, selected) {
  const position = editor.state.selection.from, transaction = editor.state.tr;
  editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') transaction.setNodeMarkup(pos, undefined, { ...node.attrs, cover: selected && pos === position }); });
  editor.view.dispatch(transaction);
}
export function getCover(doc) {
  let cover = null;
  const walk = node => { if (!cover && node.type === 'image' && node.attrs?.cover) cover = { image: node.attrs.src, image_alt: node.attrs.alt || '' }; (node.content || []).forEach(walk); };
  if (doc) walk(doc);
  return cover || { image: '', image_alt: '' };
}
export function refreshImages(editor, resolve) {
  editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') { const img = editor.view.nodeDOM(pos)?.querySelector('img'), src = resolve(node.attrs.src); if (img && img.getAttribute('src') !== src) img.src = src; } });
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const encode = value => btoa(Array.from(new TextEncoder().encode(value), c => String.fromCharCode(c)).join(''));
const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0)));
export const safeLink = value => /^(?:https?:\/\/|mailto:|tel:|\/|#)/i.test(value || '') || !!value && !String(value).includes(':') ? String(value) : '';
export function serialize(doc) { return `{{< news-content >}}\n${encode(JSON.stringify(doc))}\n{{< /news-content >}}`; }
export function parseDocument(value) {
  const match = String(value || '').trim().match(/^\{\{< news-content >\}\}\s*([A-Za-z0-9+/=\s]+)\s*\{\{< \/news-content >\}\}$/);
  if (!match) return null;
  const doc = JSON.parse(decode(match[1].replace(/\s/g, '')));
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) throw new Error('This article has an invalid document structure.');
  return doc;
}
function attributes(value) {
  const result = {};
  for (const m of value.matchAll(/(\w+)=("(?:\\.|[^"\\])*"|[^\s]+)/g)) result[m[1]] = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2];
  return result;
}
export function legacyHTML(value) {
  const fragments = [];
  let source = String(value || '').replace(/^\{\{< news-align align="(left|center|right|justify)" >\}\}\n([\s\S]*?)\n\{\{< \/news-align >\}\}$/gm, (_, alignment, body) => {
    const token = `SDSBLOCK${fragments.length}END`;
    fragments.push(`<div data-news-align="${alignment}">${legacyHTML(body)}</div>`);
    return token;
  }).replace(/^\{\{< news-image ([^\n]*?) >\}\}$/gm, (_, params) => {
    const data = attributes(params), token = `SDSBLOCK${fragments.length}END`;
    fragments.push(`<img src="${escape(data.src)}" alt="${escape(decode(data.alt64 || ''))}" data-news-width="${width(data.width)}" data-news-max-width="${cap(data.maxwidth)}" data-news-align="${imageAlign(data.align)}" data-news-wrap="${data.wrap === 'true'}" data-news-caption="${escape(decode(data.caption64 || ''))}">`);
    return token;
  });
  if (/\{\{[<%]/.test(source)) throw new Error('This article contains an unsupported shortcode. Its original text has been preserved; use the source field below to edit it.');
  let html = markdown.render(source);
  fragments.forEach((fragment, i) => { html = html.replace(`<p>SDSBLOCK${i}END</p>`, fragment); });
  return html;
}
export function renderDocument(doc, resolve = src => src) {
  const render = (node, inRow = false) => {
    const attrs = node.attrs || {}, children = () => (node.content || []).map(child => render(child, node.type === 'imageRow')).join('');
    const blockStyle = [attrs.clear === 'both' ? 'clear:both' : '', ['1.2', '1.5', '1.8', '2'].includes(attrs.lineHeight) ? `line-height:${attrs.lineHeight}` : ''].filter(Boolean).join(';');
    const cls = (attrs.textAlign ? ` class="news-text-${align(attrs.textAlign)}"` : '') + (blockStyle ? ` style="${blockStyle}"` : '');
    switch (node.type) {
      case 'doc': return children();
      case 'imageRow': return `<div class="news-image-row" data-news-image-row>${children()}</div>`;
      case 'text': {
        let result = escape(node.text);
        for (const mark of node.marks || []) {
          const tag = { bold: 'strong', italic: 'em', strike: 's', code: 'code', underline: 'u' }[mark.type];
          if (tag) result = `<${tag}>${result}</${tag}>`;
          else if (mark.type === 'textStyle') result = `<span style="${textStyle(mark.attrs || {})}">${result}</span>`;
          else if (mark.type === 'link' && safeLink(mark.attrs?.href)) result = `<a href="${escape(safeLink(mark.attrs.href))}">${result}</a>`;
        }
        return result;
      }
      case 'paragraph': return `<p${cls}>${children() || '<br>'}</p>`;
      case 'heading': { const level = Math.max(1, Math.min(6, Number(attrs.level) || 2)); return `<h${level}${cls}>${children()}</h${level}>`; }
      case 'hardBreak': return '<br>';
      case 'horizontalRule': return '<hr>';
      case 'blockquote': return `<blockquote>${children()}</blockquote>`;
      case 'bulletList': return `<ul>${children()}</ul>`;
      case 'orderedList': return `<ol start="${Math.max(1, Number(attrs.start) || 1)}">${children()}</ol>`;
      case 'listItem': return `<li>${children()}</li>`;
      case 'codeBlock': return `<pre><code>${escape((node.content || []).map(n => n.text || '').join(''))}</code></pre>`;
      case 'table': return `<table><tbody>${children()}</tbody></table>`;
      case 'tableRow': return `<tr>${children()}</tr>`;
      case 'tableCell': case 'tableHeader': { const tag = node.type === 'tableHeader' ? 'th' : 'td'; return `<${tag}>${children()}</${tag}>`; }
      case 'image': {
        const position = imageAlign(attrs.alignment), wrap = !inRow && attrs.wrap && position !== 'center';
        const percent = inRow ? share(attrs.widthPercent) : width(attrs.widthPercent);
        return `<figure class="news-figure news-figure-${position}${wrap ? ' news-figure-wrap' : ''}" style="--image-weight:${percent};width:${percent}%;${cap(attrs.maxWidth) ? `max-width:${cap(attrs.maxWidth)}px;` : ''}"><img src="${escape(resolve(attrs.src || ''))}" alt="${escape(attrs.alt)}"></figure>`;
      }
      default: return children();
    }
  };
  return render(doc);
}
const LayoutImage = Image.extend({
  addOptions() { return { ...this.parent?.(), resolveAsset: src => src }; },
  addAttributes() {
    return { ...this.parent?.(),
      widthPercent: { default: 100, parseHTML: el => width(el.getAttribute('data-news-width')), renderHTML: a => ({ 'data-news-width': width(a.widthPercent) }) },
      maxWidth: { default: 0, parseHTML: el => cap(el.getAttribute('data-news-max-width')), renderHTML: a => ({ 'data-news-max-width': cap(a.maxWidth) }) },
      alignment: { default: 'center', parseHTML: el => imageAlign(el.getAttribute('data-news-align')), renderHTML: a => ({ 'data-news-align': imageAlign(a.alignment) }) },
      wrap: { default: false, parseHTML: el => el.getAttribute('data-news-wrap') === 'true', renderHTML: a => ({ 'data-news-wrap': !!a.wrap }) },
      caption: { default: '', parseHTML: el => el.getAttribute('data-news-caption') || '', renderHTML: a => ({ 'data-news-caption': a.caption || '' }) },
      cover: { default: false, parseHTML: el => el.getAttribute('data-news-cover') === 'true', renderHTML: a => ({ 'data-news-cover': !!a.cover }) }
    };
  },
  addNodeView() {
    const resolve = this.options.resolveAsset;
    return ({ node: initial, editor, getPos }) => {
      let node = initial, cleanup, dragCleanup;
      const dom = document.createElement('figure'), img = document.createElement('img'), handle = document.createElement('button'), grip = document.createElement('button');
      dom.contentEditable = 'false'; dom.draggable = false;
      img.draggable = false;
      handle.type = 'button'; handle.className = 'sds-image-resize'; handle.setAttribute('aria-label', 'Resize image; use arrow keys to change width'); handle.textContent = '↘';
      grip.type = 'button'; grip.className = 'sds-image-move'; grip.setAttribute('aria-label', 'Drag image to arrange. Arrow up/down moves; left/right groups with a neighboring picture.'); grip.textContent = '⠿';
      dom.append(img, grip, handle);
      const inRow = () => typeof getPos() === 'number' && editor.state.doc.resolve(getPos()).parent.type.name === 'imageRow';
      const draw = () => {
        const a = node.attrs, position = imageAlign(a.alignment), grouped = inRow(), wrap = !grouped && a.wrap && position !== 'center';
        const selected = dom.classList.contains('ProseMirror-selectednode');
        dom.className = `sds-inline-image news-figure news-figure-${position}${wrap ? ' news-figure-wrap' : ''}`;
        if (selected) dom.classList.add('ProseMirror-selectednode');
        dom.style.width = `${width(a.widthPercent)}%`; dom.style.setProperty('--image-weight', share(a.widthPercent)); dom.style.maxWidth = cap(a.maxWidth) ? `${cap(a.maxWidth)}px` : '100%';
        dom.style.marginLeft = position === 'left' ? '0' : 'auto'; dom.style.marginRight = position === 'right' ? '0' : 'auto';
        const src = resolve(a.src || ''); if (img.getAttribute('src') !== src) img.src = src; img.alt = a.alt || '';
      };
      const select = () => { const pos = getPos(); if (typeof pos === 'number') editor.commands.setNodeSelection(pos); };
      grip.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (moveImageWithKey(editor, getPos(), event.key)) editor.view.nodeDOM(editor.state.selection.from)?.querySelector('.sds-image-move')?.focus();
      });
      dom.addEventListener('click', event => { if (event.target !== handle) select(); });
      dom.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target === handle || (event.pointerType === 'touch' && event.target !== grip)) return;
        event.preventDefault(); event.stopPropagation(); select(); dragCleanup?.(); dragCleanup = beginImageDrag(editor, getPos, event);
      });
      handle.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); select(); setImageWidth(editor, node.attrs.widthPercent + (event.key === 'ArrowRight' ? 5 : -5)); } });
      handle.addEventListener('pointerdown', event => {
        event.preventDefault(); event.stopPropagation(); select();
        const start = event.clientX, initialWidth = dom.getBoundingClientRect().width, available = dom.parentElement.clientWidth, grouped = inRow();
        const direction = !grouped && node.attrs.alignment === 'right' ? -1 : !grouped && node.attrs.alignment === 'center' ? 2 : 1;
        const siblings = grouped ? [...dom.parentElement.children].map(element => ({ element, weight: Number(element.style.getPropertyValue('--image-weight')) || 1 })) : [];
        let next = width(node.attrs.widthPercent);
        const move = e => {
          next = Math.max(grouped ? 1 : 10, Math.min(grouped ? 100 - siblings.length + 1 : 100, (initialWidth + (e.clientX - start) * direction) / available * 100));
          if (grouped) {
            const sum = siblings.filter(item => item.element !== dom).reduce((total, item) => total + item.weight, 0);
            siblings.forEach(item => item.element.style.setProperty('--image-weight', item.element === dom ? next : (100 - next) * item.weight / sum));
          } else dom.style.width = `${next}%`;
        };
        const finish = () => { cleanup(); setImageWidth(editor, next); };
        const cancel = () => { cleanup(); siblings.forEach(item => item.element.style.setProperty('--image-weight', item.weight)); draw(); };
        cleanup = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
      });
      draw();
      return { dom, update(next) { if (next.type !== node.type) return false; node = next; draw(); return true; },
        selectNode() { dom.classList.add('ProseMirror-selectednode'); }, deselectNode() { dom.classList.remove('ProseMirror-selectednode'); },
        stopEvent: event => event.target === handle || event.target === grip || event.type.startsWith('pointer'), ignoreMutation: () => true, destroy() { cleanup?.(); dragCleanup?.(); } };
    };
  }
});
export function createEditor({ element, value, defaultAlignment = 'left', coverImage = '', coverAlt = '', resolveAsset, onUpdate, onSelection }) {
  const doc = parseDocument(value);
  let content = doc;
  if (!doc) {
    const container = document.createElement('div'); container.innerHTML = legacyHTML(value);
    container.querySelectorAll('p,h1,h2,h3,h4,h5,h6').forEach(block => {
      const wrapper = block.closest('[data-news-align]');
      if (wrapper) block.style.textAlign = align(wrapper.dataset.newsAlign);
      else if (defaultAlignment !== 'left') block.style.textAlign = align(defaultAlignment);
    });
    content = container.innerHTML;
    if (coverImage) {
      const existing = [...container.querySelectorAll('img')].find(img => img.getAttribute('src') === coverImage);
      if (existing) existing.dataset.newsCover = 'true';
      else { const img = document.createElement('img'); img.src = coverImage; img.alt = coverAlt; img.dataset.newsCover = 'true'; container.prepend(img); }
      content = container.innerHTML;
    }
  }
  return new Editor({ element, extensions: [StarterKit.configure({ link: { openOnClick: false }, underline: false }), Typography, ParagraphLayout, ImageRow, NormalizeImageRows, LayoutImage.configure({ resolveAsset }), TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'left' }), TableKit.configure({ table: { resizable: false } })],
    content, editorProps: { attributes: { class: 'sds-news-input', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'News article body' } },
    onUpdate: ({ editor }) => onUpdate(serialize(editor.getJSON())), onSelectionUpdate: ({ editor }) => onSelection(editor), onTransaction: ({ editor }) => onSelection(editor) });
}
