// Content remains visible without JavaScript or animation support.
(() => {
  const sections = document.querySelectorAll('[data-reveal]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;

  let observer;
  const showAll = () => {
    sections.forEach(section => section.removeAttribute('data-reveal'));
    if (observer) observer.disconnect();
  };

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
      section.setAttribute('data-reveal', 'pending');
      observer.observe(section);
    });

    motion.addEventListener('change', event => {
      if (event.matches) showAll();
    });
  } catch {
    showAll();
  }
})();
