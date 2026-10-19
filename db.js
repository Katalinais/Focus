const DB_NAME = "task-manager-db";
const DB_VERSION = 1;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        const tasksStore = db.createObjectStore("tasks", { keyPath: "id" });
        tasksStore.createIndex("byPriority", "priority", { unique: false });
        tasksStore.createIndex("byCompleted", "completed", { unique: false });

        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export function addTask(db, task) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tasks", "readwrite");
    const request = tx.objectStore("tasks").add(task);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function putTask(db, task) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tasks", "readwrite");
    const request = tx.objectStore("tasks").put(task);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function getTask(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tasks", "readonly");
    const request = tx.objectStore("tasks").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function deleteTask(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tasks", "readwrite");
    const request = tx.objectStore("tasks").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function getAllTasks(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tasks", "readonly");
    const request = tx.objectStore("tasks").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Cursor-based query over the "byPriority" index: walks only the matching
// entries instead of loading the whole store into memory first.
export function getTasksByPriority(db, priority) {
  return new Promise((resolve, reject) => {
    const results = [];
    const store = db.transaction("tasks", "readonly").objectStore("tasks");
    const request = store.index("byPriority").openCursor(IDBKeyRange.only(priority));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export function getMeta(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const request = tx.objectStore("meta").get(key);
    request.onsuccess = () => resolve(request.result && request.result.value);
    request.onerror = () => reject(request.error);
  });
}

export function setMeta(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    const request = tx.objectStore("meta").put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  });
}
