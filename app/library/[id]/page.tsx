'use client';

import '../../globals.css';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { supabaseClient as supabase } from '../../../lib/supabaseClient';

type Asset = { id: string; type: 'image' | 'video' | 'audio'; storage_path: string; status: string; public_url?: string | null; mime_type?: string | null; created_at?: string };
type Label = { asset_id: string; label: string };
type Description = { asset_id: string; description: string };
type AnalysisRow = { asset_id: string; analysis: Record<string, unknown> };

export default function LibraryDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = String(params?.id || '');

  const [asset, setAsset] = useState<Asset | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [description, setDescription] = useState<string>('');
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/media/details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_id: assetId }) });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (!cancelled) {
          setAsset((json.asset as Asset) || null);
          setLabels((json.labels as Label[]) || []);
          setDescription((json.description as string) || '');
          setAnalysis((json.analysis as Record<string, unknown> | null) || null);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [assetId]);

  async function handleAnalyzeNow() {
    if (!asset) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/ingest/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: asset.id, public_url: asset.public_url }),
      });
      if (!res.ok) throw new Error(await res.text());
      await new Promise((r) => setTimeout(r, 500));
      const ref = await fetch('/api/media/details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_id: asset.id }) });
      if (ref.ok) {
        const json = await ref.json();
        setAnalysis((json.analysis as Record<string, unknown> | null) || null);
        setDescription((json.description as string) || '');
        setLabels((json.labels as Label[]) || []);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  const labelList = useMemo(() => labels.map((l) => l.label), [labels]);

  return (
    <div className="container" style={{ gridTemplateColumns: '1fr' }}>
      <div className="panel output">
        <div className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Media details</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="button" onClick={handleAnalyzeNow} disabled={analyzing} onKeyDown={(e)=> { if ((e.key === 'Enter' || e.key === ' ') && !analyzing) handleAnalyzeNow(); }}>
              {analyzing ? 'Analyzing…' : 'Analyze now'}
            </button>
            <button className="btn" type="button" onClick={() => router.push('/library')} onKeyDown={(e)=> { if (e.key === 'Enter' || e.key === ' ') router.push('/library'); }}>Back to library</button>
          </div>
        </div>

        {loading && <div className="small" style={{ marginTop: 8 }}>Loading…</div>}

        {asset && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, marginTop: 12 }}>
            <div className="panel" style={{ padding: 10 }}>
              {asset.type === 'image' && asset.public_url ? (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden' }}>
                  <Image src={asset.public_url} alt="asset preview" fill style={{ objectFit: 'cover' }} />
                </div>
              ) : asset.type === 'video' && asset.public_url ? (
                <video src={`/api/proxy?type=video&url=${encodeURIComponent(asset.public_url)}`} controls crossOrigin="anonymous" style={{ width: '100%', borderRadius: 8 }} />
              ) : (
                <audio src={asset.public_url || ''} controls style={{ width: '100%' }} />
              )}
              <div className="small" style={{ marginTop: 6, opacity: .9 }}>{asset.storage_path}</div>
              <div className="small" style={{ marginTop: 6 }}><span className="badge">{asset.status}</span></div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {description ? (
                <div className="panel" style={{ padding: 10 }}>
                  <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Description</div>
                  <div className="small">{description}</div>
                </div>
              ) : null}

              {labelList.length > 0 && (
                <div className="panel" style={{ padding: 10 }}>
                  <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Labels</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {labelList.map((lb) => <span key={lb} className="badge">{lb}</span>)}
                  </div>
                </div>
              )}

              <div className="panel" style={{ padding: 10 }}>
                <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Analysis</div>
                {analysis ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {Object.entries(analysis).map(([k, v]) => (
                      <div key={k} className="small" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
                        <div style={{ opacity: .8 }}>{k}</div>
                        <div>
                          {Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : description ? (
                  <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{description}</div>
                ) : (
                  <div className="small" style={{ opacity: .9 }}>No analysis available yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


