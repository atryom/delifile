import { Injectable } from '@angular/core';
import { GeneratedThumbnail } from './video-thumbnail.service';

@Injectable({ providedIn: 'root' })
export class PdfThumbnailService {

  async generateFromFile(pdfFile: File): Promise<GeneratedThumbnail> {
    // Lazy-load pdfjs-dist to avoid bundle bloat on initial load
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url,
    ).toString();

    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as any, viewport } as any).promise;

    const blob = await this.canvasToBlob(canvas);
    const base = pdfFile.name.replace(/\.[^.]+$/, '');
    const file = new File([blob], `${base}-preview.jpg`, { type: 'image/jpeg' });

    return { blob, file, objectUrl: URL.createObjectURL(blob), width: viewport.width, height: viewport.height };
  }

  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/jpeg', 0.85);
    });
  }
}
