// app.js — entry point: connects tasks.js, db.js and crypto.js to the DOM.
// Session 8 (modules); storage and encryption wiring added in Session 22.
import { createTask, renderTask } from "./tasks.js";
import {
  openDatabase,
  addTask,
  putTask,
  deleteTask,
  getAllTasks,
  getMeta,
  setMeta,
} from "./db.js";
import { deriveKeyFromPassword, encryptText, decryptText } from "./crypto.js";
import {
  permissionState,
  openCamera,
  stopCamera,
  describeCameraError,
  capturePhoto,
  obtainLocation,
  describeLocationError,
} from "./device.js";
import { requestSensorPermission, hasRealReadings, listenOrientation, detectShake } from "./sensors.js";

const OLD_LOCALSTORAGE_KEY = "pwa-elective-tasks";

let db;
let tasks = [];
let cachedKey = null;
let cachedPassphrase = null;
let photoUrls = []; // object URLs from the last render, revoked before the next one
let lastDeleted = null; // Session 25: backing store for "undo delete"

const listEl = document.getElementById("task-list");
const formEl = document.getElementById("task-form");
const titleInputEl = document.getElementById("input-title");
const priorityInputEl = document.getElementById("input-priority");
const passphraseInputEl = document.getElementById("input-passphrase");
const noteInputEl = document.getElementById("input-note");
const noteErrorEl = document.getElementById("note-error");
const connectionBannerEl = document.getElementById("connection-banner");
const installBtnEl = document.getElementById("btn-install");
const deviceErrorEl = document.getElementById("device-error");
const cameraDialogEl = document.getElementById("camera-dialog");
const cameraVideoEl = document.getElementById("camera-video");
const captureBtnEl = document.getElementById("btn-capture");
const cancelCameraBtnEl = document.getElementById("btn-cancel-camera");
const undoBtnEl = document.getElementById("btn-undo");
const shakeBtnEl = document.getElementById("btn-shake");
const sensorStatusEl = document.getElementById("sensor-status");

const renderAll = () => {
  photoUrls.forEach((url) => URL.revokeObjectURL(url));
  photoUrls = [];
  listEl.innerHTML = "";
  tasks.forEach((task) =>
    renderTask(task, listEl, {
      onToggle: toggleCompleted,
      onDelete: deleteTaskHandler,
      onRevealNote: revealNote,
      onOpenCamera: openCameraForTask,
      onGetLocation: getLocationForTask,
      onPhotoUrlCreated: (url) => photoUrls.push(url),
    })
  );
};

// Derives (or reuses) the AES-GCM key for the passphrase currently typed in.
// The passphrase itself is never saved anywhere — only the salt is, in
// IndexedDB's "meta" store — so the same passphrase must be re-entered in
// every new page session to decrypt existing notes. Session 22.
async function getKey() {
  const passphrase = passphraseInputEl.value;
  if (!passphrase) throw new Error("Enter the encryption passphrase first.");
  if (cachedKey && cachedPassphrase === passphrase) return cachedKey;

  let salt = await getMeta(db, "cryptoSalt");
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
    await setMeta(db, "cryptoSalt", salt);
  }
  cachedKey = await deriveKeyFromPassword(passphrase, salt);
  cachedPassphrase = passphrase;
  return cachedKey;
}

async function toggleCompleted(id) {
  const task = tasks.find((t) => t.id === id);
  task.completed = !task.completed;
  await putTask(db, task);
  renderAll();
}

async function deleteTaskHandler(id) {
  lastDeleted = tasks.find((t) => t.id === id) ?? null;
  undoBtnEl.disabled = !lastDeleted;
  await deleteTask(db, id);
  tasks = tasks.filter((t) => t.id !== id);
  renderAll();
}

function revealNote(id) {
  const task = tasks.find((t) => t.id === id);
  return getKey().then((key) =>
    decryptText(key, { ciphertext: task.privateNoteCipher, iv: task.privateNoteIv })
  );
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = titleInputEl.value.trim();
  if (!title) return;

  const task = createTask(title, priorityInputEl.value);
  const note = noteInputEl.value.trim();
  noteErrorEl.textContent = "";

  if (note) {
    try {
      const key = await getKey();
      const { ciphertext, iv } = await encryptText(key, note);
      task.privateNoteCipher = ciphertext;
      task.privateNoteIv = iv;
    } catch (err) {
      noteErrorEl.textContent = err.message;
      return;
    }
  }

  await addTask(db, task);
  tasks.push(task);
  renderAll();
  formEl.reset();
});

// One-time import from the Session 3-8 localStorage version, so upgrading
// to IndexedDB doesn't silently drop tasks saved before Session 22.
async function migrateFromLocalStorage() {
  const saved = localStorage.getItem(OLD_LOCALSTORAGE_KEY);
  if (!saved) return [];
  const oldTasks = JSON.parse(saved);
  for (const oldTask of oldTasks) {
    const task = {
      privateNoteCipher: null,
      privateNoteIv: null,
      photo: null,
      location: null,
      ...oldTask,
    };
    await addTask(db, task);
  }
  return oldTasks;
}

async function init() {
  db = await openDatabase();
  tasks = await getAllTasks(db);

  if (tasks.length === 0) {
    tasks = await migrateFromLocalStorage();
  }
  if (tasks.length === 0) {
    const seedTask = createTask("Learn Block 3: PWA", "high");
    await addTask(db, seedTask);
    tasks = [seedTask];
  }
  renderAll(); // replaces the loading skeleton markup with the real list
}

init();

// Service Worker registration. Session 17 (registration and lifecycle).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => console.log("SW registered:", reg.scope))
    .catch((err) => console.error("Error registering SW:", err));
}

// Connection indicator — PWA-specific UX (Session 23): the user should know
// whether they're seeing fresh data or a cached offline copy.
function updateConnectionBanner() {
  connectionBannerEl.hidden = navigator.onLine;
}
window.addEventListener("online", updateConnectionBanner);
window.addEventListener("offline", updateConnectionBanner);
updateConnectionBanner();

// Custom install prompt — PWA-specific UX (Session 23). Chrome/Edge fire
// beforeinstallprompt; Safari/iOS never does, so the button simply never
// appears there and offline/manual install is the only option on iOS.
let deferredInstallPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtnEl.hidden = false;
});
installBtnEl.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtnEl.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installBtnEl.hidden = true;
});

// Camera and location attachments (Session 24). Permission is requested
// INSIDE the click that wants it, never on page load — and a denied
// permission never breaks the task, it just shows a message.
let cameraStream = null;
let cameraTaskId = null;

async function openCameraForTask(id) {
  deviceErrorEl.textContent = "";

  // Checking the state first (no prompt shown) avoids a doomed-to-fail
  // getUserMedia call when the user already blocked the camera.
  if ((await permissionState("camera")) === "denied") {
    deviceErrorEl.textContent = describeCameraError({ name: "NotAllowedError" });
    return;
  }

  try {
    cameraStream = await openCamera("environment");
  } catch (err) {
    deviceErrorEl.textContent = describeCameraError(err);
    return;
  }

  cameraTaskId = id;
  cameraVideoEl.srcObject = cameraStream;
  cameraDialogEl.showModal();
}

captureBtnEl.addEventListener("click", async () => {
  const task = tasks.find((t) => t.id === cameraTaskId);
  const photo = await capturePhoto(cameraVideoEl);
  task.photo = photo;
  await putTask(db, task);
  cameraDialogEl.close(); // triggers the "close" listener below, which stops the stream
  renderAll();
});

cancelCameraBtnEl.addEventListener("click", () => cameraDialogEl.close());

// Fires on Cancel AND on Esc — the one place that must stop the stream,
// so closing the dialog never leaves the camera LED on.
cameraDialogEl.addEventListener("close", () => {
  stopCamera(cameraStream);
  cameraStream = null;
  cameraVideoEl.srcObject = null;
  cameraTaskId = null;
});

async function getLocationForTask(id) {
  deviceErrorEl.textContent = "";

  if ((await permissionState("geolocation")) === "denied") {
    deviceErrorEl.textContent = describeLocationError({ code: 1 });
    return;
  }

  try {
    const location = await obtainLocation();
    const task = tasks.find((t) => t.id === id);
    task.location = location;
    await putTask(db, task);
    renderAll();
  } catch (err) {
    deviceErrorEl.textContent = describeLocationError(err);
  }
}

// Undo delete + shake-to-undo (Session 25). Two paths to the same action:
// a button that works on any device, and the shake as an additional
// shortcut — sensors are a progressive enhancement, never the only way.
async function undoDelete() {
  if (!lastDeleted) return;
  // Reinserted as a new record (fresh id) rather than reusing the old one —
  // same approach the guide uses, and it sidesteps any lingering reference
  // to an id IndexedDB no longer has.
  const restored = { ...lastDeleted, id: crypto.randomUUID() };
  await addTask(db, restored);
  tasks.push(restored);
  sensorStatusEl.textContent = `Restored "${restored.title}".`;
  lastDeleted = null;
  undoBtnEl.disabled = true;
  renderAll();
}
undoBtnEl.addEventListener("click", undoDelete);

let sensorsActive = false;
let stopOrientation = null;
let stopShake = null;

shakeBtnEl.addEventListener("click", async () => {
  if (sensorsActive) {
    stopOrientation?.();
    stopShake?.();
    stopOrientation = null;
    stopShake = null;
    sensorsActive = false;
    shakeBtnEl.textContent = "📳 Enable shake to undo";
    shakeBtnEl.classList.remove("is-active");
    sensorStatusEl.textContent = "";
    return;
  }

  // Requested inside this click, as iOS's requestPermission() requires.
  const permission = await requestSensorPermission();
  if (permission === "denied") {
    sensorStatusEl.textContent = "You denied the motion sensor permission. Use the Undo delete button instead.";
    return;
  }

  if (!(await hasRealReadings())) {
    sensorStatusEl.textContent = "This device has no motion sensors. Use the Undo delete button instead.";
    return;
  }

  sensorsActive = true;
  shakeBtnEl.textContent = "📳 Disable shake to undo";
  shakeBtnEl.classList.add("is-active");
  stopOrientation = listenOrientation(({ beta, gamma }) => {
    sensorStatusEl.textContent = `Tilt β ${Math.round(beta)}° · γ ${Math.round(gamma)}°`;
  });
  stopShake = detectShake(() => undoDelete());
});
