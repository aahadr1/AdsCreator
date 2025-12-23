/**
 * Safety Gates Tests
 * Phase 5: Testing & QA
 */

import { detectAmbiguity, checkQualityGate } from '../lib/safetyGates';

describe('Ambiguity Detection', () => {
  test('should detect ambiguous request with no product', () => {
    const gate = detectAmbiguity('Make me some ads');
    expect(gate).not.toBeNull();
    expect(gate?.triggered).toBe(true);
    expect(gate?.questions.length).toBeGreaterThan(0);
    expect(gate?.questions.length).toBeLessThanOrEqual(2);
  });

  test('should NOT detect ambiguity in clear request', () => {
    const gate = detectAmbiguity('Make TikTok ads for my meal kit service');
    expect(gate).toBeNull();
  });

  test('should ask max 2 questions', () => {
    const gate = detectAmbiguity('Make something');
    expect(gate?.questions.length).toBeLessThanOrEqual(2);
  });

  test('should provide assumptions when inferring', () => {
    const gate = detectAmbiguity('Make ads for my product');
    if (gate) {
      expect(gate.inferredAssumptions).toBeDefined();
    }
  });
});

describe('Quality Gate', () => {
  test('should block low-quality hook', () => {
    const gate = checkQualityGate('Are you tired of feeling tired?', 'hook');
    expect(gate).not.toBeNull();
    expect(gate?.triggered).toBe(true);
    expect(gate?.severity).toBe('blocking');
  });

  test('should pass high-quality hook', () => {
    const gate = checkQualityGate(
      'If you meal prep every Sunday but eat sad chicken by Wednesday',
      'hook'
    );
    expect(gate).toBeNull();
  });

  test('should provide specific suggestions', () => {
    const gate = checkQualityGate('Are you tired of meal prepping?', 'hook');
    expect(gate?.suggestions).toBeDefined();
    expect(gate?.suggestions.length).toBeGreaterThan(0);
  });

  test('should track retry count', () => {
    const gate = checkQualityGate('Click here to learn more', 'hook');
    expect(gate?.retryCount).toBe(0);
    expect(gate?.maxRetries).toBe(3);
  });
});

