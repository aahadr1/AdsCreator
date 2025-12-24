/**
 * Remote Browser Worker Client
 * 
 * Handles communication with the dedicated Hetzner browser server.
 */

export type BrowserTaskType = 'scrape_website' | 'analyze_competitors';

export type BrowserTaskRequest = {
  task: BrowserTaskType;
  params: Record<string, any>;
  secretKey: string;
};

export async function runRemoteBrowserTask(task: BrowserTaskType, params: Record<string, any>) {
  const workerUrl = process.env.BROWSER_WORKER_URL;
  const secretKey = process.env.BROWSER_WORKER_SECRET;

  if (!workerUrl) {
    throw new Error('BROWSER_WORKER_URL is not configured');
  }

  console.log(`[Remote Browser] Sending ${task} to ${workerUrl}...`);

  const response = await fetch(`${workerUrl}/api/browser/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secretKey}`
    },
    body: JSON.stringify({ task, params }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Remote browser error: ${error}`);
  }

  return await response.json();
}

