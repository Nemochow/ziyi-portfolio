(() => {
  const gallery = document.querySelector("[data-motion-gallery]");
  const rail = gallery?.querySelector("[data-motion-rail]");
  const previous = gallery?.querySelector("[data-motion-previous]");
  const next = gallery?.querySelector("[data-motion-next]");

  if (!gallery || !rail || !previous || !next) return;

  const getStep = () => {
    const card = rail.querySelector(".motion-card");
    if (!card) return rail.clientWidth;
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const updateControls = () => {
    const limit = rail.scrollWidth - rail.clientWidth;
    previous.disabled = rail.scrollLeft <= 2;
    next.disabled = rail.scrollLeft >= limit - 2;
  };

  previous.addEventListener("click", () => rail.scrollBy({ left: -getStep(), behavior: "smooth" }));
  next.addEventListener("click", () => rail.scrollBy({ left: getStep(), behavior: "smooth" }));
  rail.addEventListener("scroll", updateControls, { passive: true });
  window.addEventListener("resize", updateControls);
  updateControls();
})();
