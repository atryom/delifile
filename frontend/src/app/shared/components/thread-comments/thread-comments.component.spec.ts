import { TestBed } from '@angular/core/testing';
import { ThreadCommentsComponent } from './thread-comments.component';
import { CommentsApiService } from '../../../core/api/comments-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('ThreadCommentsComponent', () => {
  const mockCommentsApi = {
    getThreads: vi.fn(),
    getThread: vi.fn(),
    markRead: vi.fn(() => of({})),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    updateFileCommentSettings: vi.fn(),
    updateSharedFolderCommentSettings: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCommentsApi.getThreads.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: {
        policy: {
          shared_comments_allowed: true,
          can_write_shared: true,
          can_write_private: true,
          shared_comments_enabled: true,
          shared_comments_mode: 'enabled',
          file_override: 'inherit',
        },
        threads: { shared: null, private: null },
      },
    }));

    await TestBed.configureTestingModule({
      imports: [ThreadCommentsComponent],
      providers: [
        { provide: CommentsApiService, useValue: mockCommentsApi },
        { provide: AuthStateService, useValue: { user: signal({ id: 'user-1' }), isAuthenticated: signal(true) } },
        { provide: TranslateService, useValue: { instant: (k: string) => k, get: () => of(''), getCurrentLang: () => 'ru', getParsedResult: (key: string) => key, onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load threads on init', () => {
    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    fixture.detectChanges();
    expect(mockCommentsApi.getThreads).toHaveBeenCalledWith('file', 'file-1', 'all', null);
  });

  it('should set active tab to private for local_folder', () => {
    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'local_folder');
    fixture.componentRef.setInput('targetId', 'folder-1');
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe('private');
  });

  it('should load shared thread on selectTab', () => {
    mockCommentsApi.getThreads.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: {
        policy: { shared_comments_allowed: true, can_write_shared: true, can_write_private: true },
        threads: { shared: { id: 'thread-1', comments_count: 0 }, private: null },
      },
    }));
    mockCommentsApi.getThread.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { thread: { id: 'thread-1', items: [], comments_count: 0 } },
    }));

    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    fixture.detectChanges();
    fixture.componentInstance.selectTab('shared');

    expect(mockCommentsApi.getThread).toHaveBeenCalledWith('thread-1');
    expect(mockCommentsApi.markRead).toHaveBeenCalledWith('thread-1');
  });

  it('should start and cancel reply', () => {
    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    const comment = { id: 'c-1', body: 'test' } as any;
    fixture.componentInstance.startReply(comment);
    expect(fixture.componentInstance.replyingTo()).toEqual(comment);
    fixture.componentInstance.cancelReply();
    expect(fixture.componentInstance.replyingTo()).toBeNull();
  });

  it('should start and cancel edit', () => {
    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    const comment = { id: 'c-1', body: 'test' } as any;
    fixture.componentInstance.startEdit(comment);
    expect(fixture.componentInstance.editingComment()).toEqual(comment);
    expect(fixture.componentInstance.editBody()).toBe('test');
    fixture.componentInstance.cancelEdit();
    expect(fixture.componentInstance.editingComment()).toBeNull();
  });

  it('should submit a new comment', () => {
    mockCommentsApi.createComment.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { comment: { id: 'c-new', body: 'Hello', replies: [] } },
    }));
    mockCommentsApi.getThreads.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: {
        policy: { shared_comments_allowed: true, can_write_shared: true, can_write_private: true },
        threads: { shared: { id: 'thread-1', comments_count: 0 }, private: null },
      },
    }));
    mockCommentsApi.getThread.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { thread: { id: 'thread-1', items: [], comments_count: 0 } },
    }));

    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    fixture.detectChanges();
    fixture.componentInstance.composerBody.set('Hello');
    fixture.componentInstance.submitComment();

    expect(mockCommentsApi.createComment).toHaveBeenCalled();
    expect(fixture.componentInstance.composerBody()).toBe('');
  });

  it('should submit edit', () => {
    mockCommentsApi.updateComment.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { comment: { id: 'c-1', body: 'Updated' } },
    }));

    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    fixture.componentInstance.editingComment.set({ id: 'c-1', body: 'test' } as any);
    fixture.componentInstance.editBody.set('Updated');
    fixture.componentInstance.submitEdit();

    expect(mockCommentsApi.updateComment).toHaveBeenCalledWith('c-1', 'Updated');
  });

  it('should delete comment', () => {
    mockCommentsApi.deleteComment.mockReturnValue(of({ result: 'success' }));
    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    fixture.componentInstance.deleteComment({ id: 'c-1' } as any);
    expect(mockCommentsApi.deleteComment).toHaveBeenCalledWith('c-1');
  });

  it('should get active thread and summary', () => {
    const fixture = TestBed.createComponent(ThreadCommentsComponent);
    fixture.componentRef.setInput('targetType', 'file');
    fixture.componentRef.setInput('targetId', 'file-1');
    fixture.componentInstance.sharedThread.set({ id: 'thread-1', items: [], comments_count: 0 });
    fixture.componentInstance.activeTab.set('shared');
    expect(fixture.componentInstance.getActiveThread()?.id).toBe('thread-1');
  });
});
