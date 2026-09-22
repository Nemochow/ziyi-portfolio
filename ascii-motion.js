const video = document.querySelector("#sourceVideo");
const canvas = document.querySelector("#asciiCanvas");
const stage = document.querySelector("#motionStage");
const canvasContext = canvas.getContext("2d", { alpha: true });
const sampleCanvas = document.createElement("canvas");
const sampleContext = sampleCanvas.getContext("2d", {
  alpha: false,
  willReadFrequently: true,
});
const analysisCanvas = document.createElement("canvas");
const analysisContext = analysisCanvas.getContext("2d", {
  alpha: false,
  willReadFrequently: true,
});

const playToggle = document.querySelector("#playToggle");
const timeline = document.querySelector("#timeline");
const timecode = document.querySelector("#timecode");
const density = document.querySelector("#density");
const densityValue = document.querySelector("#densityValue");
const maskThreshold = document.querySelector("#maskThreshold");
const maskValue = document.querySelector("#maskValue");
const sourceInput = document.querySelector("#sourceInput");
const sourceLabel = document.querySelector("#sourceLabel");
const samplingLabel = document.querySelector("#samplingLabel");
const bufferLabel = document.querySelector("#bufferLabel");
const boundsLabel = document.querySelector("#boundsLabel");
const frameReadout = document.querySelector("#frameReadout");
const runtimeStatus = document.querySelector("#runtimeStatus");
const calibration = document.querySelector("#calibration");
const calibrationProgress = document.querySelector("#calibrationProgress");
const monitorToggle = document.querySelector("#monitorToggle");
const densityButtons = [...document.querySelectorAll("[data-density-value]")];

const TONES = [
  { glyphs: " .", color: [226, 231, 248], alpha: 0.2, size: 0.48, weight: 400 },
  { glyphs: ".:", color: [207, 216, 244], alpha: 0.28, size: 0.54, weight: 400 },
  { glyphs: ":|", color: [183, 197, 235], alpha: 0.38, size: 0.6, weight: 400 },
  { glyphs: "|+", color: [153, 169, 221], alpha: 0.5, size: 0.68, weight: 400 },
  { glyphs: "+=", color: [119, 140, 204], alpha: 0.62, size: 0.76, weight: 400 },
  { glyphs: "=#", color: [87, 111, 182], alpha: 0.74, size: 0.84, weight: 700 },
  { glyphs: "#@", color: [58, 83, 151], alpha: 0.86, size: 0.98, weight: 700 },
  { glyphs: "@#", color: [40, 61, 120], alpha: 0.96, size: 1.14, weight: 700 },
];

const SHADOW_TONE = {
  glyphs: ".,_",
  color: [153, 169, 221],
  alpha: 0.17,
  size: 0.58,
  weight: 400,
};

const state = {
  columns: Number(density.value),
  rows: 32,
  threshold: Number(maskThreshold.value) / 100,
  bounds: null,
  motionModel: null,
  canvasWidth: 0,
  canvasHeight: 0,
  dpr: 1,
  frameNumber: 0,
  frameBuffer: [],
  frameCallback: null,
  fallbackFrame: null,
  lastFallbackTime: -1,
  generation: 0,
  objectUrl: null,
  scrubbing: false,
  hasUserDensity: false,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function quantile(values, amount) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * amount;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function waitFor(target, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let timer;
    const done = () => {
      window.clearTimeout(timer);
      target.removeEventListener(eventName, done);
      resolve();
    };
    timer = window.setTimeout(() => {
      target.removeEventListener(eventName, done);
      reject(new Error(`Timed out while waiting for ${eventName}`));
    }, timeout);
    target.addEventListener(eventName, done, { once: true });
  });
}

function seekTo(time) {
  if (Math.abs(video.currentTime - time) < 0.012 && video.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Video seek timed out"));
    }, 3500);
    const onSeeked = () => {
      window.clearTimeout(timer);
      resolve();
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = clamp(time, 0, Math.max(0, video.duration - 0.04));
  });
}

function pixelMetrics(data, width, height) {
  const count = width * height;
  const lumas = new Float32Array(count);
  const chromas = new Float32Array(count);
  const distances = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    lumas[index] = r * 0.2126 + g * 0.7152 + b * 0.0722;
    chromas[index] = maximum - minimum;
    distances[index] = Math.hypot(1 - r, 1 - g, 1 - b) / Math.sqrt(3);
  }

  const scores = new Float32Array(count);
  const edges = new Float32Array(count);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const horizontal = x ? Math.abs(lumas[index] - lumas[index - 1]) : 0;
      const vertical = y ? Math.abs(lumas[index] - lumas[index - width]) : 0;
      const edge = Math.max(horizontal, vertical);
      const darkness = 1 - lumas[index];
      edges[index] = edge;
      scores[index] =
        darkness * 0.72 +
        chromas[index] * 0.38 +
        distances[index] * 0.42 +
        edge * 0.72;
    }
  }

  return { lumas, chromas, distances, edges, scores };
}

function dilate(mask, width, height, passes = 1) {
  let output = mask;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Uint8Array(output);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (output[index]) continue;
        if (
          output[index - 1] ||
          output[index + 1] ||
          output[index - width] ||
          output[index + width]
        ) {
          next[index] = 1;
        }
      }
    }
    output = next;
  }
  return output;
}

function largestComponentBounds(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  let best = null;
  const queue = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) {
          continue;
        }
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }

    const centerX = (minX + maxX) / 2 / width;
    const centerY = (minY + maxY) / 2 / height;
    const centerBias = 1 - Math.min(0.7, Math.hypot(centerX - 0.5, centerY - 0.5));
    const value = tail * (0.72 + centerBias * 0.28);
    if (!best || value > best.value) {
      best = { minX, minY, maxX, maxY, pixels: tail, value };
    }
  }

  return best;
}

function analyzeCurrentFrame() {
  const width = 144;
  const height = Math.max(36, Math.round(width * (video.videoHeight / video.videoWidth)));
  analysisCanvas.width = width;
  analysisCanvas.height = height;
  analysisContext.fillStyle = "#ffffff";
  analysisContext.fillRect(0, 0, width, height);
  analysisContext.drawImage(video, 0, 0, width, height);

  const image = analysisContext.getImageData(0, 0, width, height);
  const metrics = pixelMetrics(image.data, width, height);
  return {
    width,
    height,
    data: new Uint8ClampedArray(image.data),
    metrics,
  };
}

function buildTemporalModel(frames) {
  const { width, height } = frames[0];
  const count = width * height;
  const minLuma = new Float32Array(count);
  const maxLuma = new Float32Array(count);
  const meanLuma = new Float32Array(count);
  const meanR = new Float32Array(count);
  const meanG = new Float32Array(count);
  const meanB = new Float32Array(count);
  minLuma.fill(1);

  for (const frame of frames) {
    for (let index = 0; index < count; index += 1) {
      const luma = frame.metrics.lumas[index];
      const offset = index * 4;
      minLuma[index] = Math.min(minLuma[index], luma);
      maxLuma[index] = Math.max(maxLuma[index], luma);
      meanLuma[index] += luma / frames.length;
      meanR[index] += frame.data[offset] / 255 / frames.length;
      meanG[index] += frame.data[offset + 1] / 255 / frames.length;
      meanB[index] += frame.data[offset + 2] / 255 / frames.length;
    }
  }

  let backgroundR = 0;
  let backgroundG = 0;
  let backgroundB = 0;
  let backgroundCount = 0;
  const topLimit = Math.max(1, Math.floor(height * 0.16));
  for (let y = 0; y < topLimit; y += 1) {
    for (let x = 0; x < width; x += 2) {
      const index = y * width + x;
      backgroundR += meanR[index];
      backgroundG += meanG[index];
      backgroundB += meanB[index];
      backgroundCount += 1;
    }
  }
  backgroundR /= backgroundCount;
  backgroundG /= backgroundCount;
  backgroundB /= backgroundCount;
  const backgroundLuma =
    backgroundR * 0.2126 + backgroundG * 0.7152 + backgroundB * 0.0722;

  const motion = new Float32Array(count);
  const foreground = new Float32Array(count);
  const subjectMask = new Uint8Array(count);
  const stylusMask = new Uint8Array(count);
  const referenceMetrics = frames[Math.floor(frames.length / 2)].metrics;

  for (let index = 0; index < count; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    const range = maxLuma[index] - minLuma[index];
    const rgbDistance = Math.hypot(
      meanR[index] - backgroundR,
      meanG[index] - backgroundG,
      meanB[index] - backgroundB,
    ) / Math.sqrt(3);
    const relativeDarkness = Math.max(0, backgroundLuma - meanLuma[index]);
    const edge = referenceMetrics.edges[index];
    const motionScore = clamp((range - 0.008) / 0.11, 0, 1);
    const foregroundScore = clamp(
      rgbDistance * 1.28 + relativeDarkness * 0.92 + edge * 0.52,
      0,
      1,
    );
    const lowerScene = y / height > 0.19;
    const edgeStructure = edge > 0.055 && relativeDarkness > 0.035;
    const movingMaterial = motionScore > 0.065 && range > 0.012;
    const recordOrNeedle = foregroundScore > 0.16 && meanLuma[index] < backgroundLuma + 0.04;

    motion[index] = motionScore;
    foreground[index] = foregroundScore;
    subjectMask[index] = lowerScene && (movingMaterial || recordOrNeedle || edgeStructure) ? 1 : 0;
  }

  const connectedMask = dilate(subjectMask, width, height, 2);
  const component = largestComponentBounds(connectedMask, width, height);
  const resolvedMask = new Uint8Array(count);

  if (component) {
    const marginX = Math.round(width * 0.025);
    const marginY = Math.round(height * 0.035);
    const minX = Math.max(0, component.minX - marginX);
    const maxX = Math.min(width - 1, component.maxX + marginX);
    const minY = Math.max(0, component.minY - marginY);
    const maxY = Math.min(height - 1, component.maxY + marginY);
    const componentWidth = component.maxX - component.minX + 1;
    const componentHeight = component.maxY - component.minY + 1;
    const centerX = component.minX + componentWidth * 0.4;
    const centerY = (component.minY + component.maxY) / 2;
    const radiusX = Math.max(1, componentWidth * 0.48);
    const radiusY = Math.max(1, (component.maxY - component.minY) / 2);
    const vinylLike = componentWidth / componentHeight > 1.35;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const index = y * width + x;
        const structural = referenceMetrics.edges[index] > 0.035 && foreground[index] > 0.09;
        const ellipseX = (x - centerX) / (radiusX * 1.03);
        const ellipseY = (y - (centerY + radiusY * 0.08)) / (radiusY * 0.88);
        const insideVinylSilhouette = ellipseX * ellipseX + ellipseY * ellipseY <= 1.08;
        const relativeX = (x - component.minX) / componentWidth;
        const relativeY = (y - component.minY) / componentHeight;
        const darkerThanBackdrop = meanLuma[index] < backgroundLuma - 0.08;
        const cartridge =
          vinylLike &&
          relativeX > 0.6 &&
          relativeY > 0.22 &&
          relativeY < 0.64 &&
          darkerThanBackdrop &&
          (foreground[index] > 0.18 || structural);
        const contactStem =
          vinylLike &&
          relativeX > 0.62 &&
          relativeX < 0.73 &&
          relativeY >= 0.55 &&
          relativeY < 0.88 &&
          darkerThanBackdrop &&
          foreground[index] > 0.14;
        stylusMask[index] = cartridge || contactStem ? 1 : 0;
        resolvedMask[index] = vinylLike
          ? (connectedMask[index] && insideVinylSilhouette) || stylusMask[index]
            ? 1
            : 0
          : connectedMask[index] || structural
            ? 1
            : 0;
      }
    }
  }

  return {
    width,
    height,
    motion,
    foreground,
    edges: referenceMetrics.edges,
    subjectMask: dilate(resolvedMask.some(Boolean) ? resolvedMask : connectedMask, width, height, 1),
    stylusMask: dilate(stylusMask, width, height, 1),
    component,
  };
}

async function calibrateBounds(generation) {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const fractions = duration > 1 ? [0.04, 0.14, 0.27, 0.4, 0.53, 0.66, 0.79, 0.92] : [0];
  const frames = [];

  calibration.classList.add("is-visible");
  calibrationProgress.style.transform = "scaleX(0)";
  boundsLabel.textContent = "Calibrating";

  for (let index = 0; index < fractions.length; index += 1) {
    if (generation !== state.generation) return null;
    const time = duration ? duration * fractions[index] : 0;
    await seekTo(time);
    const frame = analyzeCurrentFrame();
    if (frame) frames.push(frame);
    calibrationProgress.style.transform = `scaleX(${(index + 1) / fractions.length})`;
  }

  if (!frames.length) {
    state.motionModel = null;
    return {
      x: 0,
      y: 0,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  }

  state.motionModel = buildTemporalModel(frames);
  const component = state.motionModel.component;
  if (!component) {
    return {
      x: 0,
      y: video.videoHeight * 0.18,
      width: video.videoWidth,
      height: video.videoHeight * 0.82,
    };
  }

  const scaleX = video.videoWidth / state.motionModel.width;
  const scaleY = video.videoHeight / state.motionModel.height;
  const left = component.minX * scaleX;
  const top = component.minY * scaleY;
  const right = (component.maxX + 1) * scaleX;
  const bottom = (component.maxY + 1) * scaleY;
  const width = Math.max(video.videoWidth * 0.32, right - left);
  const height = Math.max(video.videoHeight * 0.28, bottom - top);
  const paddingX = width * 0.035;
  const paddingY = height * 0.06;

  return {
    x: clamp(left - paddingX, 0, video.videoWidth),
    y: clamp(top - paddingY, 0, video.videoHeight),
    width: clamp(width + paddingX * 2, 1, video.videoWidth - Math.max(0, left - paddingX)),
    height: clamp(height + paddingY * 2, 1, video.videoHeight - Math.max(0, top - paddingY)),
  };
}

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  state.canvasWidth = rect.width;
  state.canvasHeight = rect.height;
  canvas.width = Math.round(rect.width * state.dpr);
  canvas.height = Math.round(rect.height * state.dpr);
  canvasContext.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  if (!state.hasUserDensity && rect.width < 680 && state.columns !== 108) {
    state.columns = 108;
    density.value = "108";
    densityValue.value = "108";
    syncDensityButtons();
    updateRangeProgress(density);
  }
  updateSamplingGrid();
  if (video.readyState >= 2) renderFrame(video.currentTime);
}

function updateSamplingGrid() {
  const aspect = state.canvasWidth > 0 ? state.canvasHeight / state.canvasWidth : 9 / 16;
  state.rows = Math.max(18, Math.round(state.columns * aspect * 0.59));
  sampleCanvas.width = state.columns;
  sampleCanvas.height = state.rows;
  samplingLabel.textContent = `${state.columns} × ${state.rows}`;
}

function renderSourceIntoSample() {
  const width = sampleCanvas.width;
  const height = sampleCanvas.height;
  sampleContext.fillStyle = "#ffffff";
  sampleContext.fillRect(0, 0, width, height);

  if (!state.bounds) {
    sampleContext.drawImage(video, 0, 0, width, height);
    return { scale: width / video.videoWidth, drawX: 0, drawY: 0 };
  }

  const reference = {
    x: width * 0.16,
    y: height * 0.06,
    width: width * 0.68,
    height: height * 0.66,
  };
  const scale = Math.min(
    reference.width / state.bounds.width,
    reference.height / state.bounds.height,
  );
  const subjectCenterX = state.bounds.x + state.bounds.width / 2;
  const subjectCenterY = state.bounds.y + state.bounds.height / 2;
  const targetCenterX = reference.x + reference.width / 2;
  const targetCenterY = reference.y + reference.height / 2;
  const drawX = targetCenterX - subjectCenterX * scale;
  const drawY = targetCenterY - subjectCenterY * scale;

  sampleContext.drawImage(
    video,
    drawX,
    drawY,
    video.videoWidth * scale,
    video.videoHeight * scale,
  );
  return { scale, drawX, drawY };
}

function countNeighbors(mask, index, width, height) {
  const x = index % width;
  const y = Math.floor(index / width);
  let count = 0;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (!offsetX && !offsetY) continue;
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
      count += mask[nextY * width + nextX];
    }
  }
  return count;
}

function buildFrameData(mediaTime) {
  const transform = renderSourceIntoSample();
  const width = sampleCanvas.width;
  const height = sampleCanvas.height;
  const pixels = sampleContext.getImageData(0, 0, width, height);
  const metrics = pixelMetrics(pixels.data, width, height);
  const coreMask = new Uint8Array(width * height);
  const stylusCore = new Uint8Array(width * height);
  const materialStrength = new Float32Array(width * height);
  const model = state.motionModel;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const sourceX = (x + 0.5 - transform.drawX) / transform.scale;
      const sourceY = (y + 0.5 - transform.drawY) / transform.scale;
      if (
        sourceX < 0 ||
        sourceY < 0 ||
        sourceX >= video.videoWidth ||
        sourceY >= video.videoHeight
      ) {
        continue;
      }

      let motion = 0;
      let foreground = 0;
      let structural = 0;
      let learnedSubject = true;
      let learnedStylus = false;
      if (model) {
        const modelX = clamp(Math.floor((sourceX / video.videoWidth) * model.width), 0, model.width - 1);
        const modelY = clamp(Math.floor((sourceY / video.videoHeight) * model.height), 0, model.height - 1);
        const modelIndex = modelY * model.width + modelX;
        motion = model.motion[modelIndex];
        foreground = model.foreground[modelIndex];
        structural = Math.max(model.edges[modelIndex], metrics.edges[index]);
        learnedSubject = Boolean(model.subjectMask[modelIndex]);
        learnedStylus = Boolean(model.stylusMask?.[modelIndex]);
      }

      const movingGroove = motion > 0.045;
      const needleEdge = structural > 0.035 && foreground > 0.085;
      const recordBody = foreground > Math.max(0.12, state.threshold * 0.72);
      const visible = metrics.lumas[index] < 0.975 || metrics.edges[index] > 0.026;
      const semantic = motion * 0.5 + foreground * 0.37 + structural * 0.7;
      materialStrength[index] = clamp(semantic, 0, 1);
      coreMask[index] = learnedSubject && visible && (movingGroove || needleEdge || recordBody) ? 1 : 0;
      if (learnedStylus && visible && (foreground > 0.105 || structural > 0.025)) {
        stylusCore[index] = 1;
        coreMask[index] = 1;
        materialStrength[index] = Math.max(materialStrength[index], 0.82);
      }
    }
  }

  const stylusStructure = dilate(stylusCore, width, height, 1);
  for (let index = 0; index < coreMask.length; index += 1) {
    if (
      stylusStructure[index] &&
      (metrics.lumas[index] < 0.86 || metrics.edges[index] > 0.018)
    ) {
      coreMask[index] = 1;
      materialStrength[index] = Math.max(materialStrength[index], 0.76);
    }
  }

  const nearSubject = dilate(coreMask, width, height, 2);
  const tones = new Uint8Array(width * height);
  const glyphs = new Uint8Array(width * height);
  const strengths = new Uint8Array(width * height);
  tones.fill(255);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const luma = metrics.lumas[index];
      const score = Math.max(metrics.scores[index] * 0.36, materialStrength[index]);
      const neighborCount = countNeighbors(coreMask, index, width, height);
      const internalHighlight =
        !coreMask[index] &&
        nearSubject[index] &&
        neighborCount >= 3 &&
        luma < 0.982 &&
        metrics.edges[index] > 0.014;
      const isShadow =
        !coreMask[index] &&
        nearSubject[index] &&
        y > height * 0.48 &&
        score > state.threshold * 0.32 &&
        luma < 0.92;

      if (!coreMask[index] && !internalHighlight && !isShadow) continue;

      if (isShadow) {
        tones[index] = 8;
        const choice = (x * 17 + y * 29) % SHADOW_TONE.glyphs.length;
        glyphs[index] = SHADOW_TONE.glyphs.charCodeAt(choice);
        strengths[index] = Math.round(clamp(score / state.threshold, 0.42, 0.9) * 255);
        continue;
      }

      const normalizedDarkness = clamp((0.92 - luma) / 0.72, 0, 1);
      const semanticLift = clamp(
        metrics.edges[index] * 0.55 + materialStrength[index] * 0.2,
        0,
        0.2,
      );
      let tone = clamp(Math.floor((normalizedDarkness + semanticLift) * 8), 0, 7);
      if (stylusStructure[index]) tone = Math.max(tone, 6);
      const definition = TONES[tone];
      const choice = (x * 19 + y * 31) % definition.glyphs.length;
      tones[index] = tone;
      glyphs[index] = definition.glyphs.charCodeAt(choice);
      strengths[index] = Math.round(
        clamp((stylusStructure[index] ? 0.82 : 0.5) + score * 0.38, 0.5, 1) * 255,
      );
    }
  }

  return {
    mediaTime,
    columns: width,
    rows: height,
    tones,
    glyphs,
    strengths,
  };
}

function paintFrame(frame) {
  const width = state.canvasWidth;
  const height = state.canvasHeight;
  if (!width || !height) return;
  canvasContext.clearRect(0, 0, width, height);
  canvasContext.textAlign = "center";
  canvasContext.textBaseline = "middle";

  const cellWidth = width / frame.columns;
  const cellHeight = height / frame.rows;
  const layers = [8, 0, 1, 2, 3, 4, 5, 6, 7];

  for (const layer of layers) {
    const definition = layer === 8 ? SHADOW_TONE : TONES[layer];
    const [r, g, b] = definition.color;
    const fontSize = Math.max(6, cellHeight * definition.size);
    canvasContext.font = `${definition.weight} ${fontSize}px "Ubuntu Mono", "Cascadia Mono", Consolas, monospace`;
    canvasContext.fillStyle = `rgb(${r} ${g} ${b})`;

    for (let index = 0; index < frame.tones.length; index += 1) {
      if (frame.tones[index] !== layer) continue;
      const x = index % frame.columns;
      const y = Math.floor(index / frame.columns);
      canvasContext.globalAlpha = definition.alpha * (frame.strengths[index] / 255);
      canvasContext.fillText(
        String.fromCharCode(frame.glyphs[index]),
        (x + 0.5) * cellWidth,
        (y + 0.52) * cellHeight,
      );
    }
  }
  canvasContext.globalAlpha = 1;
}

function renderFrame(mediaTime = video.currentTime) {
  if (video.readyState < 2 || !sampleCanvas.width || !state.canvasWidth) return;
  const frame = buildFrameData(mediaTime);
  paintFrame(frame);
  state.frameBuffer.push(frame);
  if (state.frameBuffer.length > 72) state.frameBuffer.shift();
  state.frameNumber += 1;
  bufferLabel.textContent = String(state.frameBuffer.length);
  frameReadout.textContent = `FRAME ${String(state.frameNumber).padStart(5, "0")}`;
  updateTransport();
}

function cancelFrameLoop() {
  if (state.frameCallback !== null && "cancelVideoFrameCallback" in video) {
    video.cancelVideoFrameCallback(state.frameCallback);
  }
  if (state.fallbackFrame !== null) cancelAnimationFrame(state.fallbackFrame);
  state.frameCallback = null;
  state.fallbackFrame = null;
}

function startFrameLoop() {
  cancelFrameLoop();
  if ("requestVideoFrameCallback" in video) {
    const onFrame = (_now, metadata) => {
      renderFrame(metadata.mediaTime);
      state.frameCallback = video.requestVideoFrameCallback(onFrame);
    };
    state.frameCallback = video.requestVideoFrameCallback(onFrame);
    return;
  }

  const fallback = () => {
    if (video.currentTime !== state.lastFallbackTime) {
      state.lastFallbackTime = video.currentTime;
      renderFrame(video.currentTime);
    }
    state.fallbackFrame = requestAnimationFrame(fallback);
  };
  state.fallbackFrame = requestAnimationFrame(fallback);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function updateRangeProgress(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value);
  const progress = ((value - min) / Math.max(1, max - min)) * 100;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function syncDensityButtons() {
  for (const button of densityButtons) {
    button.classList.toggle(
      "is-active",
      Number(button.dataset.densityValue) === state.columns,
    );
  }
}

function updateTransport() {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!state.scrubbing && duration) {
    timeline.value = String(Math.round((video.currentTime / duration) * 1000));
    updateRangeProgress(timeline);
  }
  timecode.value = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
}

function setRuntime(message, running = false) {
  runtimeStatus.textContent = message;
  runtimeStatus.classList.toggle("is-running", running);
}

function syncPlayButton() {
  const paused = video.paused;
  playToggle.classList.toggle("is-paused", paused);
  playToggle.setAttribute("aria-label", paused ? "Play video" : "Pause video");
  playToggle.textContent = paused ? "PLAY" : "PAUSE";
  if (paused) setRuntime("PAUSED", false);
  else setRuntime("LIVE", true);
}

async function initializeSource(label) {
  const generation = ++state.generation;
  cancelFrameLoop();
  stage.classList.add("is-switching");
  calibration.classList.add("is-visible");
  setRuntime("ANALYZING", false);
  video.pause();
  state.frameBuffer = [];
  state.frameNumber = 0;
  bufferLabel.textContent = "0";
  sourceLabel.textContent = label;

  try {
    state.bounds = await calibrateBounds(generation);
    if (generation !== state.generation || !state.bounds) return;
    boundsLabel.textContent = `${Math.round(state.bounds.width)} × ${Math.round(state.bounds.height)}`;
    await seekTo(0);
    renderFrame(0);
    calibration.classList.remove("is-visible");
    requestAnimationFrame(() => stage.classList.remove("is-switching"));
    startFrameLoop();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      await video.play().catch(() => undefined);
    }
    syncPlayButton();
  } catch (error) {
    calibration.classList.remove("is-visible");
    stage.classList.remove("is-switching");
    setRuntime("SOURCE ERROR", false);
    boundsLabel.textContent = "Unavailable";
    console.error(error);
  }
}

playToggle.addEventListener("click", async () => {
  if (video.paused) await video.play().catch(() => undefined);
  else video.pause();
  syncPlayButton();
});

video.addEventListener("play", syncPlayButton);
video.addEventListener("pause", syncPlayButton);
video.addEventListener("ended", syncPlayButton);
video.addEventListener("error", () => setRuntime("SOURCE ERROR", false));

timeline.addEventListener("pointerdown", () => {
  state.scrubbing = true;
});

timeline.addEventListener("input", () => {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  video.currentTime = (Number(timeline.value) / 1000) * duration;
  updateRangeProgress(timeline);
  updateTransport();
});

timeline.addEventListener("change", () => {
  state.scrubbing = false;
  renderFrame(video.currentTime);
});

density.addEventListener("input", () => {
  state.hasUserDensity = true;
  state.columns = Number(density.value);
  densityValue.value = density.value;
  syncDensityButtons();
  updateRangeProgress(density);
  updateSamplingGrid();
  renderFrame(video.currentTime);
});

for (const button of densityButtons) {
  button.addEventListener("click", () => {
    state.hasUserDensity = true;
    state.columns = Number(button.dataset.densityValue);
    density.value = String(state.columns);
    densityValue.value = String(state.columns);
    syncDensityButtons();
    updateRangeProgress(density);
    updateSamplingGrid();
    renderFrame(video.currentTime);
  });
}

maskThreshold.addEventListener("input", () => {
  state.threshold = Number(maskThreshold.value) / 100;
  maskValue.value = maskThreshold.value;
  updateRangeProgress(maskThreshold);
  renderFrame(video.currentTime);
});

monitorToggle.addEventListener("click", () => {
  const sourceVisible = stage.classList.toggle("is-source-mode");
  monitorToggle.textContent = sourceVisible ? "ASCII" : "SOURCE";
  monitorToggle.setAttribute("aria-pressed", String(sourceVisible));
});

sourceInput.addEventListener("change", async () => {
  const [file] = sourceInput.files;
  if (!file) return;
  if (!file.type.startsWith("video/")) {
    setRuntime("Choose a video file", false);
    return;
  }

  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  video.src = state.objectUrl;
  video.load();
  try {
    await waitFor(video, "loadedmetadata", 8000);
    const cleanName = file.name.replace(/\.[^.]+$/, "");
    await initializeSource(cleanName);
  } catch (error) {
    setRuntime("SOURCE ERROR", false);
    console.error(error);
  }
});

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(stage);

window.addEventListener("beforeunload", () => {
  cancelFrameLoop();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
});

window.asciiMotion = {
  getFrameData() {
    return state.frameBuffer.map((frame) => ({
      mediaTime: frame.mediaTime,
      columns: frame.columns,
      rows: frame.rows,
      tones: frame.tones,
      glyphs: frame.glyphs,
      strengths: frame.strengths,
    }));
  },
  getReferenceBounds() {
    return state.bounds ? { ...state.bounds } : null;
  },
  getToneMap() {
    return TONES.map((tone, index) => ({
      level: index,
      glyphs: tone.glyphs,
      color: `rgb(${tone.color.join(" ")})`,
      alpha: tone.alpha,
      size: tone.size,
    }));
  },
};

for (const input of [timeline, density, maskThreshold]) updateRangeProgress(input);
densityValue.value = density.value;
maskValue.value = maskThreshold.value;
syncDensityButtons();

if (video.readyState >= 1) {
  initializeSource("3116503 · HD");
} else {
  video.addEventListener(
    "loadedmetadata",
    () => initializeSource("3116503 · HD"),
    { once: true },
  );
}
