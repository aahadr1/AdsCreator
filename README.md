## App icons / favicon

Place your app icons in the `app/` directory so Next.js will automatically serve them:

- `app/icon.png` — primary app icon (used for favicon and PWA). Recommended square PNG, at least 512x512.
- `app/apple-icon.png` — Apple touch icon (180x180).
- `public/favicon.ico` (optional) — multi-size ICO for legacy browsers.

This project is configured in `app/layout.tsx` to advertise these icons to all browsers.

## Environment variables

Set the following in your environment (e.g., `.env.local` for Next.js):

```
REPLICATE_API_TOKEN=your_replicate_token
ELEVENLABS_API_KEY=your_elevenlabs_key
META_ADS_ACCESS_TOKEN=your_meta_graph_access_token
```

You can get tokens from Replicate, ElevenLabs, and Meta (Graph API). Restart the dev server after adding them.

# Next Lipsync App (Sieve + Next.js + Vercel Blob)

Upload a **video** and a **voiceover**, then get back a **lip‑synced** video using Sieve's `sieve/lipsync` API.

## Quickstart

1. **Install deps**
   ```bash
   npm i
   ```

2. **Create `.env.local`** from `.env.example` and set:
   - `SIEVE_API_KEY` – your Sieve key (Dashboard → Settings).
   - `BLOB_READ_WRITE_TOKEN` – create a Vercel Blob store and pull the token (or paste it manually).
     - Docs: Vercel Blob client uploads and tokens. 

3. **Run dev**
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`:
   - Right column → drag **video** + **audio** (or click to select).
   - Click **Lipsync it**.
   - The main area shows job status and renders the result when finished.

## Notes

- Files are uploaded to **Vercel Blob** (public URLs), then sent to Sieve.
- We **never expose** your Sieve key to the browser. Push/status are proxied via Next API routes.
- You can adjust Sieve options (backend, enhance, cut_by, etc.) in the UI.

## Deploy

Deploy to Vercel, connect a Blob store, and add the two env vars to Production as well.

## References

- Sieve Push & Jobs API (push jobs, poll status)  
- Sieve Lipsync guide & schema (inputs/outputs, options)  
- Vercel Blob client uploads (direct browser → Blob with token)  

# AdsCreator
# ads-creatorv2

## Auto Edit (beta)

- Page: `/auto-edit`
- Requires: `REPLICATE_API_TOKEN`
- Endpoints:
  - `POST /api/auto-edit/start` → `{ jobId }`
  - `GET /api/auto-edit/stream?jobId=...` → SSE stream with progress events
  - Uses Replicate models: `anthropic/claude-3.5-sonnet`, `black-forest-labs/flux-1.1-pro`, `wan-video/wan-2.2-i2v-fast`

