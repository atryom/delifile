import { TestBed } from '@angular/core/testing';
import { AddVersionDialogComponent } from './add-version-dialog.component';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { VideoThumbnailService } from '../../services/video-thumbnail.service';
import { HttpClientTestingModule, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('AddVersionDialogComponent', () => {
  const mockFilesApi = {
    initVersionUpload: vi.fn(),
    completeVersionUpload: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AddVersionDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: TranslateService, useValue: { instant: (k: string) => k, get: () => of(''), getCurrentLang: () => 'ru', getParsedResult: (key: string) => key, onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) } } },
        VideoThumbnailService,
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'text/plain');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should start in idle phase', () => {
    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'text/plain');
    expect(fixture.componentInstance.phase()).toBe('idle');
  });

  it('should return accept attribute based on mime type', () => {
    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'image/png');
    expect(fixture.componentInstance.acceptAttr()).toBe('image/*');

    fixture.componentRef.setInput('mimeType', 'video/mp4');
    expect(fixture.componentInstance.acceptAttr()).toBe('video/*');

    fixture.componentRef.setInput('mimeType', 'audio/mp3');
    expect(fixture.componentInstance.acceptAttr()).toBe('audio/*');

    fixture.componentRef.setInput('mimeType', 'application/pdf');
    expect(fixture.componentInstance.acceptAttr()).toBe('');
  });

  it('should close on overlay click when not uploading', () => {
    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'text/plain');
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.onOverlayClick();
    expect(closed).toHaveBeenCalled();
  });

  it('should not close on overlay click when uploading', () => {
    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'text/plain');
    fixture.componentInstance.phase.set('uploading');
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.onOverlayClick();
    expect(closed).not.toHaveBeenCalled();
  });

  it('should not close on close button when uploading', () => {
    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'text/plain');
    fixture.componentInstance.phase.set('uploading');
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.onClose();
    expect(closed).not.toHaveBeenCalled();
  });

  it('should handle drag over and leave', () => {
    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'text/plain');
    fixture.componentInstance.onDragOver(new DragEvent('dragover'));
    expect(fixture.componentInstance.isDragOver()).toBe(true);
    fixture.componentInstance.isDragOver.set(false);
  });

  it('should set error phase on failed init', () => {
    mockFilesApi.initVersionUpload.mockReturnValue(of({
      result: 'error', message: 'Failed',
      data: { code: 'ERROR' },
    }));

    const fixture = TestBed.createComponent(AddVersionDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.componentRef.setInput('mimeType', 'text/plain');
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    fixture.componentInstance['startUpload'](file);

    expect(fixture.componentInstance.phase()).toBe('error');
  });
});
