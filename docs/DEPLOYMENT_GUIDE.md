# Deployment Guide - Adz Creator Agent

**Phase 6: Beta Launch Preparation**

---

## Pre-Deployment Checklist

### Environment Variables

Ensure these are set in production:

```bash
# Required
REPLICATE_API_TOKEN=your_token_here
REPLICATE_PLANNER_MODEL=anthropic/claude-4.5-sonnet
REPLICATE_VISION_MODEL=meta/llama-3.2-11b-vision-instruct

# Database
DATABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Optional
REPLICATE_PROMPT_MODEL=meta/llama-3.1-8b-instruct
```

### Database Migrations

Run migrations for research citation tracking (if using):

```sql
-- Research citations table
CREATE TABLE IF NOT EXISTS research_citations (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  data_point TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB
);

-- Research cache table
CREATE TABLE IF NOT EXISTS research_cache (
  id SERIAL PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_key ON research_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_expires_at ON research_cache(expires_at);
```

---

## Deployment Steps

### 1. Build & Test

```bash
# Install dependencies
npm install

# Run type checking
npm run type-check

# Run tests
npm test

# Build for production
npm run build
```

### 2. Deploy to Vercel (or your platform)

```bash
# Using Vercel CLI
vercel --prod

# Or push to main branch (if auto-deploy configured)
git push origin main
```

### 3. Verify Endpoints

Test that all new endpoints are accessible:

```bash
# Test creative strategist
curl -X POST https://your-domain.com/api/agents/creative-strategist \
  -H "Content-Type: application/json" \
  -d '{"product": "meal kit service"}'

# Test QA reviewer
curl -X POST https://your-domain.com/api/agents/qa-reviewer \
  -H "Content-Type: application/json" \
  -d '{"content": "Test hook", "contentType": "hook", "context": {}}'

# Test research (mock data)
curl -X POST https://your-domain.com/api/research/tiktok-creative \
  -H "Content-Type: application/json" \
  -d '{"category": "fitness"}'
```

---

## Beta Launch Plan

### Phase 1: Internal Testing (Week 1)
- [ ] Test with 5 internal users
- [ ] Verify all workflows function
- [ ] Monitor error rates
- [ ] Collect feedback

### Phase 2: Private Beta (Week 2-3)
- [ ] Invite 20 beta users
- [ ] Monitor novelty scores
- [ ] Track user approval rates
- [ ] Gather qualitative feedback

### Phase 3: Gradual Rollout (Week 4-6)
- [ ] 10% of users
- [ ] Monitor performance metrics
- [ ] 25% of users
- [ ] 50% of users
- [ ] 100% rollout

---

## Monitoring

### Key Metrics to Track

1. **Novelty Scores**
   - Target: ≥70% of hooks score ≥60
   - Alert if average drops below 55

2. **User Approval Rates**
   - Target: ≥80% of plans approved
   - Alert if drops below 70%

3. **Error Rates**
   - Target: <1% of requests fail
   - Alert if >2%

4. **Latency**
   - Target: P95 < 45s for full workflow
   - Alert if P95 > 60s

### Dashboard Setup

Use your monitoring tool (Vercel Analytics, DataDog, etc.) to track:

```javascript
// Example: Track novelty scores
analytics.track('novelty_score', {
  score: 78,
  content_type: 'hook',
  passed: true
});

// Track user approvals
analytics.track('plan_approval', {
  approved: true,
  steps_count: 8,
  estimated_cost: 5.45
});

// Track errors
analytics.track('error', {
  endpoint: '/api/agents/creative-strategist',
  error_type: 'json_parse_error',
  severity: 'high'
});
```

---

## Rollback Plan

If issues arise during rollout:

### Quick Rollback
```bash
# Revert to previous deployment
vercel rollback
```

### Feature Flag Rollback

If you have feature flags:

```typescript
// Disable advertising-native orchestrator
const USE_ENHANCED_ORCHESTRATOR = false;

export function buildUnifiedPlannerSystemPrompt(): string {
  if (USE_ENHANCED_ORCHESTRATOR) {
    return buildAdvertisingOrchestratorPrompt();
  }
  return buildUnifiedPlannerSystemPromptLegacy();
}
```

---

## Post-Launch

### Week 1 Review
- [ ] Review all metrics
- [ ] Address critical bugs
- [ ] Gather user feedback
- [ ] Plan improvements

### Week 2-4: Iterate
- [ ] Tune novelty thresholds based on data
- [ ] Improve sub-agent prompts
- [ ] Add missing research integrations
- [ ] Optimize performance

### Month 2: Scale
- [ ] Implement actual TikTok/Meta scraping (replace mocks)
- [ ] Add more sub-agents (if needed)
- [ ] Optimize costs
- [ ] Scale infrastructure

---

## Support

### User Documentation

Point users to:
- `/docs/ADZCREATOR_AGENT_SPEC.md` - Complete spec
- `/docs/examples/` - Example workflows
- FAQ (create based on beta feedback)

### Team Contact

- **Engineering Issues**: Create GitHub issue
- **Product Questions**: Product team
- **User Support**: Support team

---

## Success Criteria

Launch is successful if:

✅ **Novelty scores** ≥70% pass threshold  
✅ **User approval rate** ≥80%  
✅ **Error rate** <1%  
✅ **User satisfaction** ≥4/5 stars  
✅ **Zero critical bugs** in first week

---

**Status**: Ready for deployment  
**Next Step**: Begin Phase 1 (Internal Testing)

