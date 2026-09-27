(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.documentElement;
  const c = document.createElement('div');
  c.className = 'vc'; c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<div class="vc-disc"><span class="vc-play"></span></div>';
  document.body.append(c);
  // label colour follows each page's accent
  const cs = getComputedStyle(document.body);
  const accent = (cs.getPropertyValue('--sage') || cs.getPropertyValue('--accent') || getComputedStyle(root).getPropertyValue('--accent')).trim();
  if (accent) c.style.setProperty('--vc-label', accent);
  root.classList.add('vc-on');
  const clickable = 'a, button, [role="button"], .sleeve, label, select, summary';
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    c.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    c.classList.add('is-in');
    const t = e.target instanceof Element ? e.target : null;
    c.classList.toggle('is-link', !!(t && t.closest(clickable)));
    c.classList.toggle('is-text', !!(t && t.closest('input, textarea, [contenteditable]')));
  }, { passive: true });
  addEventListener('pointerdown', () => c.classList.add('is-down'));
  addEventListener('pointerup', () => c.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => c.classList.remove('is-in'));
  addEventListener('blur', () => c.classList.remove('is-in'));
})();
