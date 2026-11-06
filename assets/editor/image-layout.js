import { Node, Extension } from '@tiptap/core';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

export const share = value => Math.max(.001, Math.min(100, Number(value) || 100));
export const ImageRow = Node.create({
  name: 'imageRow', group: 'block', content: 'image*', isolating: true,
  parseHTML() { return [{ tag: 'div[data-news-image-row]' }]; },
  renderHTML() { return ['div', { class: 'news-image-row', 'data-news-image-row': '' }, 0]; }
});

function outline(doc) {
  const result = [];
  const walk = (parent, start, path) => parent.forEach((node, offset, index) => {
    const pos = start + offset, next = [...path, index];
    result.push({ node, pos, path: next });
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
function cleanRows(node) {
  if (!node.content) return;
  node.content.forEach(cleanRows);
  node.content = node.content.flatMap(child => {
    if (child.type !== 'imageRow') return [child];
    if (!child.content.length) return [];
    if (child.content.length === 1) { const image = child.content[0]; image.attrs = { ...image.attrs, widthPercent: 100, alignment: 'center', wrap: false }; return [image]; }
    const total = child.content.reduce((sum, image) => sum + share(image.attrs?.widthPercent), 0);
    child.content.forEach(image => { image.attrs = { ...image.attrs, widthPercent: share(image.attrs?.widthPercent) / total * 100 }; });
    return [child];
  });
}
function remove(doc, target) {
  if (!doc.content) return;
  doc.content = doc.content.filter(node => node !== target); doc.content.forEach(node => remove(node, target));
}

// Preserve each complete node (including text marks and the cover flag) while
// moving pictures between paragraphs and rows. One drop is one undo step.
export function arrangeDocument(original, sourcePath, targetPath, mode) {
  const doc = JSON.parse(JSON.stringify(original)), image = at(doc, sourcePath), target = at(doc, targetPath);
  if (image.type !== 'image' || image === target || !['before', 'after', 'row-before', 'row-after', 'wrap-left', 'wrap-right'].includes(mode)) return null;
  if (mode.startsWith('row-') && target.type !== 'image') return null;
  const originalParent = at(doc, sourcePath.slice(0, -1)), targetParent = at(doc, targetPath.slice(0, -1));
  const originalShares = new Map(originalParent.type === 'imageRow' && originalParent === targetParent ? originalParent.content.map(node => [node, node.attrs?.widthPercent]) : []);
  remove(doc, image); cleanRows(doc);
  let path = findPath(doc, target); if (!path) return null;
  if (mode.startsWith('row-')) {
    const parent = at(doc, path.slice(0, -1)), index = path.at(-1), after = mode === 'row-after' ? 1 : 0;
    image.attrs = { ...image.attrs, wrap: false, alignment: 'center', maxWidth: 0 };
    if (parent.type === 'imageRow') {
      parent.content.splice(index + after, 0, image);
      parent.content.forEach(node => { node.attrs = { ...node.attrs, widthPercent: originalShares.size ? originalShares.get(node) : 100 / parent.content.length }; });
    } else {
      const items = after ? [target, image] : [image, target];
      items.forEach(node => { node.attrs = { ...node.attrs, widthPercent: originalShares.size ? originalShares.get(node) : 50, alignment: 'center', wrap: false, maxWidth: 0 }; });
      parent.content.splice(index, 1, { type: 'imageRow', content: items });
    }
  } else {
    if (at(doc, path.slice(0, -1)).type === 'imageRow') path = path.slice(0, -1);
    const parent = at(doc, path.slice(0, -1)), index = path.at(-1), wrapping = mode.startsWith('wrap-');
    image.attrs = { ...image.attrs, alignment: wrapping ? mode.slice(5) : 'center', wrap: wrapping,
      widthPercent: Math.round(wrapping ? Math.min(55, share(image.attrs?.widthPercent)) : share(image.attrs?.widthPercent)) };
    if (wrapping && target.attrs?.clear) target.attrs = { ...target.attrs, clear: null };
    parent.content.splice(index + (mode === 'after' ? 1 : 0), 0, image);
  }
  cleanRows(doc);
  return { doc, path: findPath(doc, image) };
}
export function dropImage(editor, sourcePos, targetPos, mode) {
  const nodes = outline(editor.state.doc), source = nodes.find(item => item.pos === sourcePos && item.node.type.name === 'image'), target = nodes.find(item => item.pos === targetPos);
  if (!source || !target) return false;
  const result = arrangeDocument(editor.getJSON(), source.path, target.path, mode); if (!result) return false;
  let content;
  try { content = editor.schema.nodeFromJSON(result.doc); content.check(); } catch { return false; }
  const targetNode = outline(content).find(item => JSON.stringify(item.path) === JSON.stringify(result.path));
  if (!targetNode) return false;
  const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, content.content);
  tr.setSelection(NodeSelection.create(tr.doc, targetNode.pos));
  editor.view.dispatch(closeHistory(tr).scrollIntoView());
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
export function setImageWidth(editor, value) {
  const { selection, tr } = editor.state, selected = selection.node;
  if (!selected || selected.type.name !== 'image') return;
  const parent = selection.$from.parent;
  if (parent.type.name !== 'imageRow') { editor.commands.updateAttributes('image', { widthPercent: Math.max(10, Math.min(100, Math.round(Number(value) || 100))) }); return; }
  const width = Math.max(1, Math.min(100 - parent.childCount + 1, Number(value) || 1)), remaining = 100 - width;
  const sum = parent.content.content.filter(node => node !== selected).reduce((total, node) => total + share(node.attrs.widthPercent), 0);
  let pos = selection.$from.start();
  parent.forEach(node => {
    const next = node === selected ? width : remaining * share(node.attrs.widthPercent) / sum;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, widthPercent: next }); pos += node.nodeSize;
  });
  editor.view.dispatch(tr);
}
export function moveImageWithKey(editor, sourcePos, key) {
  const nodes = outline(editor.state.doc), source = nodes.find(item => item.pos === sourcePos && item.node.type.name === 'image');
  if (!source) return false;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const images = nodes.filter(item => item.node.type.name === 'image'), index = images.indexOf(source), target = images[index + (key === 'ArrowLeft' ? -1 : 1)];
    return !!target && dropImage(editor, sourcePos, target.pos, key === 'ArrowLeft' ? 'row-before' : 'row-after');
  }
  const blocks = nodes.filter(item => item.path.length === 1), index = source.path[0], target = blocks[index + (key === 'ArrowUp' ? -1 : 1)];
  return !!target && dropImage(editor, sourcePos, target.pos, key === 'ArrowUp' ? 'before' : 'after');
}

// Removing a picture through Delete/Backspace must not leave an empty row or a
// one-picture group with different layout behavior from a standalone image.
export const NormalizeImageRows = Extension.create({
  name: 'normalizeImageRows',
  addProseMirrorPlugins() { return [new Plugin({ appendTransaction(transactions, oldState, state) {
    if (!transactions.some(tr => tr.docChanged)) return null;
    const tr = state.tr; let changed = false;
    const rows = outline(state.doc).filter(item => item.node.type.name === 'imageRow').reverse();
    for (const { node, pos } of rows) {
      if (node.childCount >= 2) {
        const total = node.content.content.reduce((sum, image) => sum + share(image.attrs.widthPercent), 0);
        if (Math.abs(total - 100) < .001) continue;
        let childPos = pos + 1;
        node.forEach(image => { tr.setNodeMarkup(childPos, undefined, { ...image.attrs, widthPercent: share(image.attrs.widthPercent) / total * 100 }); childPos += image.nodeSize; });
      }
      else if (node.childCount) { const image = node.firstChild; tr.replaceWith(pos, pos + node.nodeSize, image.type.create({ ...image.attrs, widthPercent: 100, alignment: 'center', wrap: false })); }
      else tr.delete(pos, pos + node.nodeSize);
      changed = true;
    }
    return changed ? tr : null;
  } })]; }
});

export function locateDrop(editor, sourcePos, x, y) {
  const surface = editor.view.dom, bounds = surface.getBoundingClientRect();
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
  const own = editor.view.nodeDOM(sourcePos)?.getBoundingClientRect();
  if (own && x >= own.left && x <= own.right && y >= own.top && y <= own.bottom) return null;
  const images = outline(editor.state.doc).filter(item => item.node.type.name === 'image' && item.pos !== sourcePos);
  for (const item of images) {
    const element = editor.view.nodeDOM(item.pos), rect = element?.getBoundingClientRect();
    if (!rect || x < rect.left - 8 || x > rect.right + 8 || y < rect.top - 6 || y > rect.bottom + 6) continue;
    const vertical = (y - rect.top) / Math.max(1, rect.height), horizontal = (x - rect.left) / Math.max(1, rect.width);
    const mode = vertical < .2 ? 'before' : vertical > .8 ? 'after' : horizontal < .5 ? 'row-before' : 'row-after';
    return { pos: item.pos, mode, rect, label: mode.startsWith('row-') ? 'Same image row' : mode === 'before' ? 'Above image' : 'Below image' };
  }
  const blocks = outline(editor.state.doc).filter(item => item.node.isTextblock && item.node.type.name !== 'codeBlock');
  let closest, distance = Infinity;
  for (const item of blocks) {
    const element = editor.view.nodeDOM(item.pos), rect = element?.getBoundingClientRect(); if (!rect) continue;
    const next = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    if (next < distance) { distance = next; closest = { ...item, rect }; }
  }
  if (!closest) return null;
  const ratio = (x - bounds.left) / Math.max(1, bounds.width), { rect } = closest;
  const mode = ratio < .28 ? 'wrap-left' : ratio > .72 ? 'wrap-right' : y < rect.top + rect.height / 2 ? 'before' : 'after';
  return { pos: closest.pos, mode, rect, label: mode === 'wrap-left' ? 'Image left · text right' : mode === 'wrap-right' ? 'Image right · text left' : mode === 'before' ? 'Above paragraph' : 'Below paragraph' };
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
      const top = edge || mode.startsWith('wrap-') ? rect.top : mode === 'after' ? rect.bottom : rect.top;
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
