'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function EditorPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const editorUrl = useMemo(() => {
    const envUrl = process.env.NEXT_PUBLIC_EDITOR_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return envUrl;
    }
    return 'https://react-video-editor.designcombo.dev';
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (typeof event.data !== 'object' || event.data === null) return;
      const { type } = event.data as { type?: string };
      if (type === 'editor:ready') {
        setIsReady(true);
      }
      // Reserved: handle other messages from the editor for future integrations
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const postToEditor = (message: Record<string, unknown>) => {
    const frame = iframeRef.current;
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(message, '*');
  };

  return (
    <div className="container" style={{ gridTemplateColumns: '1fr', padding: 0 }}>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="header">
          <h2 style={{ margin: 0 }}>Editor</h2>
          <span className="badge">{isReady ? 'Ready' : 'Loading'}</span>
        </div>
        <div className="small">
          Embedded video editor. Configure with <code>NEXT_PUBLIC_EDITOR_URL</code>.
        </div>
      </div>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          title="Embedded Video Editor"
          src={editorUrl}
          style={{ width: '100%', height: 'calc(100vh - 200px)', border: '0' }}
          allow="clipboard-write; clipboard-read; microphone; camera;"
        />
      </div>
      <div className="panel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          className="btn"
          onClick={() => postToEditor({ type: 'host:ping' })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') postToEditor({ type: 'host:ping' }); }}
        >
          Ping Editor
        </button>
        <button
          type="button"
          className="select"
          onClick={() => postToEditor({ type: 'host:requestState' })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') postToEditor({ type: 'host:requestState' }); }}
        >
          Request State
        </button>
      </div>
    </div>
  );
}






