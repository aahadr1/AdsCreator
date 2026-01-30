# Apply Assistant State Optimization Migration

This migration adds performance indexes for the JSONB `plan` field in the `assistant_conversations` table.

## Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy and paste the contents of `assistant_state_optimization.sql`
5. Click **Run** to execute the migration

## Option 2: Using Supabase CLI

```bash
# Make sure you're logged in to Supabase CLI
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push --db-url "$SUPABASE_URL" --include-all < db/assistant_state_optimization.sql
```

## Option 3: Using psql directly

If you have direct database access credentials:

```bash
# Get your database URL from Supabase dashboard (Settings > Database)
# Connection string format: postgresql://postgres:[password]@[host]:5432/postgres

psql "postgresql://postgres:[password]@[host]:5432/postgres" -f db/assistant_state_optimization.sql
```

## What this migration does

- Adds GIN indexes for faster JSONB queries on `media_pool` and `workflow_state`
- Adds partial indexes for quick lookups of active avatars and approved scripts
- Adds documentation comments explaining the state architecture

## Verification

After applying, verify the indexes were created:

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'assistant_conversations' 
AND indexname LIKE 'idx_assistant_conversations_plan_%';
```

You should see 4 new indexes listed.
