import { processQueuedDocument } from "../services/ingestion-worker.js";

const pending = [];
let active = 0;
const concurrency = 2;

async function drain() {
  while (active < concurrency && pending.length) {
    const task = pending.shift();
    active += 1;
    processQueuedDocument(task).catch((error) => console.error("Ingestion job failed", error)).finally(() => { active -= 1; void drain(); });
  }
}

export function enqueueIngestion(task) {
  pending.push(task);
  void drain();
}

export function queueStats() { return { queued: pending.length, active, concurrency }; }
