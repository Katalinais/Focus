// tasks.js — Task Manager logic.
// Built across Sessions 3 to 8 (objects, functions, arrow functions, the DOM
// and events, asynchrony, modules) and typed in Sessions 9 to 14 — see the
// reference version in reference-typescript/tasks.ts.

const STORAGE_KEY = "pwa-elective-tasks";

/**
 * @typedef {"low"|"medium"|"high"} Priority
 * @typedef {{ id: string, title: string, priority: Priority, completed: boolean, createdAt: string }} Task
 */

/** Creates a new task. Session 3 (objects) and Session 4 (default parameters). */
export const createTask = (title, priority = "medium") => ({
  id: crypto.randomUUID(),
  title,
  priority,
  completed: false,
  createdAt: new Date().toISOString(),
});

/** Creates a task's <li> and appends it to the container. Session 6 (DOM and events). */
export const renderTask = (task, container, { onToggle, onDelete }) => {
  const li = document.createElement("li");
  li.className = `task task--${task.priority}` + (task.completed ? " task--completed" : "");
  li.dataset.id = task.id;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = task.completed;
  check.addEventListener("change", () => onToggle(task.id));

  const text = document.createElement("span");
  text.textContent = task.title;

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "btn-delete";
  deleteBtn.addEventListener("click", () => onDelete(task.id));

  li.append(check, text, deleteBtn);
  container.append(li);
};

/** Loads the saved tasks. Session 7 (promises and async/await). */
export const loadTasks = () =>
  new Promise((resolve) => {
    setTimeout(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      resolve(saved ? JSON.parse(saved) : []);
    }, 150); // simulates an async load, as if it came from a server
  });

/** Saves the full array of tasks. */
export const saveTasks = (tasks) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};
