(() => {
  const prototype = document.querySelector("[data-foodminer-prototype]");
  const frame = document.querySelector("[data-prototype-frame]");
  const status = document.querySelector("[data-prototype-status]");
  const liveButton = document.querySelector("[data-prototype-live]");
  const stageButtons = [...document.querySelectorAll("[data-prototype-stage]")];

  if (!prototype || !frame || !status || !liveButton || !stageButtons.length) return;

  const base = "assets/uber-eats/prototype/index.html";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = 0;
  let timer = null;
  let isLive = false;

  const stopAutoplay = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };

  const showStage = (index, mode = "Autoplay") => {
    const button = stageButtons[index];
    if (!button) return;

    activeIndex = index;
    isLive = false;
    prototype.classList.remove("is-live");
    const stage = button.dataset.prototypeStage;
    frame.src = stage === "home" ? base : `${base}#stage=${stage}`;
    frame.title = `Food Miner ${button.dataset.prototypeLabel} animation`;
    status.textContent = `${mode} / ${button.dataset.prototypeLabel}`;
    liveButton.textContent = "Try live prototype";

    stageButtons.forEach((item, itemIndex) => {
      const selected = itemIndex === index;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
  };

  const startAutoplay = () => {
    if (reducedMotion || timer || isLive) return;
    timer = window.setInterval(() => showStage((activeIndex + 1) % stageButtons.length), 3600);
  };

  stageButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      stopAutoplay();
      showStage(index, "Preview");
    });
  });

  liveButton.addEventListener("click", () => {
    stopAutoplay();
    if (isLive) {
      showStage(activeIndex, "Preview");
      return;
    }

    isLive = true;
    prototype.classList.add("is-live");
    frame.src = base;
    frame.title = "Interactive Food Miner prototype";
    status.textContent = "Interactive / Drag and tap";
    liveButton.textContent = "Return to stages";
  });

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) startAutoplay();
      else stopAutoplay();
    },
    { threshold: 0.35 },
  );

  observer.observe(prototype);
})();
