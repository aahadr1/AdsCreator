import type { TimelineClip, Track, EditorSequence, Point, TimeRange } from '@/types/editor';

/**
 * Timeline Utility Functions
 * Snapping, collision detection, ripple editing, and more
 */

// ============================================================================
// SNAPPING UTILITIES
// ============================================================================

export type SnapPoint = {
  time: number;
  type: 'playhead' | 'clipStart' | 'clipEnd' | 'marker' | 'grid';
  id?: string;
};

/**
 * Find all snap points in the timeline
 */
export function getSnapPoints(
  sequence: EditorSequence,
  playhead: number,
  gridInterval: number = 1
): SnapPoint[] {
  const points: SnapPoint[] = [];

  // Playhead
  points.push({ time: playhead, type: 'playhead' });

  // Clip edges
  sequence.clips.forEach((clip) => {
    points.push({ time: clip.startTime, type: 'clipStart', id: clip.id });
    points.push({ time: clip.endTime, type: 'clipEnd', id: clip.id });
  });

  // Markers
  sequence.markers.forEach((marker) => {
    points.push({ time: marker.time, type: 'marker', id: marker.id });
  });

  // Grid intervals
  const maxTime = Math.max(sequence.duration, 60);
  for (let i = 0; i <= maxTime; i += gridInterval) {
    points.push({ time: i, type: 'grid' });
  }

  return points;
}

/**
 * Find the nearest snap point to a given time
 */
export function findNearestSnapPoint(
  time: number,
  snapPoints: SnapPoint[],
  tolerance: number
): SnapPoint | null {
  let nearest: SnapPoint | null = null;
  let minDistance = tolerance;

  for (const point of snapPoints) {
    const distance = Math.abs(point.time - time);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
    }
  }

  return nearest;
}

/**
 * Snap a time value to the nearest snap point
 */
export function snapTime(
  time: number,
  snapPoints: SnapPoint[],
  tolerance: number,
  enabled: boolean
): number {
  if (!enabled) return time;

  const nearest = findNearestSnapPoint(time, snapPoints, tolerance);
  return nearest ? nearest.time : time;
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/**
 * Check if two clips overlap in time
 */
export function clipsOverlap(clip1: TimelineClip, clip2: TimelineClip): boolean {
  return (
    clip1.startTime < clip2.endTime &&
    clip1.endTime > clip2.startTime &&
    clip1.trackId === clip2.trackId
  );
}

/**
 * Find all clips that overlap with a given clip
 */
export function findOverlappingClips(
  clip: TimelineClip,
  allClips: TimelineClip[]
): TimelineClip[] {
  return allClips.filter((other) => other.id !== clip.id && clipsOverlap(clip, other));
}

/**
 * Check if a clip can be placed at a position without collision
 */
export function canPlaceClip(
  clip: TimelineClip,
  allClips: TimelineClip[],
  allowOverlap: boolean = false
): boolean {
  if (allowOverlap) return true;
  return findOverlappingClips(clip, allClips).length === 0;
}

/**
 * Find next available position for a clip on a track
 */
export function findNextAvailablePosition(
  trackId: string,
  duration: number,
  allClips: TimelineClip[],
  startSearchFrom: number = 0
): number {
  const trackClips = allClips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.startTime - b.startTime);

  let position = startSearchFrom;

  for (const clip of trackClips) {
    if (position + duration <= clip.startTime) {
      return position;
    }
    position = Math.max(position, clip.endTime);
  }

  return position;
}

// ============================================================================
// RIPPLE EDITING
// ============================================================================

/**
 * Ripple delete: move all clips after deleted clip to fill the gap
 */
export function rippleDelete(
  deletedClip: TimelineClip,
  allClips: TimelineClip[],
  trackId?: string
): TimelineClip[] {
  const gapStart = deletedClip.startTime;
  const gapDuration = deletedClip.endTime - deletedClip.startTime;

  return allClips.map((clip) => {
    // Only affect clips on same track (or all tracks if trackId not specified)
    if (trackId && clip.trackId !== trackId) return clip;

    // Move clips that start after the gap
    if (clip.startTime >= deletedClip.endTime) {
      return {
        ...clip,
        startTime: clip.startTime - gapDuration,
        endTime: clip.endTime - gapDuration,
      };
    }

    return clip;
  }).filter((clip) => clip.id !== deletedClip.id);
}

/**
 * Ripple insert: move all clips after insertion point to make room
 */
export function rippleInsert(
  insertTime: number,
  insertDuration: number,
  allClips: TimelineClip[],
  trackId?: string
): TimelineClip[] {
  return allClips.map((clip) => {
    // Only affect clips on same track (or all tracks if trackId not specified)
    if (trackId && clip.trackId !== trackId) return clip;

    // Move clips that start at or after insertion point
    if (clip.startTime >= insertTime) {
      return {
        ...clip,
        startTime: clip.startTime + insertDuration,
        endTime: clip.endTime + insertDuration,
      };
    }

    // Trim clips that overlap the insertion point
    if (clip.startTime < insertTime && clip.endTime > insertTime) {
      return {
        ...clip,
        endTime: insertTime,
      };
    }

    return clip;
  });
}

// ============================================================================
// MAGNETIC TIMELINE
// ============================================================================

/**
 * Magnetically attract clip to adjacent clips
 */
export function magneticSnap(
  clip: TimelineClip,
  allClips: TimelineClip[],
  tolerance: number
): { startTime: number; endTime: number } {
  const trackClips = allClips.filter(
    (c) => c.id !== clip.id && c.trackId === clip.trackId
  );

  let newStartTime = clip.startTime;
  let newEndTime = clip.endTime;
  const duration = clip.endTime - clip.startTime;

  // Find clips before and after
  const clipsBefore = trackClips.filter((c) => c.endTime <= clip.startTime);
  const clipsAfter = trackClips.filter((c) => c.startTime >= clip.endTime);

  // Snap to clip before
  if (clipsBefore.length > 0) {
    const nearestBefore = clipsBefore.sort((a, b) => b.endTime - a.endTime)[0];
    const distanceToBefore = clip.startTime - nearestBefore.endTime;
    if (distanceToBefore >= 0 && distanceToBefore < tolerance) {
      newStartTime = nearestBefore.endTime;
      newEndTime = newStartTime + duration;
    }
  }

  // Snap to clip after
  if (clipsAfter.length > 0) {
    const nearestAfter = clipsAfter.sort((a, b) => a.startTime - b.startTime)[0];
    const distanceToAfter = nearestAfter.startTime - clip.endTime;
    if (distanceToAfter >= 0 && distanceToAfter < tolerance) {
      newEndTime = nearestAfter.startTime;
      newStartTime = newEndTime - duration;
    }
  }

  return { startTime: newStartTime, endTime: newEndTime };
}

// ============================================================================
// TRACK UTILITIES
// ============================================================================

/**
 * Get all clips on a specific track
 */
export function getClipsOnTrack(trackId: string, allClips: TimelineClip[]): TimelineClip[] {
  return allClips.filter((clip) => clip.trackId === trackId);
}

/**
 * Get clips in a time range
 */
export function getClipsInRange(
  range: TimeRange,
  allClips: TimelineClip[]
): TimelineClip[] {
  return allClips.filter(
    (clip) => clip.startTime < range.end && clip.endTime > range.start
  );
}

/**
 * Get clips at a specific time
 */
export function getClipsAtTime(time: number, allClips: TimelineClip[]): TimelineClip[] {
  return allClips.filter((clip) => time >= clip.startTime && time < clip.endTime);
}

/**
 * Sort tracks by index
 */
export function sortTracksByIndex(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => b.index - a.index);
}

/**
 * Reorder track indices after deletion or reordering
 */
export function reorderTrackIndices(tracks: Track[]): Track[] {
  return sortTracksByIndex(tracks).map((track, idx) => ({
    ...track,
    index: tracks.length - 1 - idx,
  }));
}

// ============================================================================
// CLIP UTILITIES
// ============================================================================

/**
 * Calculate clip duration
 */
export function getClipDuration(clip: TimelineClip): number {
  return clip.endTime - clip.startTime;
}

/**
 * Get visible duration of clip (accounting for trim)
 */
export function getClipVisibleDuration(clip: TimelineClip): number {
  const duration = getClipDuration(clip);
  if ('trimStart' in clip && 'trimEnd' in clip) {
    return duration - (clip.trimStart + clip.trimEnd);
  }
  return duration;
}

/**
 * Check if a point is inside a clip's bounds
 */
export function isPointInClip(
  point: { time: number; track: string },
  clip: TimelineClip
): boolean {
  return (
    point.time >= clip.startTime &&
    point.time <= clip.endTime &&
    point.track === clip.trackId
  );
}

/**
 * Split clip at a specific time
 */
export function splitClip(
  clip: TimelineClip,
  splitTime: number
): [TimelineClip, TimelineClip] | null {
  if (splitTime <= clip.startTime || splitTime >= clip.endTime) {
    return null;
  }

  const duration1 = splitTime - clip.startTime;
  const duration2 = clip.endTime - splitTime;

  const clip1 = {
    ...clip,
    id: `${clip.id}-split-1-${Date.now()}`,
    endTime: splitTime,
  };

  const clip2 = {
    ...clip,
    id: `${clip.id}-split-2-${Date.now()}`,
    startTime: splitTime,
  };

  // Adjust trim for media clips
  if ('trimStart' in clip && 'trimEnd' in clip) {
    (clip2 as any).trimStart = (clip as any).trimStart + duration1;
  }

  return [clip1 as TimelineClip, clip2 as TimelineClip];
}

/**
 * Duplicate clip
 */
export function duplicateClip(clip: TimelineClip, offsetTime: number = 0): TimelineClip {
  return {
    ...clip,
    id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    startTime: clip.startTime + offsetTime,
    endTime: clip.endTime + offsetTime,
  };
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Format time as MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Convert time to frame number
 */
export function timeToFrame(time: number, fps: number): number {
  return Math.floor(time * fps);
}

/**
 * Convert frame number to time
 */
export function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

/**
 * Round time to nearest frame
 */
export function roundToFrame(time: number, fps: number): number {
  return frameToTime(timeToFrame(time, fps), fps);
}

// ============================================================================
// SELECTION UTILITIES
// ============================================================================

/**
 * Get bounding box of multiple clips
 */
export function getClipsBoundingBox(clips: TimelineClip[]): TimeRange | null {
  if (clips.length === 0) return null;

  const start = Math.min(...clips.map((c) => c.startTime));
  const end = Math.max(...clips.map((c) => c.endTime));

  return { start, end };
}

/**
 * Check if selection is continuous (no gaps)
 */
export function isSelectionContinuous(clips: TimelineClip[]): boolean {
  if (clips.length <= 1) return true;

  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endTime !== sorted[i + 1].startTime) {
      return false;
    }
  }

  return true;
}

