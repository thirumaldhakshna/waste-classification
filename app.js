// ============================================================
//  SMART WASTE SCANNER — app.js
//  Uses TensorFlow.js + Teachable Machine to classify waste
//  from the live webcam as Biodegradable or Non-Biodegradable.
// ============================================================

// =====================================================================================
// 🛑 IMPORTANT: YOU MUST CHANGE THE LINK BELOW! 🛑
// The link currently here is your OLD model which only has 2 classes. 
// It DOES NOT know what "Background" is.
// You must click "Export Model" -> "Upload my model" in Teachable Machine, 
// copy the NEW link it gives you, and paste it exactly inside the quotes below!
// =====================================================================================
// const MODEL_URL = "https://teachablemachine.withgoogle.com/models/UVSr7Uv0z/";
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/kDSJorNQH/"

// -------- CONSTANTS --------
const CONFIDENCE_THRESHOLD = 0.80;   // 80 % — below this we say "not sure"
const SMOOTHING_SIZE = 5;      // keep last 5 predictions for smoothing
const REPEAT_COOLDOWN_MS = 6000;   // 6 seconds before repeating the same announcement
const BEEP_FREQUENCY = 880;    // Hz — a short "ding" before the voice
const BEEP_DURATION = 0.12;   // seconds

// -------- COLOURS (must match CSS) --------
const COLOUR_GREEN = "#1E8F4E";   // biodegradable bin
const COLOUR_BLUE = "#1D6FA5";   // non-biodegradable bin

// -------- DOM ELEMENTS --------
const startBtn = document.getElementById("start-btn");
const loadingMsg = document.getElementById("loading-msg");
const webcamWrap = document.getElementById("webcam-wrap");
const verdictPanel = document.getElementById("verdict-panel");
const verdictText = document.getElementById("verdict-text");
const verdictInstr = document.getElementById("verdict-instruction");
const confidenceFill = document.getElementById("confidence-fill");
const confidencePct = document.getElementById("confidence-pct");
const errorBanner = document.getElementById("error-banner");
const errorMsg = document.getElementById("error-msg");
const errorCloseBtn = document.getElementById("error-close-btn");
const muteBtn = document.getElementById("mute-btn");
const iconUnmuted = document.getElementById("icon-unmuted");
const iconMuted = document.getElementById("icon-muted");
const binBodyFill = document.getElementById("bin-body-fill");
const fillRect = document.getElementById("fill-rect");
const countTotalEl = document.getElementById("count-total");
const countBioEl = document.getElementById("count-bio");
const countNonbioEl = document.getElementById("count-nonbio");
const resetBtn = document.getElementById("reset-btn");
const langEnBtn = document.getElementById("lang-en");
const langTaBtn = document.getElementById("lang-ta");
const captureBtn = document.getElementById("capture-btn");
const captureCanvas = document.getElementById("capture-canvas");

// -------- STATE --------
let model = null;    // Teachable Machine model
let videoElement = null; // HTML video element for camera feed
let isMuted = false;   // mute toggle
let lastSpoken = "";      // last class we spoke aloud
let lastSpokeTime = 0;       // timestamp of last speech
let predictionBuffer = [];    // last N raw predictions for smoothing
let isRunning = false;   // is the prediction loop active?
let currentLang = "en";  // "en" or "ta" — selected language
let currentAudio = null; // currently playing HTML5 Audio object

// -------- SCAN COUNTERS (JS variables only, no localStorage) --------
let countTotal = 0;    // total items scanned
let countBio = 0;      // biodegradable items
let countNonbio = 0;   // non-biodegradable items

// -------- BILINGUAL TEXT STRINGS --------
// All UI text and speech messages for English and Tamil
const TEXTS = {
  en: {
    notSureTitle: "NOT SURE",
    notSureSubtitle: "Hold the item steady",
    showItemTitle: "SHOW ME AN ITEM",
    showItemSubtitle: "Point an item at the camera",
    bioTitle: "BIODEGRADABLE",
    bioInstruction: "Put it in the GREEN dustbin",
    bioAudio: "assets/audio/bio-en.mp3",
    nonBioTitle: "NON-BIODEGRADABLE",
    nonBioInstruction: "Put it in the BLUE dustbin",
    nonBioAudio: "assets/audio/non-bio-en.mp3"
  },
  ta: {
    notSureTitle: "உறுதியில்லை",
    notSureSubtitle: "பொருளை நிலையாகப் பிடியுங்கள்",
    showItemTitle: "பொருளைக் காட்டுங்கள்",
    showItemSubtitle: "கேமராவில் பொருளை காட்டுங்கள்",
    bioTitle: "மக்கும் கழிவு",
    bioInstruction: "பச்சைத் தொட்டியில் போடுங்கள்",
    bioAudio: "assets/audio/bio-ta.mp3",
    nonBioTitle: "மக்காத கழிவு",
    nonBioInstruction: "நீலத் தொட்டியில் போடுங்கள்",
    nonBioAudio: "assets/audio/non-bio-ta.mp3"
  }
};

// ============================================================
//  0. FILE-PROTOCOL CHECK
//     (Removed for hosting)
// ============================================================

// ============================================================
//  1. START BUTTON — user gesture required for camera + audio
// ============================================================
startBtn.addEventListener("click", async () => {
  // Hide the start button right away
  startBtn.classList.add("hidden");
  // Show "Loading AI model…"
  loadingMsg.classList.remove("hidden");

  try {
    await loadModelAndStart();
  } catch (err) {
    handleStartupError(err);
  }
});

// ============================================================
//  2. LOAD MODEL, OPEN WEBCAM, BEGIN PREDICTION LOOP
// ============================================================
async function loadModelAndStart() {
  // --- Load the Teachable Machine model ---
  const modelURL = MODEL_URL + "model.json";
  const metadataURL = MODEL_URL + "metadata.json";

  try {
    model = await tmImage.load(modelURL, metadataURL);
  } catch (err) {
    throw new Error("MODEL_LOAD_FAILED");
  }

  // --- Set up the webcam natively to enforce back camera on mobile ---
  videoElement = document.createElement("video");
  videoElement.setAttribute("autoplay", "");
  videoElement.setAttribute("playsinline", ""); // crucial for iOS
  videoElement.style.width = "100%";
  videoElement.style.height = "100%";
  videoElement.style.objectFit = "cover";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }
    });
    videoElement.srcObject = stream;
  } catch (err) {
    throw new Error("CAMERA_FAILED:" + (err.name || ""));
  }

  // Wait for the video to start playing
  await new Promise((resolve) => {
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      resolve();
    };
  });

  // Put the video element into the page
  webcamWrap.appendChild(videoElement);

  // Hide the loading text and show the webcam frame + capture button
  loadingMsg.classList.add("hidden");
  webcamWrap.classList.remove("hidden");
  captureBtn.classList.remove("hidden");

  // Start the continuous prediction loop
  isRunning = true;
  predictionLoop();
}

// ============================================================
//  3. PREDICTION LOOP — runs every animation frame
// ============================================================
async function predictionLoop() {
  if (!isRunning) return;

  // Ask the model to predict what it sees on the video element
  const predictions = await model.predict(videoElement);

  // Find which class has the highest probability
  let topClass = "";
  let topProb = 0;
  for (const p of predictions) {
    if (p.probability > topProb) {
      topProb = p.probability;
      topClass = p.className;
    }
  }

  // ---- Smoothing: keep the last 5 top-class names ----
  predictionBuffer.push(topClass);
  if (predictionBuffer.length > SMOOTHING_SIZE) {
    predictionBuffer.shift();   // remove the oldest one
  }

  // Find which class appears most often in the buffer
  const smoothedClass = getMostFrequent(predictionBuffer);

  // ---- Update the UI based on the smoothed result ----
  updateVerdict(smoothedClass, topProb);

  // Schedule the next frame
  requestAnimationFrame(predictionLoop);
}

// ============================================================
//  4. UPDATE VERDICT — decide what to show and say
// ============================================================
function updateVerdict(className, probability) {
  // Unhide the secondary UI elements once scanning begins
  verdictInstr.classList.remove("hidden");
  document.getElementById("confidence-section")?.classList.remove("hidden");

  // Always update the confidence bar
  const pct = Math.round(probability * 100);
  confidenceFill.style.width = pct + "%";
  confidencePct.textContent = pct + " %";

  // Get the text strings for the currently selected language
  const t = TEXTS[currentLang];

  // ---- Confidence too low? ----
  if (probability < CONFIDENCE_THRESHOLD) {
    setNeutralState(t.notSureTitle, t.notSureSubtitle);
    return;
  }

  // Normalize class name to lowercase to avoid case-sensitivity issues
  const normalizedClass = className.toLowerCase().trim();

  // ---- "Background" class — nothing interesting in front of the camera ----
  if (normalizedClass === "background") {
    setNeutralState(t.showItemTitle, t.showItemSubtitle);
    return;
  }

  // ---- Biodegradable ----
  if (normalizedClass === "biodegradable") {
    setPanelColour("green");
    verdictText.textContent = t.bioTitle;
    verdictInstr.textContent = t.bioInstruction;
    animateBinFill(COLOUR_GREEN, probability);
    speak("Biodegradable");
    return;
  }

  // ---- Non-Biodegradable ----
  if (normalizedClass === "non-biodegradable" || normalizedClass === "non biodegradable") {
    setPanelColour("blue");
    verdictText.textContent = t.nonBioTitle;
    verdictInstr.textContent = t.nonBioInstruction;
    animateBinFill(COLOUR_BLUE, probability);
    speak("Non-Biodegradable");
    return;
  }
}

// ============================================================
//  5. HELPER: set the panel to its default (neutral) look
// ============================================================
function setNeutralState(title, subtitle) {
  verdictText.textContent = title;
  verdictInstr.textContent = subtitle;
  setPanelColour("none");
  animateBinFill("#CCC", 0);  // empty the bin icon
}

// ============================================================
//  6. PANEL COLOUR — add/remove CSS state classes
// ============================================================
function setPanelColour(colour) {
  // Remove both states first
  verdictPanel.classList.remove("state-green", "state-blue");

  if (colour === "green") {
    verdictPanel.classList.add("state-green");
  } else if (colour === "blue") {
    verdictPanel.classList.add("state-blue");
  }
}

// ============================================================
//  7. BIN-FILL ANIMATION — clip-rect grows from bottom
//     The fill height is proportional to the confidence.
// ============================================================
function animateBinFill(colour, probability) {
  // The bin body is 80px tall, starting at y=18
  const maxHeight = 80;
  const fillHeight = maxHeight * probability;
  const yStart = 18 + (maxHeight - fillHeight);

  fillRect.setAttribute("y", yStart);
  fillRect.setAttribute("height", fillHeight);
  binBodyFill.setAttribute("fill", colour);
}

// ============================================================
//  8. SMOOTHING HELPER — find the most frequent string in an array
// ============================================================
function getMostFrequent(arr) {
  const counts = {};
  let maxCount = 0;
  let maxItem = arr[0];

  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      maxItem = item;
    }
  }

  return maxItem;
}

// ============================================================
//  9. SPEECH — HTML5 Audio + beep notification
// ============================================================
function speak(classLabel) {
  // If muted, don't speak at all
  if (isMuted) return;

  const now = Date.now();

  // Anti-repeat rule:
  //   Only speak if the class changed, OR if 6 seconds passed since the last time.
  if (classLabel === lastSpoken && (now - lastSpokeTime) < REPEAT_COOLDOWN_MS) {
    return;  // too soon — stay quiet
  }

  // Cancel any ongoing audio so it doesn't overlap
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  // Pick the audio file based on language and class
  const t = TEXTS[currentLang];
  const audioFile = (classLabel === "Biodegradable") ? t.bioAudio : t.nonBioAudio;

  // Play a short beep first, then play the audio
  playBeep(() => {
    currentAudio = new Audio(audioFile);
    currentAudio.play().catch(err => {
      console.warn("Audio playback failed:", err);
    });
  });

  // Remember what we just spoke and when
  lastSpoken = classLabel;
  lastSpokeTime = now;

  // ---- Update scan counters (once per new detection, not per frame) ----
  countTotal++;
  if (classLabel === "Biodegradable") countBio++;
  if (classLabel === "Non-Biodegradable") countNonbio++;
  updateCounterDisplay();
}

// ============================================================
//  10. BEEP — 880 Hz oscillator using Web Audio API
// ============================================================
function playBeep(onEnd) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = BEEP_FREQUENCY;
    gain.gain.value = 0.3;            // not too loud

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + BEEP_DURATION);

    // When the beep finishes, call onEnd (which triggers the voice)
    osc.onended = () => {
      ctx.close();
      if (onEnd) onEnd();
    };
  } catch (e) {
    // If Web Audio is not available, just speak without the beep
    if (onEnd) onEnd();
  }
}

// ============================================================
//  11. MUTE / UNMUTE TOGGLE
// ============================================================
muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;

  // Swap the SVG icons
  iconUnmuted.classList.toggle("hidden", isMuted);
  iconMuted.classList.toggle("hidden", !isMuted);

  // Update the button's accessible label
  muteBtn.setAttribute("aria-label", isMuted ? "Unmute audio" : "Mute audio");

  // If we just muted, cancel any speech in progress
  if (isMuted && currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
});

// ============================================================
//  12. LANGUAGE TOGGLE — switch between English and Tamil
// ============================================================

langEnBtn.addEventListener("click", () => {
  setLanguage("en");
});
langTaBtn.addEventListener("click", () => {
  setLanguage("ta");
});

function setLanguage(lang) {
  if (currentLang === lang) return;
  currentLang = lang;

  // Update button active states
  langEnBtn.classList.toggle("lang-btn--active", lang === "en");
  langTaBtn.classList.toggle("lang-btn--active", lang === "ta");
  langEnBtn.setAttribute("aria-pressed", lang === "en");
  langTaBtn.setAttribute("aria-pressed", lang === "ta");

  // Reset the last-spoken tracker so the new language speaks immediately
  lastSpoken = "";
}

// ============================================================
//  13. ERROR HANDLING
// ============================================================

// Show a yellow banner at the top of the page
function showError(msg) {
  errorMsg.textContent = msg;
  errorBanner.classList.remove("hidden");
}

errorCloseBtn.addEventListener("click", () => {
  errorBanner.classList.add("hidden");
});

// Decide which friendly message to show based on what went wrong
function handleStartupError(err) {
  loadingMsg.classList.add("hidden");
  startBtn.classList.remove("hidden");  // let them try again

  const errStr = err.message || String(err);

  if (errStr === "MODEL_LOAD_FAILED") {
    showError(
      "❌ Could not load the AI model. Please check that MODEL_URL in app.js " +
      "is correct and that you have an internet connection."
    );
    return;
  }

  if (errStr.includes("CAMERA_FAILED")) {
    // Try to figure out the specific camera problem
    if (errStr.includes("NotAllowedError") || errStr.includes("PermissionDenied")) {
      showError(
        "📷 Camera permission was denied. Please allow camera access in your " +
        "browser settings and refresh the page."
      );
    } else if (errStr.includes("NotFoundError")) {
      showError(
        "📷 No camera was found. Please connect a webcam and refresh the page."
      );
    } else if (errStr.includes("NotReadableError") || errStr.includes("TrackStartError")) {
      showError(
        "📷 The camera is busy. Please close Zoom, Teams, or the Camera app, " +
        "then refresh the page."
      );
    } else {
      showError(
        "📷 Could not access the camera. Error: " + errStr.replace("CAMERA_FAILED:", "")
      );
    }
    return;
  }

  // Generic fallback
  showError("Something went wrong: " + errStr);
}

// ============================================================
//  13. SCAN COUNTERS — update the display and handle reset
// ============================================================

// Push current counter values into the DOM
function updateCounterDisplay() {
  countTotalEl.textContent = countTotal;
  countBioEl.textContent = countBio;
  countNonbioEl.textContent = countNonbio;
}

// Reset button — sets all counters back to zero
resetBtn.addEventListener("click", () => {
  countTotal = 0;
  countBio = 0;
  countNonbio = 0;
  updateCounterDisplay();
});

// ============================================================
//  15. CAPTURE RESULT — screenshot webcam + verdict as PNG
// ============================================================
captureBtn.addEventListener("click", () => {
  if (!videoElement) return;  // camera not running yet

  // --- Set up the offscreen canvas ---
  const srcW = videoElement.videoWidth;   // webcam frame width
  const srcH = videoElement.videoHeight;  // webcam frame height
  const bannerH = 80;                 // height of the verdict text bar at the bottom
  const totalW = srcW;
  const totalH = srcH + bannerH;

  captureCanvas.width = totalW;
  captureCanvas.height = totalH;
  const ctx = captureCanvas.getContext("2d");

  // --- Draw the current webcam frame ---
  ctx.drawImage(videoElement, 0, 0, srcW, srcH);

  // --- Draw the verdict banner at the bottom ---
  // Pick the banner colour based on the current panel state
  let bannerColour = "#111310";  // default ink-black
  if (verdictPanel.classList.contains("state-green")) bannerColour = COLOUR_GREEN;
  if (verdictPanel.classList.contains("state-blue")) bannerColour = COLOUR_BLUE;

  ctx.fillStyle = bannerColour;
  ctx.fillRect(0, srcH, totalW, bannerH);

  // --- Draw the verdict text on the banner ---
  const verdictStr = verdictText.textContent || "";
  const instrStr = verdictInstr.textContent || "";

  ctx.fillStyle = "#FAFAF7";
  ctx.textAlign = "center";

  // Big verdict word
  ctx.font = "bold 28px 'Barlow Condensed', sans-serif";
  ctx.fillText(verdictStr, totalW / 2, srcH + 32);

  // Smaller instruction line
  ctx.font = "500 16px 'Inter', sans-serif";
  ctx.fillText(instrStr, totalW / 2, srcH + 58);

  // --- Trigger download ---
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  link.download = "waste-scan-" + timestamp + ".png";
  link.href = captureCanvas.toDataURL("image/png");
  link.click();
});
