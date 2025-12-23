# Production Readiness Checklist

**Version**: 1.0  
**Last Updated**: December 23, 2025  
**Status**: Implementation-Ready

---

## Overview

This checklist ensures the Adz Creator Agent is production-ready before deployment. All criteria must be verified and signed off.

**Sign-off Required**: Engineering Lead, Product Owner, QA Lead

---

## ✅ 1. Core Infrastructure

### 1.1 System Prompts
- [ ] **Orchestrator prompt** exists and follows advertising-native framework
- [ ] **Creative Strategist prompt** generates ≥3 audience hypotheses, ≥3 angle maps
- [ ] **Script Generator prompt** includes anti-generic enforcement
- [ ] **Hooks Engine prompt** calculates novelty scores correctly
- [ ] **QA Reviewer prompt** rejects generic content
- [ ] **Compliance Checker prompt** covers TikTok, Meta, YouTube policies
- [ ] **Media Analyst prompt** analyzes images/videos with vision model

**Verification Method**: Unit tests with known inputs/outputs

### 1.2 Tool Registry
- [ ] All 7 advertising tools defined in `lib/advertisingTools.ts`
- [ ] Each tool has complete input/output schemas
- [ ] Each tool has evaluation rubric
- [ ] Cost estimates accurate (within 10% of actual)
- [ ] Latency estimates accurate (within 20% of actual)

**Verification Method**: Run test workflows, compare estimates vs actuals

### 1.3 Model Selection
- [ ] Image model selector follows decision tree
- [ ] Video model selector follows decision tree
- [ ] TTS model selector follows decision tree
- [ ] Lipsync model selector follows decision tree
- [ ] Platform aspect ratio logic enforced
- [ ] Brand consistency rules applied

**Verification Method**: Test with various contexts, verify correct models selected

---

## ✅ 2. Advertising Intelligence

### 2.1 Creative Strategy Generation
- [ ] Generates ≥3 distinct audience hypotheses
- [ ] Audience hypotheses are hyper-specific (not "millennials")
- [ ] Generates ≥3 angle maps with different framings
- [ ] Each angle map includes 3-5 hook examples
- [ ] All hooks score ≥60 novelty
- [ ] Generates ≥2 creative routes (formats)
- [ ] Testing matrix includes variants count

**Verification Method**: Generate strategies for 5 different products, manually review quality

### 2.2 Anti-Generic Enforcement
- [ ] Novelty scoring formula implemented correctly
- [ ] Hooks scoring <60 are rejected
- [ ] Scripts scoring <55 are rejected
- [ ] Generic phrases trigger automatic rejection
- [ ] QA Reviewer provides specific suggestions (not vague)
- [ ] Auto-retry up to 3 times if quality fails

**Verification Method**: Test with known generic inputs, verify rejection + regeneration

### 2.3 Platform Appropriateness
- [ ] TikTok: Casual, authentic, fast-paced
- [ ] Instagram: Polished, aspirational, aesthetic
- [ ] YouTube: Educational, value-driven
- [ ] Facebook: Direct, benefit-driven
- [ ] Aspect ratios match platform requirements

**Verification Method**: Generate ads for each platform, manually verify tone/format

---

## ✅ 3. Safety Gates

### 3.1 Ambiguity Gate
- [ ] Detects unclear user requests
- [ ] Asks max 2 questions (never more)
- [ ] Labels explicit assumptions
- [ ] Only triggers when truly ambiguous (not over-cautious)

**Verification Method**: Test with vague requests, verify appropriate questioning

### 3.2 Budget Gate
- [ ] Calculates total estimated cost correctly
- [ ] Pauses when cost > user budget
- [ ] Suggests cost reduction options
- [ ] Options include: reduce scope, use faster models, proceed anyway

**Verification Method**: Set low budget ($5), verify gate triggers for expensive plan

### 3.3 Policy Gate (Compliance)
- [ ] **TikTok policies** enforced:
  - [ ] Health claims without disclaimers → BLOCK
  - [ ] Before/after weight loss → BLOCK
  - [ ] Misleading price claims → BLOCK
- [ ] **Meta policies** enforced:
  - [ ] Discriminatory language → BLOCK
  - [ ] Personal attributes → BLOCK
  - [ ] Misleading claims → BLOCK
- [ ] **YouTube policies** enforced:
  - [ ] Misleading thumbnails → BLOCK
  - [ ] Missing sponsored disclosures → BLOCK
- [ ] Provides specific recommendations (not just "fix this")

**Verification Method**: Test with violating content, verify blocking + recommendations

### 3.4 Quality Gate
- [ ] Novelty scores calculated correctly
- [ ] Scores below threshold rejected
- [ ] Auto-retry up to 3 times
- [ ] After 3 failures, returns best attempt with warning

**Verification Method**: Force low-quality output, verify retry logic

---

## ✅ 4. Research Integration

### 4.1 TikTok Creative Center
- [ ] Endpoint exists: `/api/research/tiktok-creative`
- [ ] Scrapes public data (no authentication bypass)
- [ ] Returns insights, trends, citations
- [ ] Caches results for 24 hours
- [ ] Rate limits: 10 requests/minute
- [ ] Handles errors gracefully (returns cached data)

**Verification Method**: Call endpoint with real queries, verify response structure

### 4.2 Meta Ads Library
- [ ] Endpoint exists: `/api/research/meta-ads-library`
- [ ] Scrapes public ad library
- [ ] Returns ads, patterns, citations
- [ ] Caches for 24 hours
- [ ] Rate limits enforced

**Verification Method**: Search for known advertiser, verify results

### 4.3 Trends Summary
- [ ] Endpoint exists: `/api/research/trends-summary`
- [ ] Aggregates data from multiple sources
- [ ] Identifies hook trends, format trends
- [ ] All insights include confidence scores
- [ ] Caches for 12 hours

**Verification Method**: Request trends for category, verify aggregation

### 4.4 Citation Tracking
- [ ] Every research insight has citation
- [ ] Citations stored in database
- [ ] Citations formatted properly
- [ ] No fabricated data (verified against sources)

**Verification Method**: Trace 10 insights back to sources, verify accuracy

---

## ✅ 5. Media Understanding

### 5.1 Vision Analysis
- [ ] Extracts layout, colors, text from images
- [ ] Extracts keyframes from videos
- [ ] OCR works on text overlays
- [ ] Brand elements detected (logo, colors)

**Verification Method**: Upload known images/videos, verify extraction accuracy

### 5.2 Ad Diagnostics
- [ ] Identifies hook, offer, CTA
- [ ] Scores effectiveness (0-100)
- [ ] Identifies strengths and weaknesses
- [ ] Provides specific recommendations
- [ ] Suggests testable variations

**Verification Method**: Analyze 5 real competitor ads, manually verify accuracy

---

## ✅ 6. Execution Modes

### 6.1 Manual Mode (Default)
- [ ] Generates plan without running paid generation
- [ ] Shows cost and time estimates
- [ ] User can edit prompts before running
- [ ] User can approve all steps or step-by-step
- [ ] Executes only what user approves

**Verification Method**: Generate plan, verify no execution until approval

### 6.2 Auto Mode (Autopilot)
- [ ] Executes plan autonomously
- [ ] Pauses at safety gates (ambiguity, budget, policy, quality)
- [ ] Streams progress updates
- [ ] Pauses at checkpoints (after research, after strategy, after first variant)
- [ ] User can switch to manual mid-run

**Verification Method**: Run in auto mode, trigger each gate type, verify pause

---

## ✅ 7. Cost & Performance

### 7.1 Cost Estimation
- [ ] All models have cost metadata
- [ ] Estimates within 10% of actual costs
- [ ] Plan shows total estimated cost
- [ ] Budget gate triggers correctly

**Verification Method**: Run 10 workflows, calculate |estimated - actual| / actual

**Acceptance Criteria**: 90% of workflows within 10% accuracy

### 7.2 Latency Estimation
- [ ] All models have latency metadata
- [ ] Estimates within 20% of actual time
- [ ] Long-running steps (video) have clear user communication
- [ ] 30-minute timeout enforced

**Verification Method**: Run 10 workflows, measure actual latency vs estimates

**Acceptance Criteria**: 90% of workflows within 20% accuracy

### 7.3 Cost Breakdown
- [ ] Image models: $0.10 - $0.80
- [ ] Video models: $0.40 - $2.50
- [ ] TTS models: $0.03 - $0.30
- [ ] Lipsync models: $0.80 - $1.80
- [ ] Advertising tools: <$0.10 each

**Verification Method**: Verify pricing with model providers

---

## ✅ 8. Quality Metrics

### 8.1 Novelty Scoring
- [ ] **Target**: ≥70% of hooks score ≥60
- [ ] **Measurement**: Track all hook novelty scores
- [ ] **Current**: ___% (fill after testing)

**Verification Method**: Generate 100 hooks, calculate average novelty score

### 8.2 User Approval Rate
- [ ] **Target**: ≥80% of plans approved without major edits
- [ ] **Measurement**: Plans approved / plans shown
- [ ] **Current**: ___% (fill after beta testing)

**Verification Method**: Beta test with 20 users, track approval rate

### 8.3 Compliance Pass Rate
- [ ] **Target**: 100% of outputs pass compliance checks
- [ ] **Measurement**: Compliant outputs / total outputs
- [ ] **Current**: ___% (must be 100%)

**Verification Method**: Run 50 outputs through compliance checker

### 8.4 Research Relevance
- [ ] **Target**: ≥85% of research insights rated "useful" by users
- [ ] **Measurement**: User feedback on research quality
- [ ] **Current**: ___% (fill after beta testing)

**Verification Method**: Beta test with feedback surveys

---

## ✅ 9. Error Handling

### 9.1 Graceful Degradation
- [ ] If TikTok scraping fails → Return cached data + warning
- [ ] If model times out → Return partial results + retry option
- [ ] If compliance check uncertain → Err on side of caution (block)
- [ ] If quality fails 3x → Return best attempt + flag for manual review

**Verification Method**: Simulate failures, verify graceful handling

### 9.2 Error Messages
- [ ] All errors have user-friendly messages
- [ ] Technical errors logged for debugging
- [ ] Users never see raw stack traces
- [ ] Errors include actionable next steps

**Verification Method**: Trigger errors, verify messages are clear

---

## ✅ 10. Documentation

### 10.1 Implementation Documentation
- [ ] All system prompts documented in `lib/prompts/`
- [ ] All tools documented in `lib/advertisingTools.ts`
- [ ] All routing logic documented in `lib/routing/`
- [ ] Example flows in `docs/examples/`

**Verification Method**: Review all docs, ensure completeness

### 10.2 API Documentation
- [ ] All endpoints documented (OpenAPI/Swagger)
- [ ] Request/response schemas defined
- [ ] Example requests/responses provided
- [ ] Error codes documented

**Verification Method**: Generate API docs, manually review

### 10.3 User Documentation
- [ ] User guide for Manual mode
- [ ] User guide for Auto mode
- [ ] Troubleshooting guide
- [ ] FAQ

**Verification Method**: User testing, gather feedback

---

## ✅ 11. Testing

### 11.1 Unit Tests
- [ ] Novelty scoring function
- [ ] Model selection logic
- [ ] Safety gate triggers
- [ ] Cost/latency calculations

**Verification Method**: Run test suite, 90%+ coverage

### 11.2 Integration Tests
- [ ] End-to-end workflow (request → plan → execution → output)
- [ ] Research → Strategy flow
- [ ] Media upload → Analysis → Variations flow
- [ ] Multilingual workflow

**Verification Method**: Automated test suite

### 11.3 Manual QA
- [ ] Generate 5 full campaigns, manually review quality
- [ ] Test all safety gates (trigger each type)
- [ ] Test all platforms (TikTok, Instagram, YouTube, Facebook)
- [ ] Test research tools with real queries

**Verification Method**: QA team signoff

---

## ✅ 12. Security & Compliance

### 12.1 Scraping Ethics
- [ ] Only scrapes public data (no auth bypass)
- [ ] Respects robots.txt
- [ ] Rate limiting implemented
- [ ] Caches aggressively

**Verification Method**: Review scraping code, verify ethics

### 12.2 Privacy
- [ ] No PII stored from ads
- [ ] User data encrypted
- [ ] Citations don't expose sensitive info

**Verification Method**: Privacy audit

### 12.3 Platform Policies
- [ ] Agent understands TikTok ad policies
- [ ] Agent understands Meta ad policies
- [ ] Agent understands YouTube ad policies
- [ ] Blocks policy-violating content

**Verification Method**: Test with violating content, verify blocking

---

## ✅ 13. Monitoring & Logging

### 13.1 Logging
- [ ] All agent decisions logged
- [ ] All safety gate triggers logged
- [ ] All research queries logged
- [ ] All errors logged with stack traces

**Verification Method**: Review logs, ensure completeness

### 13.2 Metrics
- [ ] Track novelty scores over time
- [ ] Track user approval rates
- [ ] Track compliance pass rates
- [ ] Track cost accuracy
- [ ] Track latency accuracy

**Verification Method**: Set up dashboards, verify metrics collection

### 13.3 Alerts
- [ ] Alert if compliance pass rate < 100%
- [ ] Alert if novelty scores declining
- [ ] Alert if cost estimates >20% off
- [ ] Alert if errors spike

**Verification Method**: Trigger conditions, verify alerts fire

---

## ✅ 14. Deployment

### 14.1 Staging Environment
- [ ] All components deployed to staging
- [ ] End-to-end tests pass on staging
- [ ] Performance acceptable on staging

**Verification Method**: Run full test suite on staging

### 14.2 Rollout Plan
- [ ] Beta test with 20 users
- [ ] Gather feedback, iterate
- [ ] Gradual rollout (10% → 25% → 50% → 100%)
- [ ] Rollback plan if issues

**Verification Method**: Document rollout plan, get approval

### 14.3 Production Monitoring
- [ ] Dashboards set up
- [ ] Alerts configured
- [ ] On-call rotation defined
- [ ] Incident response plan

**Verification Method**: Verify monitoring setup

---

## 🎯 Final Sign-Off

### Checklist Completion

- [ ] **All items checked**: ___/150 items completed
- [ ] **Quality metrics met**: Novelty ≥70%, Approval ≥80%, Compliance 100%
- [ ] **Testing complete**: Unit, integration, manual QA
- [ ] **Documentation complete**: Code, API, user guides
- [ ] **Security audit passed**
- [ ] **Performance acceptable**: Cost within 10%, latency within 20%

### Approvals

- [ ] **Engineering Lead**: _________________ Date: _______
- [ ] **Product Owner**: _________________ Date: _______
- [ ] **QA Lead**: _________________ Date: _______
- [ ] **Security Lead**: _________________ Date: _______

---

## 🚀 Ready for Production

**Status**: ⬜ Not Ready | ⬜ Ready with Caveats | ✅ **PRODUCTION READY**

**Notes**:
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

---

**Document Version**: 1.0  
**Next Review**: 30 days after production deployment

