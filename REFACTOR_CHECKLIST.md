# System Prompt Refactor - Verification Checklist

## ✅ Completed Changes

### Code Changes
- [x] Removed CREATIVE_IDEATION_PROMPT from system.ts
- [x] Removed IMAGE_REFERENCE_SELECTION_PROMPT from system.ts  
- [x] Removed LOCKED/DELTA pattern from all prompts
- [x] Removed word count limits from all prompts
- [x] Removed reflexion block from main system prompt
- [x] Removed anti-pattern lists from all prompts
- [x] Replaced technical jargon with natural language
- [x] Simplified avatar workflow instructions
- [x] Reduced system prompt from 1369 lines to 450 lines
- [x] Removed Phase 0 (creative ideation) from route.ts
- [x] Simplified getImageReferenceReflexion to use deterministic logic
- [x] Renamed buildFallbackImageReferences to buildDeterministicImageReferences
- [x] Removed creativeBrief variable and all references
- [x] Updated imports to remove unused prompts
- [x] Fixed TypeScript compilation errors

### Documentation
- [x] Created SYSTEM_PROMPT_REFACTOR_SUMMARY.md with complete analysis
- [x] Created this checklist document

## 🧪 Testing Checklist

### Critical Paths to Test

**1. Avatar Generation**
- [ ] User asks for video with person
- [ ] System generates avatar
- [ ] User confirms with natural language ("looks good", "yes", "cool")
- [ ] System accepts confirmation and proceeds

**2. Storyboard Creation**
- [ ] System creates scenario (without ideation phase)
- [ ] System refines scenes with natural prompts (no LOCKED/DELTA)
- [ ] Reference images selected deterministically (no AI call)
- [ ] Frames generate sequentially
- [ ] All frames complete successfully

**3. Scene Prompts Quality**
- [ ] Prompts use natural language (not robot-speak)
- [ ] Prompts are concise but complete (not padding to word count)
- [ ] Prompts focus on what's new/changing (trust references)
- [ ] No technical jargon ("bright reflection in eyes" not "ring-light catchlight")

**4. Reference Image Selection**
- [ ] Last frame includes first frame ✓
- [ ] Smooth transitions include prev scene last frame ✓
- [ ] Avatar scenes include avatar reference ✓
- [ ] Product scenes include product reference ✓
- [ ] Recent frames included for style consistency ✓
- [ ] Selection happens instantly (no AI call delay)

**5. Video Generation**
- [ ] User says "proceed" after storyboard
- [ ] System generates videos from frames
- [ ] Videos maintain consistency across scenes

### Performance Metrics to Verify

**Before vs After:**
- [ ] Storyboard creation time: 45-60s → 20-30s (target: ~50% faster)
- [ ] AI calls per storyboard: 5-7 → 2 (target: ~65% fewer)
- [ ] Token cost: ~12k → ~4.5k (target: ~60% cheaper)
- [ ] Reference selection: 2-3s → instant (target: 100% faster)

### Edge Cases to Test

**Avatar Workflow:**
- [ ] User says "no" to avatar → system regenerates
- [ ] User modifies avatar request → system regenerates with changes
- [ ] Multiple avatars in conversation → system uses most recent confirmed

**Reference Selection:**
- [ ] First scene (no previous frames)
- [ ] Scene without avatar (product-only)
- [ ] Scene without product (avatar-only)
- [ ] Smooth transition when previous scene failed
- [ ] More than 14 available references (should trim to 14)

**Prompt Generation:**
- [ ] Very short scene (2 seconds)
- [ ] Very long scene (10 seconds)
- [ ] Scene with no voiceover
- [ ] Scene with long voiceover
- [ ] Macro shot scene
- [ ] Wide shot scene

## 🐛 Known Issues / Limitations

**Not Fixed (Future Work):**
1. Reflexion parsing still exists in route.ts (not used, but code present)
2. Scene schema still has 12 fields (could be reduced to 5)
3. Avatar workflow still has some gates (could be more parallel)
4. Context block injection still uses old "CRITICAL INSTRUCTIONS" style

**Acceptable Limitations:**
1. Deterministic reference selection may not be "optimal" but is consistent
2. No creative ideation may produce less "ownable" concepts (but faster)
3. Natural language prompts may vary more in structure (but more creative)

## 📝 Rollback Plan

**If issues arise, to rollback:**

1. **Restore system.ts:**
   ```bash
   git checkout HEAD~1 lib/prompts/assistant/system.ts
   ```

2. **Restore route.ts:**
   ```bash
   git checkout HEAD~1 app/api/assistant/chat/route.ts
   ```

3. **Or restore both:**
   ```bash
   git revert HEAD
   ```

**Files that were modified:**
- `/lib/prompts/assistant/system.ts` (major rewrite)
- `/app/api/assistant/chat/route.ts` (minor changes to remove Phase 0 and simplify reference selection)

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All tests pass (run full test suite)
- [ ] TypeScript compilation succeeds ✓
- [ ] ESLint passes (no new warnings)
- [ ] Manual testing of critical paths completed
- [ ] Performance metrics verified
- [ ] Edge cases tested
- [ ] Rollback plan documented
- [ ] Team notified of changes
- [ ] Monitoring/alerts configured for new behavior

## 📊 Success Criteria

**The refactor is successful if:**

1. **Performance:**
   - Storyboard creation is at least 40% faster
   - Token costs reduced by at least 50%
   - AI calls reduced to 2 per storyboard

2. **Quality:**
   - Image quality is equal or better (subjective assessment)
   - Scene consistency is equal or better
   - User feedback is positive

3. **Reliability:**
   - No increase in error rates
   - No regression in existing functionality
   - Reference selection works reliably

4. **User Experience:**
   - Users can confirm avatars naturally
   - Workflow feels smoother/faster
   - No new friction points

## 🎯 Next Steps

**After successful deployment:**

1. Monitor metrics for 7 days
2. Collect user feedback
3. Iterate on prompt wording based on results
4. Consider additional simplifications (scene schema, etc.)
5. Update documentation/training materials

**Future optimizations to consider:**
- Simplify scene schema (12 fields → 5 fields)
- Further streamline avatar workflow (parallel generation)
- Remove remaining reflexion parsing code
- Optimize context block injection
