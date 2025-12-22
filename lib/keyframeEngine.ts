import type { Keyframe, EasingType, KeyframeProperty, Transform } from '@/types/editor';

/**
 * Keyframe Animation Engine
 * Handles interpolation and easing for animated properties
 */

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

export function easeLinear(t: number): number {
  return t;
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  return --t * t * t + 1;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

/**
 * Cubic bezier easing
 */
export function easeBezier(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
): number {
  // Simplified cubic bezier - for production, use a proper implementation
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;

  // Newton-Raphson iteration to solve for t given x
  let t2 = t;
  for (let i = 0; i < 8; i++) {
    const x = sampleCurveX(t2) - t;
    if (Math.abs(x) < 0.001) break;
    const d = 3 * ax * t2 * t2 + 2 * bx * t2 + cx;
    if (Math.abs(d) < 0.000001) break;
    t2 -= x / d;
  }

  return sampleCurveY(t2);
}

/**
 * Apply easing function
 */
export function applyEasing(t: number, easing: EasingType, bezierPoints?: [number, number, number, number]): number {
  t = Math.max(0, Math.min(1, t)); // Clamp to 0-1

  switch (easing) {
    case 'linear':
      return easeLinear(t);
    case 'easeIn':
      return easeInCubic(t);
    case 'easeOut':
      return easeOutCubic(t);
    case 'easeInOut':
      return easeInOutCubic(t);
    case 'bezier':
      if (bezierPoints) {
        return easeBezier(t, bezierPoints[0], bezierPoints[1], bezierPoints[2], bezierPoints[3]);
      }
      return easeLinear(t);
    default:
      return easeLinear(t);
  }
}

// ============================================================================
// KEYFRAME INTERPOLATION
// ============================================================================

/**
 * Find keyframes surrounding a given time
 */
export function findSurroundingKeyframes(
  keyframes: Keyframe[],
  time: number,
  property: KeyframeProperty
): { before: Keyframe | null; after: Keyframe | null } {
  const propertyKeyframes = keyframes
    .filter((kf) => kf.property === property)
    .sort((a, b) => a.time - b.time);

  let before: Keyframe | null = null;
  let after: Keyframe | null = null;

  for (const kf of propertyKeyframes) {
    if (kf.time <= time) {
      before = kf;
    } else if (kf.time > time && !after) {
      after = kf;
      break;
    }
  }

  return { before, after };
}

/**
 * Interpolate value between two keyframes
 */
export function interpolateKeyframes(
  keyframeBefore: Keyframe,
  keyframeAfter: Keyframe,
  time: number
): number {
  const duration = keyframeAfter.time - keyframeBefore.time;
  if (duration === 0) return keyframeBefore.value;

  const t = (time - keyframeBefore.time) / duration;
  const easedT = applyEasing(t, keyframeBefore.easing, keyframeBefore.bezierPoints);

  return keyframeBefore.value + (keyframeAfter.value - keyframeBefore.value) * easedT;
}

/**
 * Get animated value at a specific time
 */
export function getAnimatedValue(
  keyframes: Keyframe[],
  property: KeyframeProperty,
  time: number,
  defaultValue: number
): number {
  const { before, after } = findSurroundingKeyframes(keyframes, time, property);

  // No keyframes
  if (!before && !after) {
    return defaultValue;
  }

  // Before first keyframe
  if (!before && after) {
    return after.value;
  }

  // After last keyframe
  if (before && !after) {
    return before.value;
  }

  // Between keyframes
  if (before && after) {
    return interpolateKeyframes(before, after, time);
  }

  return defaultValue;
}

/**
 * Get all animated properties at a specific time
 */
export function getAnimatedTransform(
  keyframes: Keyframe[],
  time: number,
  baseTransform: Transform
): Transform {
  return {
    x: getAnimatedValue(keyframes, 'x', time, baseTransform.x),
    y: getAnimatedValue(keyframes, 'y', time, baseTransform.y),
    scale: getAnimatedValue(keyframes, 'scale', time, baseTransform.scale),
    scaleX: getAnimatedValue(keyframes, 'scaleX', time, baseTransform.scaleX),
    scaleY: getAnimatedValue(keyframes, 'scaleY', time, baseTransform.scaleY),
    rotation: getAnimatedValue(keyframes, 'rotation', time, baseTransform.rotation),
    opacity: getAnimatedValue(keyframes, 'opacity', time, baseTransform.opacity),
    anchorX: baseTransform.anchorX,
    anchorY: baseTransform.anchorY,
  };
}

// ============================================================================
// KEYFRAME MANAGEMENT
// ============================================================================

/**
 * Create a new keyframe
 */
export function createKeyframe(
  time: number,
  property: KeyframeProperty,
  value: number,
  easing: EasingType = 'linear'
): Keyframe {
  return {
    id: `keyframe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    time,
    property,
    value,
    easing,
  };
}

/**
 * Add keyframe to array (sorted by time)
 */
export function addKeyframe(keyframes: Keyframe[], newKeyframe: Keyframe): Keyframe[] {
  return [...keyframes, newKeyframe].sort((a, b) => a.time - b.time);
}

/**
 * Remove keyframe by ID
 */
export function removeKeyframe(keyframes: Keyframe[], keyframeId: string): Keyframe[] {
  return keyframes.filter((kf) => kf.id !== keyframeId);
}

/**
 * Update keyframe value
 */
export function updateKeyframe(
  keyframes: Keyframe[],
  keyframeId: string,
  updates: Partial<Keyframe>
): Keyframe[] {
  return keyframes.map((kf) => (kf.id === keyframeId ? { ...kf, ...updates } : kf));
}

/**
 * Get keyframe by ID
 */
export function getKeyframeById(keyframes: Keyframe[], keyframeId: string): Keyframe | null {
  return keyframes.find((kf) => kf.id === keyframeId) || null;
}

/**
 * Get all keyframes for a specific property
 */
export function getKeyframesForProperty(
  keyframes: Keyframe[],
  property: KeyframeProperty
): Keyframe[] {
  return keyframes.filter((kf) => kf.property === property).sort((a, b) => a.time - b.time);
}

/**
 * Check if property is animated
 */
export function isPropertyAnimated(keyframes: Keyframe[], property: KeyframeProperty): boolean {
  return keyframes.some((kf) => kf.property === property);
}

/**
 * Get keyframe at exact time
 */
export function getKeyframeAtTime(
  keyframes: Keyframe[],
  property: KeyframeProperty,
  time: number,
  tolerance: number = 0.01
): Keyframe | null {
  return (
    keyframes.find(
      (kf) => kf.property === property && Math.abs(kf.time - time) < tolerance
    ) || null
  );
}

/**
 * Move keyframe to new time
 */
export function moveKeyframe(
  keyframes: Keyframe[],
  keyframeId: string,
  newTime: number
): Keyframe[] {
  return updateKeyframe(keyframes, keyframeId, { time: newTime });
}

/**
 * Duplicate keyframes with time offset
 */
export function duplicateKeyframes(
  keyframes: Keyframe[],
  keyframeIds: string[],
  timeOffset: number
): Keyframe[] {
  const toDuplicate = keyframes.filter((kf) => keyframeIds.includes(kf.id));
  const duplicated = toDuplicate.map((kf) =>
    createKeyframe(kf.time + timeOffset, kf.property, kf.value, kf.easing)
  );

  return [...keyframes, ...duplicated];
}

/**
 * Scale keyframe times (useful for time remapping)
 */
export function scaleKeyframeTimes(
  keyframes: Keyframe[],
  scale: number,
  pivot: number = 0
): Keyframe[] {
  return keyframes.map((kf) => ({
    ...kf,
    time: pivot + (kf.time - pivot) * scale,
  }));
}

/**
 * Get keyframe curve data for visualization
 */
export function getKeyframeCurveData(
  keyframes: Keyframe[],
  property: KeyframeProperty,
  samples: number = 100
): Array<{ time: number; value: number }> {
  const propertyKeyframes = getKeyframesForProperty(keyframes, property);

  if (propertyKeyframes.length === 0) {
    return [];
  }

  const startTime = propertyKeyframes[0].time;
  const endTime = propertyKeyframes[propertyKeyframes.length - 1].time;
  const duration = endTime - startTime;

  const data: Array<{ time: number; value: number }> = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const time = startTime + duration * t;
    const value = getAnimatedValue(keyframes, property, time, propertyKeyframes[0].value);
    data.push({ time, value });
  }

  return data;
}

// ============================================================================
// KEYFRAME PRESETS
// ============================================================================

export const KEYFRAME_PRESETS = {
  fadeIn: (duration: number = 1): Keyframe[] => [
    createKeyframe(0, 'opacity', 0, 'easeOut'),
    createKeyframe(duration, 'opacity', 1, 'linear'),
  ],

  fadeOut: (duration: number = 1): Keyframe[] => [
    createKeyframe(0, 'opacity', 1, 'easeIn'),
    createKeyframe(duration, 'opacity', 0, 'linear'),
  ],

  slideInLeft: (duration: number = 1, distance: number = 100): Keyframe[] => [
    createKeyframe(0, 'x', -distance, 'easeOut'),
    createKeyframe(duration, 'x', 0, 'linear'),
  ],

  slideInRight: (duration: number = 1, distance: number = 100): Keyframe[] => [
    createKeyframe(0, 'x', distance, 'easeOut'),
    createKeyframe(duration, 'x', 0, 'linear'),
  ],

  scaleUp: (duration: number = 1): Keyframe[] => [
    createKeyframe(0, 'scale', 0, 'easeOut'),
    createKeyframe(duration, 'scale', 1, 'linear'),
  ],

  bounce: (duration: number = 1): Keyframe[] => [
    createKeyframe(0, 'y', 0, 'easeOut'),
    createKeyframe(duration * 0.3, 'y', -50, 'easeIn'),
    createKeyframe(duration * 0.6, 'y', 0, 'easeOut'),
    createKeyframe(duration * 0.8, 'y', -20, 'easeIn'),
    createKeyframe(duration, 'y', 0, 'easeOut'),
  ],

  spin: (duration: number = 1, rotations: number = 1): Keyframe[] => [
    createKeyframe(0, 'rotation', 0, 'linear'),
    createKeyframe(duration, 'rotation', 360 * rotations, 'linear'),
  ],
};

