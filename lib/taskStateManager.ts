/**
 * Global Task State Manager
 * Manages the global task state for favicon updates
 */

export type TaskState = 'in_progress' | 'done' | 'failed' | 'idle';

let currentState: TaskState = 'idle';
let stateListeners: Array<(state: TaskState) => void> = [];

/**
 * Set the global task state
 */
export function setTaskState(state: TaskState) {
  if (currentState !== state) {
    currentState = state;
    
    // Update server-side state via API
    fetch('/api/favicon/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    }).catch(() => {
      // Silently fail if API is not available
    });
    
    // Update favicon immediately
    updateFavicon(state);
    
    // Notify listeners
    stateListeners.forEach(listener => listener(state));
  }
}

/**
 * Get the current task state
 */
export function getTaskState(): TaskState {
  return currentState;
}

/**
 * Subscribe to state changes
 */
export function subscribeToStateChanges(listener: (state: TaskState) => void) {
  stateListeners.push(listener);
  return () => {
    stateListeners = stateListeners.filter(l => l !== listener);
  };
}

/**
 * Update the favicon in the browser
 */
function updateFavicon(state: TaskState) {
  if (typeof window === 'undefined') return;
  
  const faviconUrl = `/api/favicon?t=${Date.now()}`;
  
  // Update all favicon links
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
  links.forEach(link => {
    link.href = faviconUrl;
  });
  
  // If no favicon link exists, create one
  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = faviconUrl;
    document.head.appendChild(link);
  }
}

/**
 * Initialize favicon polling (updates favicon every few seconds to reflect server state)
 */
export function initFaviconPolling() {
  if (typeof window === 'undefined') return;
  
  // Poll every 2 seconds to sync with server state
  setInterval(() => {
    const faviconUrl = `/api/favicon?t=${Date.now()}`;
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
    links.forEach(link => {
      // Force refresh by updating href
      const currentHref = link.href;
      link.href = '';
      link.href = faviconUrl;
    });
  }, 2000);
}

