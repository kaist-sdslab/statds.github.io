// Keep normal links and document navigation; animate only local page changes.
(() => {
  const body = document.body;
  const content = document.getElementById('main');
  if (!content) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const home = new URL(body.dataset.homeUrl, window.location.href);
  let leaving = false;
  let animation;
  let timer;

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || motion.matches || !content.animate) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const next = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);
    if (next.origin !== current.origin || !next.pathname.startsWith(home.pathname)) return;
    // Home retains its own reveal effect; anchors and filters stay immediate.
    if (next.pathname === home.pathname || next.pathname === current.pathname) return;
    if (!next.pathname.endsWith('/') && !next.pathname.endsWith('.html')) return;
    if (next.pathname.startsWith(`${home.pathname}admin/`)) return;

    event.preventDefault();
    if (leaving) return;
    leaving = true;
    let navigated = false;
    const navigate = () => {
      if (navigated || !leaving) return;
      navigated = true;
      window.clearTimeout(timer);
      window.location.assign(next.href);
    };
    try {
      animation = content.animate([{ opacity: window.getComputedStyle(content).opacity }, { opacity: 0 }], {
        duration: 160, easing: 'ease-in', fill: 'forwards'
      });
      animation.finished.then(navigate, navigate);
      // A paused animation must never prevent navigation.
      timer = window.setTimeout(navigate, 240);
    } catch {
      navigate();
    }
  });

  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    leaving = false;
    window.clearTimeout(timer);
    if (animation) animation.cancel();
    animation = undefined;
    document.documentElement.classList.remove('page-enter');
    if (body.dataset.isHome !== 'true' && !motion.matches && content.animate) {
      content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    }
  });
})();
