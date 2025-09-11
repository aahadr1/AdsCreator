type WriteFn = (event: unknown) => void;

export function createSSEStream(): { stream: ReadableStream<Uint8Array>; write: WriteFn; close: () => void } {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      controllerRef = null;
    },
  });

  function write(event: unknown): void {
    if (!controllerRef) return;
    try {
      const line = `data: ${JSON.stringify(event)}\n\n`;
      controllerRef.enqueue(encoder.encode(line));
    } catch {
      // no-op on serialization errors
    }
  }

  function close(): void {
    controllerRef?.close();
  }

  return { stream, write, close };
}

export function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}


