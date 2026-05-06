import { Injectable } from '@angular/core';

export interface GeneratedThumbnail {
  blob: Blob;
  file: File;
  objectUrl: string;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class VideoThumbnailService {

  async generateFromFile(videoFile: File): Promise<GeneratedThumbnail> {
    const videoUrl = URL.createObjectURL(videoFile);
    const video    = document.createElement('video');
    const canvas   = document.createElement('canvas');

    video.preload    = 'metadata';
    video.muted      = true;
    video.playsInline = true;
    video.src        = videoUrl;

    try {
      await this.waitForEvent(video, 'loadedmetadata');

      const duration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 0;
      video.currentTime = duration < 8 ? 1 : Math.min(duration * 0.2, 3);

      await this.waitForEvent(video, 'seeked');

      const ratio  = Math.min(640 / video.videoWidth, 360 / video.videoHeight, 1);
      const width  = Math.round(video.videoWidth  * ratio);
      const height = Math.round(video.videoHeight * ratio);

      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await this.canvasToBlob(canvas);
      const base = videoFile.name.replace(/\.[^.]+$/, '');
      const file = new File([blob], `${base}-thumb.jpg`, { type: 'image/jpeg' });

      return { blob, file, objectUrl: URL.createObjectURL(blob), width, height };
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(videoUrl);
    }
  }

  private waitForEvent(el: HTMLVideoElement, name: 'loadedmetadata' | 'seeked'): Promise<void> {
    return new Promise((resolve, reject) => {
      const ok  = () => { cleanup(); resolve(); };
      const err = () => { cleanup(); reject(new Error(`Event failed: ${name}`)); };
      const cleanup = () => { el.removeEventListener(name, ok); el.removeEventListener('error', err); };
      el.addEventListener(name, ok, { once: true });
      el.addEventListener('error', err, { once: true });
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/jpeg', 0.82);
    });
  }
}
