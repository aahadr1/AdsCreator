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
