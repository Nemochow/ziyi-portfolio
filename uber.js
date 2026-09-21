(() => {
  const showcase = document.querySelector("[data-motion-showcase]");
  if (!showcase) return;

  const frame = showcase.querySelector("[data-motion-frame]");
  const status = showcase.querySelector("[data-motion-status]");
  const toggle = showcase.querySelector("[data-prototype-toggle]");
  const stages = [...showcase.querySelectorAll("[data-motion-stage]")];
  const base = "assets/uber-eats/prototype/index.html";
  let activeStage = "home";
  let activeTitle = "Entry";
  let interactive = false;

  const showStage = (button) => {
    activeStage = button.dataset.motionStage;
    activeTitle = button.dataset.motionTitle;
    interactive = false;
    showcase.classList.remove("is-interactive");
    frame.src = `${base}?stage=${activeStage}#stage=${activeStage}`;
    frame.title = `Food Miner ${activeTitle} animation`;
    status.textContent = `Autoplay · ${activeTitle}`;
    toggle.textContent = "Open interactive mode";

    stages.forEach((stage) => {
      const selected = stage === button;
      stage.classList.toggle("is-active", selected);
      stage.setAttribute("aria-selected", String(selected));
    });
  };

  stages.forEach((stage) => stage.addEventListener("click", () => showStage(stage)));

  toggle.addEventListener("click", () => {
    if (interactive) {
      const selected = stages.find((stage) => stage.dataset.motionStage === activeStage) || stages[0];
      showStage(selected);
      return;
    }

    interactive = true;
    showcase.classList.add("is-interactive");
    frame.src = base;
    frame.title = "Interactive Food Miner prototype";
    status.textContent = "Interactive · Drag and tap";
    toggle.textContent = "Return to motion stages";
  });
})();
