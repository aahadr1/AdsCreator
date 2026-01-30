/**
 * Backfill missing influencer usernames (globally unique, case-insensitive).
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/backfill-influencer-usernames.js
 */
const { createClient } = require('@supabase/supabase-js');

function normalizeUsername(input) {
  const ascii = String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  return ascii
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function escapeLikePatternExact(input) {
  return String(input || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

async function usernameExistsCI(supabase, username) {
  const pattern = escapeLikePatternExact(username);
  const { data, error } = await supabase
    .from('influencers')
    .select('id')
    .ilike('username', pattern)
    .is('deleted_at', null)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function buildUniqueUsername(supabase, base) {
  const norm = normalizeUsername(base);
  if (!norm || norm.length < 2) return null;
  const capped = norm.slice(0, 28);
  if (!(await usernameExistsCI(supabase, capped))) return capped;
  for (let i = 2; i <= 999; i++) {
    const candidate = `${capped}${i}`;
    if (candidate.length > 32) continue;
    if (!(await usernameExistsCI(supabase, candidate))) return candidate;
  }
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: influencers, error } = await supabase
    .from('influencers')
    .select('id,name,username,deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const targets = (influencers || []).filter((r) => !r.username || String(r.username).trim().length === 0);
  console.log(`Found ${targets.length} influencer(s) missing username`);

  let updated = 0;
  for (const row of targets) {
    const base = row.name || 'influencer';
    const next = await buildUniqueUsername(supabase, base);
    if (!next) {
      console.warn(`Skipping ${row.id}: could not build username from "${base}"`);
      continue;
    }
    const { error: upErr } = await supabase
      .from('influencers')
      .update({ username: next })
      .eq('id', row.id);
    if (upErr) {
      console.error(`Failed updating ${row.id} -> ${next}:`, upErr);
      continue;
    }
    updated++;
    console.log(`Updated ${row.id}: @${next}`);
  }

  console.log(`Done. Updated ${updated}/${targets.length} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

