// sensors.js — motion sensors: orientation and shake detection (Session 25).
// Same secure-context-and-permission model as device.js, plus an iOS-only
// wrinkle: Safari requires an explicit requestPermission() call inside a
// click; other browsers grant orientation/motion events implicitly.

export async function requestSensorPermission() {
  if (!("DeviceMotionEvent" in window)) return "not-supported";
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      return await DeviceMotionEvent.requestPermission(); // "granted" | "denied"
    } catch {
      return "denied"; // e.g. NotAllowedError because it wasn't called from a click
    }
  }
  return "not-needed"; // Android/Chromium: permission is implicit
}

// A desktop computer has DeviceOrientationEvent (the object exists) but no
// real sensor: Chromium fires exactly one event with everything null, then
// silence. So "does the API exist?" isn't the right question — wait for an
// actual reading instead, with a cutoff.
export function hasRealReadings(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const onReading = (e) => {
      const a = e.accelerationIncludingGravity;
      if (a && a.x !== null) {
        cleanup();
        resolve(true);
      }
    };
    const cleanup = () => {
      window.removeEventListener("devicemotion", onReading);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    window.addEventListener("devicemotion", onReading);
  });
}

// A real sensor fires dozens of events per second; repainting on every one
// drags the UI down. Throttle to at most 1000/intervalMs readings per
// second, and return an unsubscribe function — an active sensor costs
// battery, so it must be possible to turn it off.
export function listenOrientation(callback, intervalMs = 100) {
  let last = 0;
  const handler = (e) => {
    const now = performance.now();
    if (now - last < intervalMs) return;
    last = now;
    if (e.beta === null) return; // no sensor
    callback({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
  };
  window.addEventListener("deviceorientation", handler);
  return () => window.removeEventListener("deviceorientation", handler);
}

// A shake is a strong, brief acceleration. At rest, the magnitude of
// accelerationIncludingGravity hovers around 9.81; a shake spikes well
// above (or below, while braking) that. So this watches how far the
// magnitude DEVIATES from gravity, not any single axis.
export function detectShake(onShake, { threshold = 12, cooldownMs = 1000 } = {}) {
  const GRAVITY = 9.81;
  let lastShake = 0;
  const handler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    const magnitude = Math.hypot(a.x, a.y, a.z);
    const deviation = Math.abs(magnitude - GRAVITY);
    const now = performance.now();
    if (deviation > threshold && now - lastShake > cooldownMs) {
      lastShake = now;
      onShake(Math.round(deviation * 10) / 10);
    }
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}
