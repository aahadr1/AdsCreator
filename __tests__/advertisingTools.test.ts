/**
 * Advertising Tools Tests
 * Phase 5: Testing & QA
 */

import { calculateNoveltyScore, passesQualityGate } from '../lib/advertisingTools';

describe('Novelty Scoring', () => {
  test('should penalize generic "Are you tired of" phrase', () => {
    const score = calculateNoveltyScore('Are you tired of feeling tired?');
    expect(score).toBeLessThan(60);
  });

  test('should penalize "Click here" CTA', () => {
    const score = calculateNoveltyScore('Click here to learn more');
    expect(score).toBeLessThan(60);
  });

  test('should reward specific content with numbers', () => {
    const score = calculateNoveltyScore(
      'If you meal prep every Sunday but eat sad chicken by Wednesday, I need to show you this. Save 8 hours per week.'
    );
    expect(score).toBeGreaterThanOrEqual(60);
  });

  test('should reward pattern interrupt words', () => {
    const score = calculateNoveltyScore(
      'Confession: I used to waste 2 hours every Sunday meal prepping'
    );
    expect(score).toBeGreaterThanOrEqual(60);
  });

  test('should reward detailed content', () => {
    const longSpecific = 'If you work from home but struggle with staying focused because your workspace is cluttered and distracting';
    const score = calculateNoveltyScore(longSpecific);
    expect(score).toBeGreaterThan(50);
  });
});

describe('Quality Gate', () => {
  test('should pass high-novelty hook', () => {
    const result = passesQualityGate(
      'If you meal prep every Sunday but eat sad chicken by Wednesday',
      'hook'
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  test('should fail generic hook', () => {
    const result = passesQualityGate(
      'Are you tired of feeling tired?',
      'hook'
    );
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(60);
    expect(result.reason).toBeDefined();
  });

  test('should pass script with lower threshold', () => {
    const result = passesQualityGate(
      'This product will help you achieve your goals',
      'script'
    );
    // Script threshold is 55, this generic text should fail
    expect(result.passed).toBe(false);
  });
});

