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

const OLD_LOCALSTORAGE_KEY = "pwa-elective-tasks";

let db;
let tasks = [];
let cachedKey = null;
let cachedPassphrase = null;

const listEl = document.getElementById("task-list");
const formEl = document.getElementById("task-form");
const titleInputEl = document.getElementById("input-title");
const priorityInputEl = document.getElementById("input-priority");
const passphraseInputEl = document.getElementById("input-passphrase");
const noteInputEl = document.getElementById("input-note");
const noteErrorEl = document.getElementById("note-error");
const connectionBannerEl = document.getElementById("connection-banner");
const installBtnEl = document.getElementById("btn-install");

const renderAll = () => {
  listEl.innerHTML = "";
  tasks.forEach((task) =>
    renderTask(task, listEl, {
      onToggle: toggleCompleted,
      onDelete: deleteTaskHandler,
      onRevealNote: revealNote,
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
    const task = { privateNoteCipher: null, privateNoteIv: null, ...oldTask };
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
