const chapters = [...document.querySelectorAll(".chapter-nav a")];
const sections = chapters.map((link) => document.querySelector(link.getAttribute("href")));

const chapterObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    chapters.forEach((link) => {
      const current = link.getAttribute("href") === `#${visible.target.id}`;
      link.classList.toggle("is-current", current);
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  },
  { threshold: [0.2, 0.4, 0.6], rootMargin: "-10% 0px -35% 0px" },
);

sections.forEach((section) => chapterObserver.observe(section));

document.querySelectorAll(".pixel-matrix[data-pixels]").forEach((matrix) => {
  const cells = matrix.dataset.pixels.replaceAll("/", "");
  if (!/^[01]{64}$/.test(cells)) return;

  const fragment = document.createDocumentFragment();
  for (const cell of cells) {
    const pixel = document.createElement("span");
    if (cell === "1") pixel.classList.add("is-lit");
    pixel.setAttribute("aria-hidden", "true");
    fragment.append(pixel);
  }
  matrix.append(fragment);

  const next = matrix.dataset.next?.replaceAll("/", "");
  if (!next || !/^[01]{64}$/.test(next)) return;

  let visible = false;
  let showingNext = false;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(matrix);

  window.setInterval(() => {
    if (!visible || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    showingNext = !showingNext;
    [...matrix.children].forEach((pixel, index) => {
      pixel.classList.toggle("is-lit", (showingNext ? next : cells)[index] === "1");
    });
  }, 850);
});
