/* Avatar follows the pointer: face moves most, hair less, body stays. */
(() => {
  const svg = document.querySelector('svg.avatar');
  if (!svg) return;
  const $ = (id) => svg.querySelector('#' + id);
  const tail = $('av-tail'), head = $('av-head'), back = $('av-back'), hair = $('av-hair'), face = $('av-face'), eyes = $('av-eyes');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tx = 0, ty = 0, x = 0, y = 0, lastMove = 0;
  const aim = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    const ox = r.left + r.width / 2, oy = r.top + r.height * 0.52;
    tx = Math.max(-1, Math.min(1, (cx - ox) / (innerWidth * 0.45)));
    ty = Math.max(-1, Math.min(1, (cy - oy) / (innerHeight * 0.45)));
    lastMove = performance.now();
  };
  addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });
  const set = (el, dx, dy, extra = '') => el.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})${extra}`);
  const frame = (t) => {
    if (!still && t - lastMove > 3500) { tx = Math.sin(t / 1900) * 0.35; ty = Math.sin(t / 2600) * 0.15; } // idle glance
    x += (tx - x) * 0.09; y += (ty - y) * 0.09;
    set(head, x * 7, y * 5, ` rotate(${(x * 5).toFixed(2)} 206 300)`);
    set(back, -x * 5, -y * 3);
    set(tail, -x * 3, -y * 1.5);
    set(hair, x * 3, y * 2);
    set(face, x * 11, y * 8);
    const blink = (t % 4200) < 130 ? 0.1 : 1;
    eyes.setAttribute('transform', `translate(${(x * 3).toFixed(2)} ${(y * 2 + 221 * (1 - blink)).toFixed(2)}) scale(1 ${blink})`);
    if (!still) requestAnimationFrame(frame);
  };
  if (!still) requestAnimationFrame(frame);
})();
