// tasks.js — Task Manager model and rendering.
// Built across Sessions 3 to 8 (objects, functions, arrow functions, the DOM
// and events, asynchrony, modules) and typed in Sessions 9 to 14 — see the
// reference version in reference-typescript/tasks.ts.
// Storage moved from localStorage to IndexedDB in Session 22 (see db.js);
// tasks can now also carry an AES-GCM encrypted private note (see crypto.js
// and app.js), decrypted on demand through the onRevealNote callback below.

/**
 * @typedef {"low"|"medium"|"high"} Priority
 * @typedef {{
 *   id: string, title: string, priority: Priority, completed: boolean, createdAt: string,
 *   privateNoteCipher: ArrayBuffer|null, privateNoteIv: Uint8Array|null
 * }} Task
 */

/** Creates a new task. Session 3 (objects) and Session 4 (default parameters). */
export const createTask = (title, priority = "medium") => ({
  id: crypto.randomUUID(),
  title,
  priority,
  completed: false,
  createdAt: new Date().toISOString(),
  privateNoteCipher: null,
  privateNoteIv: null,
});

/** Creates a task's <li> and appends it to the container. Session 6 (DOM and events). */
export const renderTask = (task, container, { onToggle, onDelete, onRevealNote }) => {
  const li = document.createElement("li");
  li.className = `task task--${task.priority}` + (task.completed ? " task--completed" : "");
  li.dataset.id = task.id;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = task.completed;
  check.addEventListener("change", () => onToggle(task.id));

  const text = document.createElement("span");
  text.textContent = task.title;

  li.append(check, text);

  if (task.privateNoteCipher) {
    const noteBtn = document.createElement("button");
    noteBtn.type = "button";
    noteBtn.textContent = "🔒 Note";
    noteBtn.className = "btn-note";

    const noteText = document.createElement("span");
    noteText.className = "task-note";
    noteText.hidden = true;

    noteBtn.addEventListener("click", async () => {
      if (!noteText.hidden) {
        noteText.hidden = true;
        return;
      }
      noteBtn.disabled = true;
      try {
        noteText.textContent = await onRevealNote(task.id);
        noteText.classList.remove("task-note--error");
      } catch (err) {
        noteText.textContent = err.message || "Could not decrypt the note.";
        noteText.classList.add("task-note--error");
      }
      noteText.hidden = false;
      noteBtn.disabled = false;
    });

    li.append(noteBtn, noteText);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "btn-delete";
  deleteBtn.addEventListener("click", () => onDelete(task.id));

  li.append(deleteBtn);
  container.append(li);
};
