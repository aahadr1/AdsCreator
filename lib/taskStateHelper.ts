/**
 * Helper functions to map job statuses to task states
 * Use these in generation pages to update the favicon
 */

import { setTaskState, type TaskState } from './taskStateManager';

type JobStatus = 'running' | 'queued' | 'success' | 'error' | 'failed' | 'complete' | 'idle';

/**
 * Map job status to task state and update favicon
 */
export function updateTaskStateFromJobStatus(status: JobStatus) {
  let taskState: TaskState = 'idle';
  
  if (status === 'running' || status === 'queued') {
    taskState = 'in_progress';
  } else if (status === 'success' || status === 'complete') {
    taskState = 'done';
    // Auto-reset to idle after 3 seconds
    setTimeout(() => setTaskState('idle'), 3000);
  } else if (status === 'error' || status === 'failed') {
    taskState = 'failed';
    // Auto-reset to idle after 3 seconds
    setTimeout(() => setTaskState('idle'), 3000);
  } else {
    taskState = 'idle';
  }
  
  setTaskState(taskState);
}

/**
 * Set task state directly (for manual control)
 */
export function setTaskStateDirect(state: TaskState) {
  setTaskState(state);
}

