/**
 * Server-side task state store
 * This is a simple in-memory store. For production, consider using Redis or a database.
 */

export type TaskState = 'in_progress' | 'done' | 'failed' | 'idle';

// Global task state (in-memory, can be enhanced with Redis/database)
let globalTaskState: TaskState = 'idle';

export const taskStateStore = {
  setState(state: TaskState) {
    globalTaskState = state;
  },
  getState(): TaskState {
    return globalTaskState;
  },
};

