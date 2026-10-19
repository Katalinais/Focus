// tasks.ts — typed reference version (Sessions 9 to 14: interfaces, literal
// types, generics and strict mode). The app itself runs on tasks.js
// (JavaScript, no build step); this file stands as the Block 2 wrap-up
// as delivered at the end of Session 14.

export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
}

export const createTask = (title: string, priority: Priority = "medium"): Task => ({
  id: crypto.randomUUID(),
  title,
  priority,
  completed: false,
  createdAt: new Date().toISOString(),
});

export const loadTasks = (): Promise<Task[]> =>
  new Promise((resolve) => {
    const saved = localStorage.getItem("pwa-elective-tasks");
    resolve(saved ? (JSON.parse(saved) as Task[]) : []);
  });

export function init(): void {
  loadTasks().then((tasks) => console.log(tasks));
}
