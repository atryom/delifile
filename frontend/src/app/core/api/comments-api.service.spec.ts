import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CommentsApiService } from './comments-api.service';

describe('CommentsApiService', () => {
  let service: CommentsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CommentsApiService,
      ],
    });
    service = TestBed.inject(CommentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get threads', () => {
    service.getThreads('file', 'f1', 'all').subscribe();

    const req = httpMock.expectOne('/api/v1/comment-threads?targetType=file&targetId=f1&scope=all');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { policy: {}, threads: {} } });
  });

  it('should get thread detail', () => {
    service.getThread('th1', 1, 30).subscribe();

    const req = httpMock.expectOne('/api/v1/comment-threads/th1?page=1&per_page=30');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { thread: { id: 'th1' } } });
  });

  it('should mark thread as read', () => {
    service.markRead('th1').subscribe();

    const req = httpMock.expectOne('/api/v1/comment-threads/th1/read');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should get unread counters', () => {
    service.unreadCounters(['th1', 'th2']).subscribe();

    const req = httpMock.expectOne('/api/v1/comment-threads/unread-counters');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ threadIds: ['th1', 'th2'] });
    req.flush({ result: 'success', message: 'OK', data: { counters: { th1: 3 } } });
  });

  it('should create comment', () => {
    service.createComment({
      targetType: 'file',
      targetId: 'f1',
      scope: 'private',
      body: 'Nice!',
    }).subscribe();

    const req = httpMock.expectOne('/api/v1/comments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      targetType: 'file',
      targetId: 'f1',
      scope: 'private',
      body: 'Nice!',
    });
    req.flush({ result: 'success', message: 'OK', data: { comment: { id: 'c1' } } });
  });

  it('should update comment', () => {
    service.updateComment('c1', 'Updated body').subscribe();

    const req = httpMock.expectOne('/api/v1/comments/c1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ body: 'Updated body' });
    req.flush({ result: 'success', message: 'OK', data: { comment: { id: 'c1' } } });
  });

  it('should delete comment', () => {
    service.deleteComment('c1').subscribe();

    const req = httpMock.expectOne('/api/v1/comments/c1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should get file comment settings', () => {
    service.getFileCommentSettings('f1').subscribe();

    const req = httpMock.expectOne('/api/v1/files/f1/comment-settings');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { settings: {} } });
  });

  it('should update file comment settings', () => {
    service.updateFileCommentSettings('f1', { sharedCommentsEnabled: false }).subscribe();

    const req = httpMock.expectOne('/api/v1/files/f1/comment-settings');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ sharedCommentsEnabled: false });
    req.flush({ result: 'success', message: 'OK', data: { settings: {} } });
  });

  it('should get shared folder comment settings', () => {
    service.getSharedFolderCommentSettings('sf1').subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders/sf1/comment-settings');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { settings: {} } });
  });

  it('should update shared folder comment settings', () => {
    service.updateSharedFolderCommentSettings('sf1', { sharedCommentsMode: 'disabled' }).subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders/sf1/comment-settings');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ sharedCommentsMode: 'disabled' });
    req.flush({ result: 'success', message: 'OK', data: { settings: {} } });
  });
});
