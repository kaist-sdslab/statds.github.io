import { Node, Extension } from '@tiptap/core';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

export const share = value => Math.max(.001, Math.min(100, Number(value) || 100));
const percent = value => Math.max(10, Math.min(100, Math.round(Number(value) || 100)));
const direction = value => value === 'column' ? 'column' : 'row';
const alignment = value => ['left', 'right'].includes(value) ? value : 'center';
export function layoutAttributes(attrs = {}) {
  const side = alignment(attrs.alignment), wrap = !!attrs.wrap && side !== 'center';
  return { class: `news-image-layout news-image-${direction(attrs.direction)} news-image-layout-${side}${wrap ? ' news-image-layout-wrap' : ''}`, style: `width:${percent(attrs.widthPercent)}%;`, 'data-news-image-layout': direction(attrs.direction) };
}
// Keep the stored name for compatibility with previously published articles.
export const ImageRow = Node.create({
  name: 'imageRow', group: 'block', content: 'image*', isolating: true,
  addAttributes() { return {
    direction: { default: 'row', parseHTML: el => direction(el.dataset.newsImageLayout) },
    alignment: { default: 'center', parseHTML: el => alignment(el.dataset.newsAlign) },
    wrap: { default: false, parseHTML: el => el.dataset.newsWrap === 'true' },
    widthPercent: { default: 100, parseHTML: el => percent(el.dataset.newsWidth) }
  }; },
  parseHTML() { return [{ tag: 'div[data-news-image-layout]' }, { tag: 'div[data-news-image-row]' }]; },
  renderHTML({ node }) { return ['div', { ...layoutAttributes(node.attrs), 'data-news-align': alignment(node.attrs.alignment), 'data-news-wrap': !!node.attrs.wrap, 'data-news-width': percent(node.attrs.widthPercent) }, 0]; },
  addNodeView() { return layoutView; }
});

function outline(doc) {
  const result = [];
  const walk = (parent, start, path) => parent.forEach((node, offset, index) => {
    const pos = start + offset, next = [...path, index]; result.push({ node, pos, path: next });
    if (node.childCount) walk(node, pos + 1, next);
  });
  walk(doc, 0, []); return result;
}
function at(doc, path) { return path.reduce((node, index) => node.content[index], doc); }
function findPath(doc, target, path = []) {
  if (doc === target) return path;
  for (let i = 0; i < (doc.content || []).length; i++) { const found = findPath(doc.content[i], target, [...path, i]); if (found) return found; }
  return null;
}
function singleImage(attrs, imageAttrs) { return { ...imageAttrs, widthPercent: percent(attrs?.widthPercent), alignment: alignment(attrs?.alignment), wrap: !!attrs?.wrap }; }
function normalizeLayout(node) {
  if (!node.content.length) return;
  if (direction(node.attrs?.direction) === 'column') return;
  const total = node.content.reduce((sum, image) => sum + share(image.attrs?.widthPercent), 0);
  node.content.forEach(image => { image.attrs = { ...image.attrs, widthPercent: share(image.attrs?.widthPercent) / total * 100 }; });
}
function cleanLayouts(node) {
  if (!node.content) return;
  node.content.forEach(cleanLayouts);
  node.content = node.content.flatMap(child => {
    if (child.type !== 'imageRow') return [child];
    if (!child.content.length) return [];
    if (child.content.length === 1) { const image = child.content[0]; image.attrs = singleImage(child.attrs, image.attrs); return [image]; }
    normalizeLayout(child); return [child];
  });
}
function remove(doc, target) {
  if (!doc.content) return;
  doc.content = doc.content.filter(node => node !== target); doc.content.forEach(node => remove(node, target));
}

// A drop edits the layout in one transaction without changing text or cover data.
export function arrangeDocument(original, sourcePath, targetPath, mode) {
  const doc = JSON.parse(JSON.stringify(original)), source = at(doc, sourcePath), target = at(doc, targetPath);
  const arranging = /^(row|column)-(before|after)$/.test(mode);
  if (!['image', 'imageRow'].includes(source.type) || source === target || findPath(source, target) || ![...['before', 'after', 'wrap-left', 'wrap-right'], 'row-before', 'row-after', 'column-before', 'column-after'].includes(mode)) return null;
  if (arranging && !['image', 'imageRow'].includes(target.type)) return null;
  const originalParent = at(doc, sourcePath.slice(0, -1)), targetParent = at(doc, targetPath.slice(0, -1));
  const container = target.type === 'imageRow' ? target : targetParent.type === 'imageRow' ? targetParent : null;
  const containerAttrs = { direction: arranging ? mode.split('-')[0] : 'row', alignment: alignment((container || target).attrs?.alignment), wrap: !!(container || target).attrs?.wrap, widthPercent: percent((container || target).attrs?.widthPercent) };
  const previousDirection = direction(container?.attrs?.direction);
  const originalShares = new Map(originalParent === container && previousDirection === 'row' && mode.startsWith('row-') ? container.content.map(node => [node, node.attrs?.widthPercent]) : []);
  const sourceImages = source.type === 'imageRow' ? source.content : [source];
  remove(doc, source); cleanLayouts(doc);
  let path = findPath(doc, target); if (!path) return null;
  let focus = source;
  if (arranging) {
    const parent = at(doc, path.slice(0, -1)), after = mode.endsWith('-after') ? 1 : 0;
    let layout, index;
    if (target.type === 'imageRow') { layout = target; index = after ? layout.content.length : 0; }
    else if (parent.type === 'imageRow') { layout = parent; index = path.at(-1) + after; }
    else {
      layout = { type: 'imageRow', attrs: containerAttrs, content: [target] };
      parent.content.splice(path.at(-1), 1, layout); index = after;
    }
    layout.attrs = { ...layout.attrs, ...containerAttrs };
    layout.content.splice(index, 0, ...sourceImages);
    layout.content.forEach(image => { image.attrs = { ...image.attrs, alignment: 'center', wrap: false, maxWidth: 0,
      widthPercent: mode.startsWith('column-') ? 100 : originalShares.size ? originalShares.get(image) : 100 / layout.content.length }; });
    focus = source.type === 'imageRow' ? layout : source;
  } else {
    if (at(doc, path.slice(0, -1)).type === 'imageRow') path = path.slice(0, -1);
    const parent = at(doc, path.slice(0, -1)), index = path.at(-1), wrapping = mode.startsWith('wrap-');
    const previousWidth = source.type === 'image' && originalParent.type === 'imageRow' ? originalParent.attrs?.widthPercent : source.attrs?.widthPercent;
    source.attrs = { ...source.attrs, alignment: wrapping ? mode.slice(5) : 'center', wrap: wrapping, widthPercent: percent(wrapping ? Math.min(55, percent(previousWidth)) : previousWidth) };
    if (wrapping && target.attrs?.clear) target.attrs = { ...target.attrs, clear: null };
    parent.content.splice(index + (mode === 'after' ? 1 : 0), 0, source);
  }
  cleanLayouts(doc); return { doc, path: findPath(doc, focus) };
}
export function dropImage(editor, sourcePos, targetPos, mode) {
  const nodes = outline(editor.state.doc), source = nodes.find(item => item.pos === sourcePos && ['image', 'imageRow'].includes(item.node.type.name)), target = nodes.find(item => item.pos === targetPos);
  if (!source || !target) return false;
  const result = arrangeDocument(editor.getJSON(), source.path, target.path, mode); if (!result) return false;
  let content; try { content = editor.schema.nodeFromJSON(result.doc); content.check(); } catch { return false; }
  const targetNode = outline(content).find(item => JSON.stringify(item.path) === JSON.stringify(result.path)); if (!targetNode) return false;
  const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, content.content); tr.setSelection(NodeSelection.create(tr.doc, targetNode.pos));
  editor.view.dispatch(closeHistory(tr).scrollIntoView()); editor.view.dispatch(closeHistory(editor.state.tr)); return true;
}
export function setLayoutWidth(editor, pos, value) {
  const node = editor.state.doc.nodeAt(pos); if (node?.type.name !== 'imageRow') return;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, widthPercent: percent(value) }));
}
export function setImageWidth(editor, value) {
  const { selection, tr } = editor.state, selected = selection.node; if (selected?.type.name !== 'image') return;
  const parent = selection.$from.parent;
  if (parent.type.name !== 'imageRow' || direction(parent.attrs.direction) === 'column') { editor.commands.updateAttributes('image', { widthPercent: percent(value) }); return; }
  const width = Math.max(1, Math.min(100 - parent.childCount + 1, Number(value) || 1)), remaining = 100 - width;
  const sum = parent.content.content.filter(node => node !== selected).reduce((total, node) => total + share(node.attrs.widthPercent), 0);
  let pos = selection.$from.start();
  parent.forEach(node => { tr.setNodeMarkup(pos, undefined, { ...node.attrs, widthPercent: node === selected ? width : remaining * share(node.attrs.widthPercent) / sum }); pos += node.nodeSize; });
  editor.view.dispatch(tr);
}
export function moveImageWithKey(editor, sourcePos, key) {
  const nodes = outline(editor.state.doc), source = nodes.find(item => item.pos === sourcePos && ['image', 'imageRow'].includes(item.node.type.name)); if (!source) return false;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const images = nodes.filter(item => item.node.type.name === 'image' && !(source.node.type.name === 'imageRow' && item.path.slice(0, source.path.length).every((index, i) => index === source.path[i]))), index = images.indexOf(source);
    const target = index < 0 ? key === 'ArrowLeft' ? images.filter(item => item.pos < sourcePos).at(-1) : images.find(item => item.pos >= sourcePos + source.node.nodeSize) : images[index + (key === 'ArrowLeft' ? -1 : 1)];
    return !!target && dropImage(editor, sourcePos, target.pos, key === 'ArrowLeft' ? 'row-before' : 'row-after');
  }
  const blocks = nodes.filter(item => item.path.length === 1), target = blocks[source.path[0] + (key === 'ArrowUp' ? -1 : 1)];
  return !!target && dropImage(editor, sourcePos, target.pos, key === 'ArrowUp' ? 'before' : 'after');
}
export const NormalizeImageRows = Extension.create({
  name: 'normalizeImageRows',
  addProseMirrorPlugins() { return [new Plugin({ appendTransaction(transactions, oldState, state) {
    if (!transactions.some(tr => tr.docChanged)) return null;
    const tr = state.tr; let changed = false;
    for (const { node, pos } of outline(state.doc).filter(item => item.node.type.name === 'imageRow').reverse()) {
      if (node.childCount >= 2) {
        if (direction(node.attrs.direction) === 'column') continue;
        const total = node.content.content.reduce((sum, image) => sum + share(image.attrs.widthPercent), 0); if (Math.abs(total - 100) < .001) continue;
        let childPos = pos + 1; node.forEach(image => { tr.setNodeMarkup(childPos, undefined, { ...image.attrs, widthPercent: share(image.attrs.widthPercent) / total * 100 }); childPos += image.nodeSize; });
      } else if (node.childCount) tr.replaceWith(pos, pos + node.nodeSize, node.firstChild.type.create(singleImage(node.attrs, node.firstChild.attrs)));
      else tr.delete(pos, pos + node.nodeSize);
      changed = true;
    }
    return changed ? tr : null;
  } })]; }
});

function layoutView({ node: initial, editor, getPos }) {
  let node = initial, cancelDrag, cancelResize;
  const dom = document.createElement('div'), contentDOM = document.createElement('div'), grip = document.createElement('button'), resize = document.createElement('button');
  contentDOM.className = 'sds-image-layout-content'; dom.append(contentDOM, grip, resize);
  for (const control of [grip, resize]) { control.type = 'button'; control.contentEditable = 'false'; }
  grip.className = 'sds-layout-move'; grip.textContent = '⠿ Images'; grip.setAttribute('aria-label', 'Move image layout beside text or above and below a paragraph');
  resize.className = 'sds-layout-resize'; resize.textContent = '↘'; resize.setAttribute('aria-label', 'Resize image layout');
  const draw = () => { const attrs = layoutAttributes(node.attrs), selected = dom.classList.contains('ProseMirror-selectednode'); dom.className = `${attrs.class} sds-image-layout${selected ? ' ProseMirror-selectednode' : ''}`; dom.style.width = `${percent(node.attrs.widthPercent)}%`; dom.dataset.newsImageLayout = direction(node.attrs.direction); };
  const select = () => { if (typeof getPos() === 'number') editor.commands.setNodeSelection(getPos()); };
  dom.addEventListener('click', event => { if (event.target === dom || event.target === contentDOM || event.target === grip) select(); });
  grip.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); select(); cancelDrag?.(); cancelDrag = beginImageDrag(editor, getPos, event); });
  grip.addEventListener('keydown', event => { if (!event.key.startsWith('Arrow')) return; event.preventDefault(); event.stopPropagation(); if (moveImageWithKey(editor, getPos(), event.key)) editor.view.nodeDOM(editor.state.selection.from)?.querySelector('.sds-layout-move')?.focus(); });
  resize.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); select(); setLayoutWidth(editor, getPos(), percent(node.attrs.widthPercent) + (event.key === 'ArrowRight' ? 5 : -5)); });
  resize.addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopPropagation(); select();
    const start = event.clientX, initial = dom.getBoundingClientRect().width, available = dom.parentElement.clientWidth;
    const factor = node.attrs.alignment === 'right' ? -1 : node.attrs.alignment === 'center' ? 2 : 1; let next = percent(node.attrs.widthPercent);
    const move = e => { next = percent((initial + (e.clientX - start) * factor) / Math.max(1, available) * 100); dom.style.width = `${next}%`; };
    const finish = () => { cancelResize(); setLayoutWidth(editor, getPos(), next); };
    const cancel = () => { cancelResize(); draw(); };
    cancelResize = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
  });
  draw(); return { dom, contentDOM, update(next) { if (next.type !== node.type) return false; node = next; draw(); return true; },
    selectNode() { dom.classList.add('ProseMirror-selectednode'); }, deselectNode() { dom.classList.remove('ProseMirror-selectednode'); },
    stopEvent: event => event.target === grip || event.target === resize, ignoreMutation: record => record.type !== 'selection' && (record.target === dom || record.target === grip || record.target === resize), destroy() { cancelDrag?.(); cancelResize?.(); } };
}

export function locateDrop(editor, sourcePos, x, y) {
  const surface = editor.view.dom, bounds = surface.getBoundingClientRect(); if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
  const own = editor.view.nodeDOM(sourcePos)?.getBoundingClientRect(); if (own && x >= own.left && x <= own.right && y >= own.top && y <= own.bottom) return null;
  const source = editor.state.doc.nodeAt(sourcePos), nodes = outline(editor.state.doc);
  const images = nodes.filter(item => item.node.type.name === 'image' && (item.pos < sourcePos || item.pos >= sourcePos + (source?.nodeSize || 1)));
  for (const item of images) {
    const rect = editor.view.nodeDOM(item.pos)?.getBoundingClientRect(); if (!rect || x < rect.left - 8 || x > rect.right + 8 || y < rect.top - 6 || y > rect.bottom + 6) continue;
    const vertical = (y - rect.top) / Math.max(1, rect.height), horizontal = (x - rect.left) / Math.max(1, rect.width);
    const mode = vertical < .23 ? 'column-before' : vertical > .77 ? 'column-after' : horizontal < .5 ? 'row-before' : 'row-after';
    return { pos: item.pos, mode, rect, label: mode.startsWith('row-') ? 'Images side by side' : 'Images stacked vertically' };
  }
  const blocks = nodes.filter(item => item.node.isTextblock && item.node.type.name !== 'codeBlock');
  let closest, distance = Infinity;
  for (const item of blocks) {
    const rect = editor.view.nodeDOM(item.pos)?.getBoundingClientRect(); if (!rect) continue;
    const next = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0; if (next < distance) { distance = next; closest = { ...item, rect }; }
  }
  if (!closest) return null;
  const ratio = (x - bounds.left) / Math.max(1, bounds.width), { rect } = closest;
  const mode = ratio < .28 ? 'wrap-left' : ratio > .72 ? 'wrap-right' : y < rect.top + rect.height / 2 ? 'before' : 'after';
  return { pos: closest.pos, mode, rect, label: mode === 'wrap-left' ? 'Images left · text right' : mode === 'wrap-right' ? 'Images right · text left' : mode === 'before' ? 'Above paragraph' : 'Below paragraph' };
}
export function beginImageDrag(editor, getPos, event) {
  const source = getPos(); if (typeof source !== 'number') return () => {};
  const doc = editor.view.dom.ownerDocument, win = doc.defaultView, startX = event.clientX, startY = event.clientY;
  const original = editor.state.doc;
  let scrollSurface = editor.view.dom.parentElement;
  while (scrollSurface && scrollSurface !== doc.body && !(/auto|scroll/.test(win.getComputedStyle(scrollSurface).overflowY) && scrollSurface.scrollHeight > scrollSurface.clientHeight)) scrollSurface = scrollSurface.parentElement;
  if (!scrollSurface || scrollSurface === doc.body) scrollSurface = doc.scrollingElement;
  let active = false, target, stopped = false;
  const indicator = doc.createElement('div'); indicator.className = 'sds-image-drop-indicator'; indicator.setAttribute('aria-hidden', 'true');
  const hint = doc.createElement('div'); hint.className = 'sds-image-drop-hint'; hint.setAttribute('role', 'status');
  const move = e => {
    if (editor.state.doc !== original) { cleanup(); return; }
    if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
    if (!active) { active = true; doc.body.append(indicator, hint); doc.body.classList.add('sds-image-dragging'); }
    e.preventDefault(); target = locateDrop(editor, source, e.clientX, e.clientY);
    hint.textContent = target?.label || 'Drop inside the article'; hint.style.left = `${Math.min(e.clientX + 14, Math.max(0, win.innerWidth - 200))}px`; hint.style.top = `${Math.max(8, Math.min(e.clientY + 14, win.innerHeight - 40))}px`;
    indicator.hidden = !target;
    if (target) {
      const { rect, mode } = target, edge = mode.startsWith('row-');
      const left = edge ? mode === 'row-before' ? rect.left : rect.right : mode === 'wrap-right' ? rect.right - rect.width * .44 : rect.left;
      const top = edge || mode.startsWith('wrap-') ? rect.top : mode === 'after' || mode === 'column-after' ? rect.bottom : rect.top;
      Object.assign(indicator.style, { left: `${left}px`, top: `${top}px`, width: `${edge ? 4 : mode.startsWith('wrap-') ? rect.width * .44 : rect.width}px`, height: `${edge || mode.startsWith('wrap-') ? Math.max(24, rect.height) : 4}px` });
    }
    const viewport = scrollSurface && scrollSurface !== doc.scrollingElement ? scrollSurface.getBoundingClientRect() : { top: 0, bottom: win.innerHeight };
    if (scrollSurface && e.clientY > viewport.bottom - 50) scrollSurface.scrollTop += 12;
    else if (scrollSurface && e.clientY < viewport.top + 50) scrollSurface.scrollTop -= 12;
  };
  const cleanup = () => { if (stopped) return; stopped = true; doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', finish); doc.removeEventListener('pointercancel', cancel); doc.removeEventListener('keydown', key); win.removeEventListener('blur', cancel); indicator.remove(); hint.remove(); doc.body.classList.remove('sds-image-dragging'); };
  const finish = () => { cleanup(); if (active && target && editor.state.doc === original) dropImage(editor, source, target.pos, target.mode); };
  const cancel = () => cleanup();
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); cleanup(); } };
  doc.addEventListener('pointermove', move, { passive: false }); doc.addEventListener('pointerup', finish); doc.addEventListener('pointercancel', cancel); doc.addEventListener('keydown', key);
  win.addEventListener('blur', cancel);
  return cleanup;
}
