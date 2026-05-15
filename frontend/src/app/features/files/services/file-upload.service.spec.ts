import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FileUploadService } from './file-upload.service';
import { FilesApiService } from '../../../core/api/files-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { VideoThumbnailService } from './video-thumbnail.service';
import { signal } from '@angular/core';

describe('FileUploadService', () => {
  let service: FileUploadService;
  let httpMock: HttpTestingController;
  let filesApi: FilesApiService;
  let authState: { plan: ReturnType<typeof signal<string>> };

  beforeEach(() => {
    authState = { plan: signal('free') };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FileUploadService,
        FilesApiService,
        VideoThumbnailService,
        { provide: AuthStateService, useValue: authState },
      ],
    });
    service = TestBed.inject(FileUploadService);
    httpMock = TestBed.inject(HttpTestingController);
    filesApi = TestBed.inject(FilesApiService);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should start in idle state', () => {
    expect(service.state().phase).toBe('idle');
  });

  it('should reject file exceeding plan limit', () => {
    const bigFile = new File(['x'.repeat(60 * 1024 * 1024)], 'big.mp4');
    service.upload(bigFile).subscribe({
      error: (err) => {
        expect(err.message).toBe('FILE_SIZE_LIMIT_EXCEEDED');
        expect(service.state().phase).toBe('error');
      },
    });
  });

  it('should go through upload lifecycle', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    service.upload(file).subscribe({
      next: (id) => {
        expect(service.state().phase).toBe('done');
        expect(id).toBe('file-1');
      },
    });

    const initReq = httpMock.expectOne('/api/v1/files/init-upload');
    expect(initReq.request.method).toBe('POST');
    expect(initReq.request.body.size).toBe(4);
    initReq.flush({
      result: 'success',
      message: 'OK',
      data: {
        file: { id: 'file-1' },
        upload: { url: 'https://s3.example.com/upload', headers: {} },
        thumbnail: null,
      },
    });

    expect(service.state().phase).toBe('uploading');
    expect(service.state().fileId).toBe('file-1');

    const uploadReq = httpMock.expectOne('https://s3.example.com/upload');
    expect(uploadReq.request.method).toBe('PUT');
    uploadReq.flush(null, { status: 200, statusText: 'OK' });

    const completeReq = httpMock.expectOne('/api/v1/files/complete-upload');
    expect(completeReq.request.method).toBe('POST');
    expect(completeReq.request.body.file_id).toBe('file-1');
    completeReq.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should reset state', () => {
    service.reset();
    expect(service.state().phase).toBe('idle');
    expect(service.state().progress).toBe(0);
    expect(service.state().fileId).toBeNull();
    expect(service.state().error).toBeNull();
  });

  it('should cancel upload', () => {
    service.cancel('file-1');
    const req = httpMock.expectOne('/api/v1/files/file-1/cancel-upload');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
    expect(service.state().phase).toBe('idle');
  });
});
