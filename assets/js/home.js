// Content remains visible without JavaScript or animation support.
(() => {
  const sections = document.querySelectorAll('[data-reveal]');
  const root = document.documentElement;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let observer;
  const showAll = () => {
    root.classList.remove('reveal-enabled', 'reveal-initialized');
    sections.forEach(section => section.removeAttribute('data-reveal'));
    if (observer) observer.disconnect();
  };
  if (motion.matches || !('IntersectionObserver' in window) || !root.classList.contains('reveal-enabled')) {
    showAll();
    return;
  }

  try {
    observer = new IntersectionObserver(entries => {
      let visibleIndex = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty('--reveal-delay', `${Math.min(visibleIndex++, 3) * 90}ms`);
        entry.target.setAttribute('data-reveal', 'visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

    sections.forEach(section => {
      observer.observe(section);
    });
    root.classList.add('reveal-initialized');

    motion.addEventListener('change', event => {
      if (event.matches) showAll();
    });
    // Back/forward restoration must never leave content hidden mid-animation.
    window.addEventListener('pageshow', event => {
      if (event.persisted) showAll();
    });
  } catch {
    showAll();
  }
})();
