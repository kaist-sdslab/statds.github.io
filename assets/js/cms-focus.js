(() => {
  // Decap expands/focuses controls asynchronously and also scrolls their labels.
  // Settle the editor's own scroll container after those updates, never the
  // preview iframe or the outer page.
  const begin = previewDocument => {
    const doc = window.document;
    const previewScroll = previewDocument?.scrollingElement;
    const previewPosition = previewScroll && { top: previewScroll.scrollTop, left: previewScroll.scrollLeft };
    let target = null, frame = null, stopped = false, stable = 0, previous = '', frames = 0;
    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      window.cancelAnimationFrame(frame);
      doc.removeEventListener('focusin', focus);
      for (const surface of [doc, previewDocument].filter(Boolean)) {
        for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) surface.removeEventListener(event, cleanup, true);
      }
    };
    const center = element => {
      const field = element.closest('[aria-label$=" field"]') || element;
      let pane = element.parentElement;
      while (pane && pane !== doc.body) {
        const overflow = window.getComputedStyle(pane).overflowY;
        if (/(auto|scroll)/.test(overflow) && pane.scrollHeight > pane.clientHeight) break;
        pane = pane.parentElement;
      }
      if (!pane || pane === doc.body) return '';
      const bounds = pane.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      const top = Math.max(0, bounds.top);
      const bottom = Math.min(window.innerHeight, bounds.bottom);
      const inset = Math.max(20, (bottom - top - rect.height) / 2);
      const next = Math.max(0, Math.min(pane.scrollHeight - pane.clientHeight, pane.scrollTop + rect.top - top - inset));
      // An instant scroll cancels Decap's outstanding smooth label scroll.
      pane.scrollTo({ top: next, behavior: 'instant' });
      if (previewScroll && previewPosition) {
        previewScroll.scrollTo({ top: previewPosition.top, left: previewPosition.left, behavior: 'instant' });
      }
      return `${element.id}:${Math.round(next)}:${Math.round(rect.height)}:${pane.scrollHeight}`;
    };
    const tick = () => {
      if (stopped) return;
      frames++;
      if (target?.isConnected) {
        const position = center(target);
        stable = position && position === previous ? stable + 1 : 0;
        previous = position;
        if (stable >= 5) { cleanup(); return; }
      }
      if (frames >= 45) { cleanup(); return; }
      frame = window.requestAnimationFrame(tick);
    };
    const focus = event => {
      if (event.target.id && event.target.ownerDocument === doc) {
        target = event.target;
        stable = 0;
      }
    };
    doc.addEventListener('focusin', focus);
    for (const surface of [doc, previewDocument].filter(Boolean)) {
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) surface.addEventListener(event, cleanup, { capture: true, passive: true });
    }
    frame = window.requestAnimationFrame(tick);
    return cleanup;
  };
  window.SDSCMSFocus = { begin };
})();
