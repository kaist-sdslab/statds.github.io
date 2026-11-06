(() => {
  const root = document.querySelector('[data-slideshow]');
  if (!root) return;
  const slides = [...root.querySelectorAll('[data-slide]')];
  if (slides.length < 2) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = root.querySelector('[data-slide-toggle]');
  const dots = [...root.querySelectorAll('[data-slide-to]')];
  let index = 0, paused = motion.matches, hovering = false, timer;
  let animations = [];
  const warmNext = () => { const img = slides[(index + 1) % slides.length].querySelector('img'); if (img) img.loading = 'eager'; };
  const show = next => {
    const previous = index;
    animations.forEach(animation => animation.cancel()); animations = [];
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== index; slide.style.zIndex = i === index ? '1' : '0'; slide.setAttribute('aria-hidden', String(i !== index)); });
    if (previous !== index && !motion.matches && slides[index].animate) {
      const leaving = slides[previous]; leaving.hidden = false;
      const fade = leaving.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'ease-out' });
      fade.onfinish = () => { if (previous !== index) leaving.hidden = true; };
      animations = [fade, slides[index].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' })];
    }
    dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index)));
    warmNext();
  };
  const schedule = () => {
    clearInterval(timer);
    toggle.textContent = paused ? root.dataset.play : root.dataset.pause;
    if (!paused && !hovering && !document.hidden && !root.contains(document.activeElement)) timer = setInterval(() => show(index + 1), Math.max(3, Number(root.dataset.interval) || 5) * 1000);
  };
  root.querySelector('[data-slide-previous]').addEventListener('click', () => { show(index - 1); schedule(); });
  root.querySelector('[data-slide-next]').addEventListener('click', () => { show(index + 1); schedule(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); schedule(); }));
  toggle.addEventListener('click', () => { paused = !paused; schedule(); });
  root.addEventListener('mouseenter', () => { hovering = true; schedule(); });
  root.addEventListener('mouseleave', () => { hovering = false; schedule(); });
  root.addEventListener('focusin', schedule);
  root.addEventListener('focusout', () => setTimeout(schedule, 0));
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { paused = motion.matches; schedule(); });
  window.addEventListener('pagehide', () => clearInterval(timer));
  window.addEventListener('pageshow', schedule);
  root.querySelector('[data-slide-controls]').hidden = false;
  const first = slides[0].querySelector('img');
  if (!first || first.complete) warmNext(); else first.addEventListener('load', warmNext, { once: true });
  schedule();
})();
