'use client';

import '../globals.css';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type Asset = { id: string; type: 'image' | 'video'; storage_path: string; status: string; public_url?: string | null; created_at?: string };
type Label = { asset_id: string; label: string };
type Description = { asset_id: string; description: string };

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [labelQuery, setLabelQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<Array<{ id: string; name: string; status: 'queued' | 'uploading' | 'indexing' | 'ready' | 'error'; url?: string }>>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [{ data: a }, { data: l }, { data: d }] = await Promise.all([
          supabase.from('media_assets').select('id, type, storage_path, status, public_url, created_at').order('created_at', { ascending: false }).limit(60),
          supabase.from('media_labels').select('asset_id, label'),
          supabase.from('media_descriptions').select('asset_id, description'),
        ]);
        setAssets((a as Asset[]) || []);
        setLabels((l as Label[]) || []);
        setDescriptions((d as Description[]) || []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const [labels, setLabels] = useState<Label[]>([]);
  const [descriptions, setDescriptions] = useState<Description[]>([]);
  const labelsByAsset = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const x of labels) {
      const arr = map.get(x.asset_id) || [];
      arr.push(x.label);
      map.set(x.asset_id, arr);
    }
    return map;
  }, [labels]);
  const descByAsset = useMemo(() => {
    const map = new Map<string, string>();
    for (const x of descriptions) if (typeof x.description === 'string') map.set(x.asset_id, x.description);
    return map;
  }, [descriptions]);

  async function handlePickFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    (input as any).multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const batch = files.slice(0, 20);
      setUploading(true);
      try {
        const jobs = batch.map((f) => ({ id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2,7)}`, name: f.name, status: 'queued' as const }));
        setUploadJobs((prev) => [...jobs, ...prev].slice(0, 50));

        await Promise.all(batch.map(async (file, idx) => {
          const jobId = jobs[idx].id;
          const update = (patch: Partial<{ status: 'queued' | 'uploading' | 'indexing' | 'ready' | 'error'; url?: string }>) =>
            setUploadJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, ...patch } : j));
          try {
            update({ status: 'uploading' });
            const form = new FormData();
            form.append('file', file);
            form.append('filename', file.name);
            const res = await fetch('/api/assets/upload', { method: 'POST', body: form });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json() as { id: string; url: string };
            update({ status: 'indexing', url: json.url });
            const addRes = await fetch('/api/ingest/asset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_id: json.id, public_url: json.url }) });
            if (!addRes.ok) throw new Error(await addRes.text());
            update({ status: 'ready' });
          } catch (e: unknown) {
            update({ status: 'error' });
          }
        }));

        // Refresh grid
        const { data } = await supabase.from('media_assets').select('id, type, storage_path, status, public_url, created_at').order('created_at', { ascending: false }).limit(60);
        setAssets((data as Asset[]) || []);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  const filtered = useMemo(() => {
    return assets.filter((a) => (typeFilter === 'all' ? true : a.type === typeFilter));
  }, [assets, typeFilter]);

  return (
    <div className="container" style={{ gridTemplateColumns: '1fr' }}>
      <div className="panel output">
        <div className="header">
          <h2 style={{ margin: 0 }}>Database</h2>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="select" value={typeFilter} onChange={(e)=> setTypeFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="image">Photos</option>
            <option value="video">Videos</option>
          </select>
          <input className="input" placeholder="Filter by label (not wired)" value={labelQuery} onChange={(e)=> setLabelQuery(e.target.value)} />
          <input className="input" placeholder="Search (semantic)" value={searchText} onChange={(e)=> setSearchText(e.target.value)} />
          <button className="btn" type="button" onClick={handlePickFiles} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload to Database (max 20)'}
          </button>
        </div>

        {loading ? <div className="small" style={{ marginTop: 12 }}>Loading…</div> : null}

        {uploadJobs.length > 0 && (
          <div className="panel" style={{ padding: 10, marginTop: 12 }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Bulk upload status</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {uploadJobs.map((j) => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                  <span className="badge">{j.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
          {filtered.map((a) => (
            <div key={a.id} className="panel" style={{ padding: 10, position: 'relative' }}>
              <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>#{a.id.slice(0, 6)}</span>
                <span className="badge">{a.status}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                {a.type === 'image' && a.public_url ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden' }}>
                    <Image src={a.public_url} alt="asset" fill style={{ objectFit: 'cover' }} />
                  </div>
                ) : a.type === 'video' && a.public_url ? (
                  <video src={`/api/proxy?type=video&url=${encodeURIComponent(a.public_url)}`} controls crossOrigin="anonymous" style={{ width: '100%', borderRadius: 8 }} />
                ) : (
                  <div className="small" style={{ padding: 8, opacity: .8 }}>No preview available</div>
                )}
              </div>
              <div className="small" style={{ marginTop: 6 }}>{a.storage_path}</div>
              {descByAsset.get(a.id) && (
                <div className="small" style={{ marginTop: 6, opacity: .9 }}>{descByAsset.get(a.id)}</div>
              )}
              {labelsByAsset.get(a.id) && labelsByAsset.get(a.id)!.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {labelsByAsset.get(a.id)!.slice(0, 8).map((lb) => (
                    <span key={lb} className="badge">{lb}</span>
                  ))}
                </div>
              )}
              <Link
                href={`/library/${a.id}`}
                className="btn"
                aria-label="View more details about this media"
                style={{ position: 'absolute', top: 8, right: 8, padding: '4px 8px' }}
              >
                More
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


