'use client';

import '../globals.css';
import { useEffect, useState } from 'react';

type DatasetItem = any;

export default function SpyToolPage() {
  const [startUrlsText, setStartUrlsText] = useState('https://www.facebook.com/drive4quantix/\nhttps://www.facebook.com/SHEINOFFICIAL/');
  const [resultsLimit, setResultsLimit] = useState<number>(99999);
  const [onlyTotal, setOnlyTotal] = useState<boolean>(false);
  const [isDetailsPerAd, setIsDetailsPerAd] = useState<boolean>(true);
  const [activeStatus, setActiveStatus] = useState<'' | 'active' | 'inactive'>('');
  const [useKeywords, setUseKeywords] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<string>('dress, summer');
  const [country, setCountry] = useState<string>('ALL');

  const [runId, setRunId] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [useBuiltIn, setUseBuiltIn] = useState<boolean>(true);
  const [pageSearchQuery, setPageSearchQuery] = useState<string>('SHEIN');
  const [pages, setPages] = useState<any[]>([]);
  const [pagesLoading, setPagesLoading] = useState<boolean>(false);
  const [pageIdInput, setPageIdInput] = useState<string>('');
  const [adsLoading, setAdsLoading] = useState<boolean>(false);

  function normalizeAdsFromApify(datasetItems: any[]): any[] {
    const out: any[] = [];
    for (const item of datasetItems || []) {
      const results = Array.isArray(item?.results) ? item.results : [];
      for (const r of results) {
        const snapshot = r?.snapshot || {};
        const cards = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
        const firstCard = cards[0] || {};
        const previewImage = firstCard?.resizedImageUrl || firstCard?.originalImageUrl || (Array.isArray(snapshot?.images) && snapshot.images[0]) || '';
        const title = firstCard?.title || snapshot?.title || r?.ad_creative_link_title || '';
        const bodyText = snapshot?.body?.text || r?.ad_creative_body || '';
        const platforms = r?.publisherPlatform || r?.publisher_platform || r?.publisher_platforms || [];
        const pageName = r?.pageName || r?.page_name || item?.pageInfo?.adLibraryPageInfo?.pageInfo?.pageName || '';
        const pageId = r?.pageId || r?.page_id || item?.pageInfo?.adLibraryPageInfo?.pageInfo?.pageId || '';
        const startIso = r?.startDateFormatted || r?.ad_delivery_start_time || '';
        const endIso = r?.endDateFormatted || r?.ad_delivery_stop_time || '';
        const adId = r?.adArchiveId || r?.ad_archive_id || r?.adArchiveID || r?.id || undefined;
        const ctaText = firstCard?.ctaText || snapshot?.ctaText || '';
        const linkUrl = firstCard?.linkUrl || snapshot?.linkUrl || '';

        out.push({
          adId,
          pageName,
          pageId,
          platforms: Array.isArray(platforms) ? platforms : (platforms ? [platforms] : []),
          title,
          bodyText,
          previewImage,
          ctaText,
          linkUrl,
          startIso,
          endIso,
          raw: r,
        });
      }
    }
    return out;
  }

  function normalizeAdsFromPython(list: any[]): any[] {
    const out: any[] = [];
    for (const r of list || []) {
      const snapshot = r?.snapshot || {};
      const cards = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
      const firstCard = cards[0] || {};
      const imgFromCards = firstCard?.resized_image_url || firstCard?.resizedImageUrl || firstCard?.originalImageUrl || firstCard?.original_image_url;
      const imgFromImagesArr = Array.isArray(snapshot?.images) && snapshot.images.length > 0 ? (snapshot.images[0]?.resized_image_url || snapshot.images[0]?.resizedImageUrl || snapshot.images[0]?.originalImageUrl || snapshot.images[0]?.original_image_url) : '';
      const previewImage = imgFromCards || imgFromImagesArr || '';
      const title = firstCard?.title || snapshot?.title || r?.ad_creative_link_title || '';
      const bodyText = (typeof snapshot?.body === 'string') ? snapshot.body : (snapshot?.body?.text || r?.ad_creative_body || '');
      const platforms = r?.publisher_platforms || r?.publisher_platform || [];
      const pageName = r?.page_name || '';
      const pageId = r?.page_id || '';
      const startIso = r?.ad_delivery_start_time || r?.ad_creation_time || '';
      const endIso = r?.ad_delivery_stop_time || '';
      const adId = r?.ad_archive_id || r?.id || undefined;
      const ctaText = firstCard?.cta_text || firstCard?.ctaText || snapshot?.ctaText || '';
      const linkUrl = firstCard?.link_url || firstCard?.linkUrl || snapshot?.linkUrl || '';

      out.push({
        adId,
        pageName,
        pageId,
        platforms: Array.isArray(platforms) ? platforms : (platforms ? [platforms] : []),
        title,
        bodyText,
        previewImage,
        ctaText,
        linkUrl,
        startIso,
        endIso,
        raw: r,
      });
    }
    return out;
  }

  async function fetchResultsNow(dsId: string) {
    try {
      const res2 = await fetch(`/api/spy/scrape/results?datasetId=${encodeURIComponent(dsId)}&limit=1000`);
      if (!res2.ok) throw new Error(await res2.text());
      const data = await res2.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setAds(normalizeAdsFromApify(Array.isArray(data.items) ? data.items : []));
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch results');
    }
  }

  function parseStartUrls(): { url: string; method: 'GET' }[] {
    if (useKeywords) {
      const q = encodeURIComponent(keywords);
      const c = encodeURIComponent(country || 'ALL');
      const url = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${c}&q=${q}&search_type=keyword_unordered&media_type=all&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`;
      return [{ url, method: 'GET' }];
    }
    return startUrlsText
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(url => ({ url, method: 'GET' as const }));
  }

  async function startScrape() {
    setLoading(true);
    setError(null);
    setItems([]);
    setRunId(null);
    setDatasetId(null);
    setStatus(null);
    try {
      const payload = {
        startUrls: parseStartUrls(),
        resultsLimit,
        onlyTotal,
        isDetailsPerAd,
        activeStatus,
      };
      const res = await fetch('/api/spy/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRunId(json.runId || null);
      setDatasetId(json.defaultDatasetId || null);
      setStatus(json.status || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to start scrape');
    } finally {
      setLoading(false);
    }
  }

  async function searchPages() {
    setPagesLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/spy/python/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: pageSearchQuery }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setPages(Array.isArray(json.pages) ? json.pages : []);
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setPagesLoading(false);
    }
  }

  async function fetchAdsByPageId(pid: string) {
    setAdsLoading(true);
    setError(null);
    setAds([]);
    try {
      const res = await fetch('/api/spy/python/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pid }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const list = Array.isArray(json.ads) ? json.ads : [];
      setAds(normalizeAdsFromPython(list));
    } catch (e: any) {
      setError(e?.message || 'Fetch ads failed');
    } finally {
      setAdsLoading(false);
    }
  }

  useEffect(() => {
    let timeout: any;
    async function poll() {
      if (!runId) return;
      try {
        const res = await fetch(`/api/spy/scrape/status?runId=${encodeURIComponent(runId)}`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setStatus(json.status || null);
        if (json.defaultDatasetId) setDatasetId(json.defaultDatasetId);
        const st = json.status;
        if (st === 'SUCCEEDED') {
          if (json.defaultDatasetId) await fetchResultsNow(json.defaultDatasetId);
          return; // stop polling on success
        }
        if (['FAILED','TIMED-OUT','ABORTED'].includes(st)) {
          setError(`Run ${st}. Check Apify run logs.`);
          return; // stop polling on terminal failure
        }
      } catch (e: any) {
        setError(e?.message || 'Polling failed');
      }
      timeout = setTimeout(poll, 3000);
    }
    poll();
    return () => { if (timeout) clearTimeout(timeout); };
  }, [runId]);

  return (
    <div className="container" style={{gridTemplateColumns:'1fr'}}>
      <div className="panel">
        <div className="header">
          <h2 style={{margin:0}}>Facebook Page Ads Scraper</h2>
          <span className="badge">{useBuiltIn ? 'Built-in' : 'Apify'}</span>
        </div>

        <div className="options" style={{marginBottom:12}}>
          <div className="row" style={{gap:16, alignItems:'center', marginBottom:8}}>
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={useBuiltIn} onChange={(e)=>setUseBuiltIn(e.target.checked)} /> Use built-in free scraper
            </label>
          </div>
          {useBuiltIn ? (
            <>
              <div className="row" style={{gap:8}}>
                <div style={{flex:2}}>
                  <div className="small">Search pages by name</div>
                  <input className="input" value={pageSearchQuery} onChange={(e)=>setPageSearchQuery(e.target.value)} placeholder="e.g. SHEIN" />
                </div>
                <div style={{display:'flex', alignItems:'flex-end'}}>
                  <button className="btn" onClick={searchPages} disabled={pagesLoading}>Search Pages</button>
                </div>
              </div>
              {pages.length > 0 && (
                <div className="panel" style={{marginTop:8}}>
                  <div className="small" style={{marginBottom:4}}>Results ({pages.length}) — click to load ads</div>
                  <div style={{display:'grid', gap:6}}>
                    {pages.map((p:any)=> (
                      <button key={p.id} className="select" onClick={()=>{ setPageIdInput(p.id); fetchAdsByPageId(p.id); }}>
                        {p.name} · {p.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="row" style={{gap:8, marginTop:8}}>
                <div style={{flex:1}}>
                  <div className="small">Or enter Page ID</div>
                  <input className="input" value={pageIdInput} onChange={(e)=>setPageIdInput(e.target.value)} placeholder="380039845369159" />
          </div>
                <div style={{display:'flex', alignItems:'flex-end'}}>
                  <button className="btn" onClick={()=>pageIdInput && fetchAdsByPageId(pageIdInput)} disabled={adsLoading || !pageIdInput}>Load Ads</button>
          </div>
          </div>
            </>
          ) : (
            <>
              <div className="row" style={{gap:16, alignItems:'center', marginBottom:8}}>
                <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input type="checkbox" checked={useKeywords} onChange={(e)=>setUseKeywords(e.target.checked)} /> Search by keywords instead of URLs
                </label>
              </div>
              {useKeywords ? (
                <div className="row" style={{gap:8}}>
                  <div style={{flex:2}}>
                    <div className="small">Keywords (comma-separated)</div>
                    <input className="input" value={keywords} onChange={(e)=>setKeywords(e.target.value)} placeholder="e.g. shoes, running" />
                  </div>
                  <div style={{flex:1}}>
                    <div className="small">Country</div>
                    <input className="input" value={country} onChange={(e)=>setCountry(e.target.value.toUpperCase())} placeholder="ALL or ISO code, e.g. US" />
            </div>
          </div>
              ) : (
          <div>
                  <div className="small">Start URLs (one per line or comma-separated)</div>
                  <textarea className="input" style={{minHeight:96}} value={startUrlsText} onChange={(e)=>setStartUrlsText(e.target.value)} placeholder={`https://www.facebook.com/drive4quantix/\nhttps://www.facebook.com/SHEINOFFICIAL/`} />
          </div>
              )}
            <div className="row" style={{gap:8}}>
                <div style={{flex:1}}>
                  <div className="small">Results limit</div>
                  <input className="input" type="number" value={resultsLimit} onChange={(e)=>setResultsLimit(Number(e.target.value) || 0)} />
                </div>
                <div style={{flex:1}}>
                  <div className="small">Active status</div>
                  <select className="select" value={activeStatus} onChange={(e)=>setActiveStatus(e.target.value as any)}>
                    <option value="">Not specified</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
            </div>
          </div>
              <div className="row" style={{gap:16, alignItems:'center'}}>
                <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input type="checkbox" checked={onlyTotal} onChange={(e)=>setOnlyTotal(e.target.checked)} /> onlyTotal
                </label>
                <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input type="checkbox" checked={isDetailsPerAd} onChange={(e)=>setIsDetailsPerAd(e.target.checked)} /> isDetailsPerAd
                </label>
              </div>
            </>
          )}
        </div>

        {!useBuiltIn && (
        <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={startScrape} disabled={loading}>Save & Start</button>
        </div>
        )}

        {error && <div className="small" style={{color:'#ff6b6b', marginTop:8}}>{error}</div>}

        {!useBuiltIn && (
          <>
            <div className="kv" style={{marginTop:12}}>
              <div>Run ID</div><div className="small">{runId || '—'}</div>
              <div>Status</div><div className="small">{status || '—'}</div>
              <div>Dataset ID</div><div className="small">{datasetId || '—'}</div>
            </div>
            {(runId || datasetId) && (
              <div className="row" style={{gap:8, marginTop:8}}>
                {runId && (
                  <a className="btn" href={`https://console.apify.com/actors/runs/${encodeURIComponent(runId)}`} target="_blank" rel="noreferrer">Open run in Apify</a>
                )}
                {datasetId && (
                  <>
                    <a className="select" href={`https://console.apify.com/storage/datasets/${encodeURIComponent(datasetId)}`} target="_blank" rel="noreferrer">Open dataset</a>
                    <button className="select" onClick={()=>fetchResultsNow(datasetId!)}>Refresh results</button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="panel" style={{marginTop:12}}>
        <div className="header">
          <h3 style={{margin:0}}>Results</h3>
          <span className="badge">{ads.length}</span>
        </div>
        {ads.length === 0 ? (
          <div className="small">{(!useBuiltIn && runId) ? (status ? `Waiting for results… (${status})` : 'Starting…') : 'No results yet'}</div>
        ) : (
          <div style={{display:'grid', gap:8}}>
            {ads.map((ad: any, i: number) => (
              <details key={ad.adId || i} className="panel" style={{padding:12}}>
                <summary style={{cursor:'pointer'}}>
                  <div style={{display:'grid', gap:8}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                    <div style={{display:'grid', gap:4}}>
                        <div style={{fontWeight:700}}>{ad.pageName || 'Unknown Page'}</div>
                        <div className="small" style={{opacity:.8}}>{ad.title || '—'}</div>
                      </div>
                      <div style={{display:'flex', gap:8, alignItems:'center'}}>
                        <span className="badge">{(ad.startIso || '').slice(0,10)} → {(ad.endIso || '').slice(0,10) || 'now'}</span>
                      </div>
                    </div>
                    {ad.previewImage && (
                      <div style={{width:'100%', overflow:'hidden', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)'}}>
                        <img src={ad.previewImage} alt={ad.title || 'creative'} style={{display:'block', width:'100%', height:'auto'}} />
                      </div>
                    )}
                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                      {Array.isArray(ad.platforms) && ad.platforms.map((p: string) => (
                        <span key={p} className="badge">{p}</span>
                      ))}
                      {ad.ctaText && <span className="badge">{ad.ctaText}</span>}
                    </div>
                  </div>
                </summary>
                <div style={{marginTop:8}}>
                  <div className="small" style={{marginBottom:4}}>Primary text</div>
                  <pre className="log" style={{whiteSpace:'pre-wrap'}}>{ad.bodyText || '—'}</pre>
                </div>
                <div className="kv" style={{marginTop:8}}>
                  <div>Page</div><div className="small">{ad.pageId} • {ad.pageName}</div>
                  <div>CTA</div><div className="small">{ad.ctaText || '—'}</div>
                  <div>Link</div><div className="small">{ad.linkUrl ? <a href={ad.linkUrl} target="_blank" rel="noreferrer">{ad.linkUrl}</a> : '—'}</div>
                  <div>Ad ID</div><div className="small">{ad.adId || '—'}</div>
                </div>
                <div style={{marginTop:8}}>
                  <div className="small" style={{marginBottom:4}}>All fields</div>
                  <pre className="log" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(ad.raw, null, 2)}</pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


