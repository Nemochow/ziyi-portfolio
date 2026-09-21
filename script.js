const navItems = [...document.querySelectorAll("[data-project]")];
const cards = [...document.querySelectorAll("[data-project-card]")];

function setActiveProject(projectId, shouldScroll = true) {
  navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.project === projectId);
  });

  cards.forEach((card) => {
    const isActive = card.dataset.projectCard === projectId;
    card.classList.toggle("is-active", isActive);

    if (isActive && shouldScroll && window.matchMedia("(min-width: 961px)").matches) {
      card.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
}

navItems.forEach((item) => {
  item.addEventListener("click", () => setActiveProject(item.dataset.project));
});

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible) {
      setActiveProject(visible.target.dataset.projectCard, false);
    }
  },
  {
    root: null,
    threshold: [0.35, 0.6, 0.85],
  },
);

cards.forEach((card) => observer.observe(card));

