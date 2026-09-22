const hero = document.querySelector(".hero");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const projectVideo = document.querySelector(".project-row__media--ascii video");

let pointerFrame = null;
let videoIsVisible = false;

function resetHeroDrift() {
  if (!hero) return;
  hero.classList.remove("is-tracking");
  hero.style.setProperty("--drift-x", "0px");
  hero.style.setProperty("--drift-y", "0px");
}

function updateHeroDrift(event) {
  if (!hero || motionQuery.matches) return;

  const bounds = hero.getBoundingClientRect();
  const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5;
  const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5;

  if (pointerFrame) cancelAnimationFrame(pointerFrame);

  pointerFrame = requestAnimationFrame(() => {
    hero.classList.add("is-tracking");
    hero.style.setProperty("--drift-x", `${normalizedX * -18}px`);
    hero.style.setProperty("--drift-y", `${normalizedY * -12}px`);
    pointerFrame = null;
  });
}

function syncProjectVideo() {
  if (!projectVideo) return;

  if (videoIsVisible && !document.hidden && !motionQuery.matches) {
    projectVideo.play().catch(() => {});
  } else {
    projectVideo.pause();
  }
}

if (hero && window.matchMedia("(pointer: fine)").matches) {
  hero.addEventListener("pointermove", updateHeroDrift, { passive: true });
  hero.addEventListener("pointerleave", resetHeroDrift);
}

if (projectVideo) {
  const videoObserver = new IntersectionObserver(
    ([entry]) => {
      videoIsVisible = entry.isIntersecting;
      syncProjectVideo();
    },
    { threshold: 0.35 },
  );

  videoObserver.observe(projectVideo);
  document.addEventListener("visibilitychange", syncProjectVideo);
  motionQuery.addEventListener("change", () => {
    resetHeroDrift();
    syncProjectVideo();
  });
}
