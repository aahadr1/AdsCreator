/**
 * Adapter layer to convert between AdsCreator editor types and VideoSOS types
 */

import type {
  EditorAsset,
  VideoSOSMediaItem,
  VideoSOSProject,
  VideoSOSTrack,
  VideoSOSKeyFrame,
} from '../../types/editor';
import {
  editorAssetToVideoSOSMedia,
  videoSOSMediaToEditorAsset,
  trackToVideoSOSTrack,
  videoSOSTrackToTrack,
} from '../../types/editor';

/**
 * In-memory data store for VideoSOS (simplified version without IndexedDB)
 */
class VideoSOSDataStore {
  private projects: Map<string, VideoSOSProject> = new Map();
  private tracks: Map<string, VideoSOSTrack[]> = new Map();
  private media: Map<string, VideoSOSMediaItem[]> = new Map();
  private keyFrames: Map<string, VideoSOSKeyFrame[]> = new Map();

  // Projects
  async findProject(id: string): Promise<VideoSOSProject | null> {
    return this.projects.get(id) || null;
  }

  async createProject(project: Omit<VideoSOSProject, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    this.projects.set(id, { id, ...project });
    return id;
  }

  async updateProject(id: string, updates: Partial<VideoSOSProject>): Promise<void> {
    const existing = this.projects.get(id);
    if (existing) {
      this.projects.set(id, { ...existing, ...updates });
    }
  }

  // Tracks
  async getTracksByProject(projectId: string): Promise<VideoSOSTrack[]> {
    return this.tracks.get(projectId) || [];
  }

  async addTrack(track: VideoSOSTrack): Promise<void> {
    const tracks = this.tracks.get(track.projectId) || [];
    tracks.push(track);
    this.tracks.set(track.projectId, tracks);
  }

  // Media
  async getMediaByProject(projectId: string): Promise<VideoSOSMediaItem[]> {
    return this.media.get(projectId) || [];
  }

  async addMedia(media: VideoSOSMediaItem): Promise<void> {
    const items = this.media.get(media.projectId) || [];
    items.push(media);
    this.media.set(media.projectId, items);
  }

  // KeyFrames
  async getKeyFramesByTrack(trackId: string): Promise<VideoSOSKeyFrame[]> {
    return this.keyFrames.get(trackId) || [];
  }

  async addKeyFrame(keyFrame: VideoSOSKeyFrame): Promise<void> {
    const frames = this.keyFrames.get(keyFrame.trackId) || [];
    frames.push(keyFrame);
    this.keyFrames.set(keyFrame.trackId, frames);
  }

  // Initialize project with assets
  async initializeProject(
    projectId: string,
    assets: EditorAsset[]
  ): Promise<void> {
    // Create default project if doesn't exist
    if (!this.projects.has(projectId)) {
      await this.createProject({
        title: 'New Project',
        description: '',
        aspectRatio: '16:9',
        duration: 30000,
      });
    }

    // Convert and add assets
    for (const asset of assets) {
      const media = editorAssetToVideoSOSMedia(asset, projectId);
      await this.addMedia(media);
    }

    // Create default video track
    const defaultTrack: VideoSOSTrack = {
      id: 'main',
      locked: false,
      label: 'Main',
      type: 'video',
      projectId,
    };
    await this.addTrack(defaultTrack);
  }
}

export const videoSOSStore = new VideoSOSDataStore();

