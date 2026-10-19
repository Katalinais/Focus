// app.js — entry point: connects tasks.js to the DOM. Session 8 (modules).
import { createTask, renderTask, loadTasks, saveTasks } from "./tasks.js";

let tasks = [];

const listEl = document.getElementById("task-list");
const formEl = document.getElementById("task-form");
const titleInputEl = document.getElementById("input-title");
const priorityInputEl = document.getElementById("input-priority");

const renderAll = () => {
  listEl.innerHTML = "";
  tasks.forEach((task) =>
    renderTask(task, listEl, {
      onToggle: toggleCompleted,
      onDelete: deleteTask,
    })
  );
};

function toggleCompleted(id) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
  saveTasks(tasks);
  renderAll();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
  renderAll();
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInputEl.value.trim();
  if (!title) return;
  tasks.push(createTask(title, priorityInputEl.value));
  saveTasks(tasks);
  renderAll();
  formEl.reset();
});

async function init() {
  tasks = await loadTasks();
  if (tasks.length === 0) {
    tasks = [createTask("Learn Block 3: PWA", "high")];
    saveTasks(tasks);
  }
  renderAll();
}

init();
