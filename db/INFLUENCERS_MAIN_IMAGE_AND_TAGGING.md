# Influencers: MAIN image + @tagging rollout

This repo now supports:

- A 6th **MAIN** influencer image (`photo_main`) generated from the 5-angle photoshoot.
- **Globally unique** influencer usernames (case-insensitive).
- Assistant chat tagging via `@username` to automatically use that influencer as the avatar reference.

## 1) Apply the DB migration (existing deployments)

If your `influencers` table already exists, apply:

- `db/influencers_migration_add_main_image_and_unique_username.sql`

### Pre-check (important): duplicates will break the unique index

Run this first:

```sql
select lower(username) as username_ci, count(*) as cnt
from influencers
where deleted_at is null and username is not null
group by lower(username)
having count(*) > 1
order by cnt desc;
```

If any rows are returned, resolve duplicates before applying the migration:

- Pick one row to keep as-is.
- Update the others with suffixes (`alex2`, `alex3`, …).

Example (manual):

```sql
update influencers
set username = 'alex2'
where id = '<uuid-here>';
```

Then re-run the duplicate query until it returns no rows.

## 2) Username backfill (optional)

New influencer creation is server-authoritative and will always assign a unique username.
For **existing** rows missing `username`, you can backfill with the script:

- `scripts/backfill-influencer-usernames.js`

Run it with:

```bash
NEXT_PUBLIC_SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/backfill-influencer-usernames.js
```

## 3) MAIN image generation backfill (optional)

The MAIN image is generated automatically after the 5-angle photoshoot, but older rows may not have it.

Find candidates:

```sql
select id, username, photo_main
from influencers
where deleted_at is null
  and photo_main is null
  and photo_face_closeup is not null
  and photo_full_body is not null
  and photo_right_side is not null
  and photo_left_side is not null
  and photo_back_top is not null
order by updated_at desc;
```

For each returned `id`, re-run the photoshoot endpoint with `force_main_regen: true` (requires a user token):

```json
POST /api/influencer/generate-photoshoot
Authorization: Bearer <user-access-token>

{
  "influencer_id": "<id>",
  "generation_prompt": "<use the influencer's enriched_description or generation_prompt>",
  "input_images": null,
  "force_main_regen": true
}
```

## 4) Assistant chat tagging behavior

- In assistant chat, typing `@username ...` selects that influencer as the avatar immediately.
- The assistant will prefer `photo_main` (fallback to `photo_face_closeup` if MAIN is not ready).
- For image generation requests, the backend auto-injects the selected influencer avatar as a reference image (`image_input`), so generations stay consistent.

