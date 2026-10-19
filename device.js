// device.js — camera, microphone and geolocation (Session 24).
// Every device API here follows the same three-part permission model:
// secure context (HTTPS or localhost), user permission, and a request made
// inside a user gesture (a click), never on page load.

// Reads a permission's state WITHOUT prompting the user. Useful to adapt
// the UI (e.g. explain how to unblock a camera already set to "denied")
// before the user clicks anything. Not every browser supports every
// permission name, so this is wrapped in try/catch.
export async function permissionState(name) {
  try {
    const result = await navigator.permissions.query({ name });
    return result.state; // "granted" | "denied" | "prompt"
  } catch {
    return "unknown"; // the browser doesn't support this permission name
  }
}

export function openCamera(facingMode = "environment") {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode }, // "user" = front, "environment" = back
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
}

// Stops EVERY track. Skipping this leaves the camera LED on and blocks
// other applications from using it.
export function stopCamera(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function describeCameraError(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "You blocked the camera permission. Enable it from the padlock in the address bar.";
    case "NotFoundError":
      return "This device has no camera available.";
    case "NotReadableError":
      return "The camera is being used by another application.";
    case "OverconstrainedError":
      return "The camera doesn't support the requested configuration.";
    case "TypeError":
      return "The camera only works over HTTPS or on localhost.";
    default:
      return `Could not open the camera (${err?.name ?? "unknown error"}).`;
  }
}

// A <video> can't be "saved" as-is. Draw the current frame onto a <canvas>
// and export it as a Blob — an IndexedDB-friendly binary object. Downscaled
// to a max width: a phone photo can be several MB, and that's wasteful for
// a thumbnail.
export function capturePhoto(video, maxWidth = 640) {
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
}

export function openMicrophone() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
}

// Doesn't record anything — just exposes the live input volume, via a Web
// Audio AnalyserNode, so the user can see the microphone is actually working.
export function createLevelMeter(stream) {
  const ctx = new AudioContext();
  ctx.resume(); // call this inside a click (autoplay policy)
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  return {
    read() {
      // 0 = silence, 1 = max
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      return peak / 128;
    },
    close() {
      stream.getTracks().forEach((track) => track.stop());
      ctx.close();
    },
  };
}

export function obtainLocation({ highAccuracy = false, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject({ code: 0, message: "Geolocation not available" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: new Date(pos.timestamp).toISOString(),
        }),
      reject,
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

export function describeLocationError(err) {
  switch (err?.code) {
    case 1:
      return "You denied the location permission. The task still works without it.";
    case 2:
      return "Couldn't determine the position (no GPS or network signal).";
    case 3:
      return "Location took too long to respond. Try again.";
    default:
      return "Location isn't available in this browser.";
  }
}
