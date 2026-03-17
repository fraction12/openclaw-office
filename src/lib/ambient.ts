/**
 * Ambient feel system — visual and audio atmosphere that
 * responds to office activity level.
 *
 * Visual: CSS custom properties drive background warmth, particle density,
 * and subtle animations. Active offices feel busy; idle offices feel quiet.
 *
 * Audio: Web Audio API for subtle state-change notifications.
 * All audio is opt-in and respects user preference.
 */

// ——— Activity tracking ———

export type ActivityLevel = "quiet" | "normal" | "busy" | "intense";

export function computeActivityLevel(
  totalAgents: number,
  activeAgents: number,
  recentEventCount: number,
): ActivityLevel {
  if (totalAgents === 0) return "quiet";
  const activeRatio = activeAgents / Math.max(totalAgents, 1);
  if (activeRatio > 0.7 || recentEventCount > 20) return "intense";
  if (activeRatio > 0.3 || recentEventCount > 8) return "busy";
  if (activeAgents > 0 || recentEventCount > 2) return "normal";
  return "quiet";
}

/** Apply activity level as CSS custom properties on document root */
export function applyAmbientStyles(level: ActivityLevel): void {
  const root = document.documentElement;
  root.dataset.activityLevel = level;

  const vars: Record<string, string> = {
    "--ambient-pulse-speed": level === "intense" ? "1s" : level === "busy" ? "2s" : level === "normal" ? "4s" : "8s",
    "--ambient-opacity": level === "intense" ? "0.12" : level === "busy" ? "0.08" : level === "normal" ? "0.04" : "0.02",
    "--ambient-glow-size": level === "intense" ? "120px" : level === "busy" ? "80px" : "40px",
  };

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

// ——— Sound design ———

let audioCtx: AudioContext | null = null;
let soundEnabled = false;
let masterVolume = 0.15;
let gestureListenerAttached = false;

/** Attach a one-time listener that resumes AudioContext on first user interaction */
function ensureGestureResume(): void {
  if (gestureListenerAttached || typeof document === "undefined") return;
  gestureListenerAttached = true;
  const resume = () => {
    // Create AudioContext on first user gesture if sound is enabled
    if (soundEnabled && !audioCtx) {
      try { audioCtx = new AudioContext(); } catch { /* unsupported */ }
    }
    if (audioCtx?.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    document.removeEventListener("click", resume);
    document.removeEventListener("touchstart", resume);
    document.removeEventListener("keydown", resume);
  };
  document.addEventListener("click", resume, { once: true });
  document.addEventListener("touchstart", resume, { once: true });
  document.addEventListener("keydown", resume, { once: true });
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (enabled) {
    // Don't eagerly create AudioContext — browsers block it before user gesture.
    // Instead, defer creation to the first actual sound request (getAudioCtx)
    // or let a user-gesture listener resume a suspended context.
    ensureGestureResume();
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
}

function getAudioCtx(): AudioContext | null {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    // Can't play while suspended — browser requires user gesture first.
    // Resume is async; sound will work on next attempt after gesture.
    audioCtx.resume().catch(() => {});
    return null;
  }
  return audioCtx;
}

/** Subtle notification tone — used for state changes */
export function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 1,
): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = masterVolume * volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// Pre-defined sound effects

/** Agent started working — subtle rising tone */
export function playAgentActive(): void {
  playTone(440, 0.15, "sine", 0.6);
  setTimeout(() => playTone(554, 0.12, "sine", 0.4), 80);
}

/** Agent went idle — soft descending tone */
export function playAgentIdle(): void {
  playTone(392, 0.2, "sine", 0.3);
}

/** Error occurred — low warning tone */
export function playError(): void {
  playTone(220, 0.3, "triangle", 0.5);
}

/** Sub-agent spawned — quick chirp */
export function playSubAgentSpawn(): void {
  playTone(660, 0.08, "sine", 0.4);
  setTimeout(() => playTone(880, 0.06, "sine", 0.3), 60);
}

/** Sub-agent completed — soft resolution */
export function playSubAgentComplete(): void {
  playTone(523, 0.15, "sine", 0.3);
}

/** Cron fired — subtle tick */
export function playCronFired(): void {
  playTone(800, 0.05, "square", 0.15);
}

/** Confirmation chirp when user enables sound — proves audio works */
export function playEnableConfirmation(): void {
  // Force-create and resume context since this runs from a click handler
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return; }
  }
  const ctx = audioCtx;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      _playConfirmTones(ctx);
    }).catch(() => {});
  } else {
    _playConfirmTones(ctx);
  }
}

function _playConfirmTones(ctx: AudioContext): void {
  const now = ctx.currentTime;
  // Two gentle ascending notes
  for (const [freq, offset, dur] of [[523, 0, 0.1], [659, 0.08, 0.12]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = masterVolume * 0.5;
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + dur);
  }
}
