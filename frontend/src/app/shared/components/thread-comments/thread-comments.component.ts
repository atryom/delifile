import {
  Component, inject, signal, computed, input, output, effect, OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CommentsApiService } from '../../../core/api/comments-api.service';
import {
  CommentItem, CommentTargetType, CommentPolicy,
  CommentThreadDetail, CommentThreadSummary,
} from '../../models/api.models';
import { AuthStateService } from '../../../core/auth/auth-state.service';

@Component({
  selector: 'app-thread-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, NgTemplateOutlet, TranslateModule],
  templateUrl: './thread-comments.component.html',
  styleUrl: './thread-comments.component.scss',
})
export class ThreadCommentsComponent implements OnInit {
  readonly targetType            = input.required<CommentTargetType>();
  readonly targetId              = input.required<string>();
  readonly isOwner               = input<boolean>(false);
  readonly contextSharedFolderId = input<string | null>(null);

  readonly policyChanged = output<CommentPolicy>();

  private readonly commentsApi = inject(CommentsApiService);
  private readonly authState   = inject(AuthStateService);

  readonly currentUserId = computed(() => this.authState.user()?.id ?? null);

  // Tabs
  readonly activeTab = signal<'shared' | 'private'>('shared');

  // State
  readonly loading        = signal(false);
  readonly submitting     = signal(false);
  readonly policy         = signal<CommentPolicy | null>(null);
  readonly sharedSummary  = signal<CommentThreadSummary | null>(null);
  readonly privateSummary = signal<CommentThreadSummary | null>(null);
  readonly sharedThread   = signal<CommentThreadDetail | null>(null);
  readonly privateThread  = signal<CommentThreadDetail | null>(null);

  // Composer
  readonly composerBody    = signal('');
  readonly replyingTo      = signal<CommentItem | null>(null);
  readonly editingComment  = signal<CommentItem | null>(null);
  readonly editBody        = signal('');

  readonly canShowShared = computed(() => {
    const p = this.policy();
    return p?.shared_comments_allowed === true;
  });

  readonly canWriteShared = computed(() => this.policy()?.can_write_shared === true);
  readonly canWritePrivate = computed(() => this.policy()?.can_write_private !== false);

  // Owner settings
  readonly savingSettings = signal(false);
  readonly settingsOpen   = signal(false);

  readonly sharedEnabled   = signal(true);
  readonly overrideValue   = signal<string>('inherit');

  ngOnInit(): void {
    this.loadThreads();
  }

  loadThreads(): void {
    this.loading.set(true);
    this.commentsApi.getThreads(
      this.targetType(),
      this.targetId(),
      'all',
      this.contextSharedFolderId(),
    ).subscribe({
      next: res => {
        const data = res.data;
        this.policy.set(data.policy);
        this.sharedSummary.set(data.threads.shared ?? null);
        this.privateSummary.set(data.threads.private ?? null);
        this.policyChanged.emit(data.policy);

        if (this.targetType() === 'local_folder') {
          this.activeTab.set('private');
        }

        // Init owner settings
        if (this.isOwner()) {
          this.sharedEnabled.set(data.policy.shared_comments_enabled ?? true);
          this.overrideValue.set(data.policy.file_override ?? 'inherit');
        }

        // Auto-load active tab thread
        const tab = this.activeTab();
        if (tab === 'shared' && data.threads.shared && !this.sharedThread()) {
          this.loadThread('shared');
        } else if (tab === 'private' && data.threads.private && !this.privateThread()) {
          this.loadThread('private');
        }
      },
      complete: () => this.loading.set(false),
    });
  }

  selectTab(tab: 'shared' | 'private'): void {
    this.activeTab.set(tab);
    if (tab === 'shared' && !this.sharedThread()) {
      if (this.sharedSummary()) this.loadThread('shared');
    }
    if (tab === 'private' && !this.privateThread()) {
      if (this.privateSummary()) this.loadThread('private');
    }
  }

  loadThread(scope: 'shared' | 'private'): void {
    const summary = scope === 'shared' ? this.sharedSummary() : this.privateSummary();
    if (!summary) return;

    this.commentsApi.getThread(summary.id).subscribe(res => {
      if (scope === 'shared') {
        this.sharedThread.set(res.data.thread);
      } else {
        this.privateThread.set(res.data.thread);
      }
      this.commentsApi.markRead(summary.id).subscribe();
    });
  }

  getActiveThread(): CommentThreadDetail | null {
    return this.activeTab() === 'shared' ? this.sharedThread() : this.privateThread();
  }

  getActiveSummary(): CommentThreadSummary | null {
    return this.activeTab() === 'shared' ? this.sharedSummary() : this.privateSummary();
  }

  startReply(comment: CommentItem): void {
    this.replyingTo.set(comment);
    this.editingComment.set(null);
    this.composerBody.set('');
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  startEdit(comment: CommentItem): void {
    this.editingComment.set(comment);
    this.editBody.set(comment.body ?? '');
    this.replyingTo.set(null);
  }

  cancelEdit(): void {
    this.editingComment.set(null);
    this.editBody.set('');
  }

  submitComment(): void {
    const body = this.composerBody().trim();
    if (!body || this.submitting()) return;

    const summary = this.getActiveSummary();
    const scope: 'shared' | 'private' = this.activeTab();

    this.submitting.set(true);

    const payload = summary
      ? {
          threadId: summary.id,
          body,
          parentCommentId: this.replyingTo()?.id ?? null,
          contextSharedFolderId: this.contextSharedFolderId(),
        }
      : {
          targetType: this.targetType(),
          targetId: this.targetId(),
          scope,
          body,
          parentCommentId: this.replyingTo()?.id ?? null,
          contextSharedFolderId: this.contextSharedFolderId(),
        };

    this.commentsApi.createComment(payload).subscribe({
      next: res => {
        const newComment = res.data.comment;
        // If this was first comment, reload threads to get the new summary
        if (!summary) {
          this.loadThreads();
          // Then also load the thread to show the comment
          setTimeout(() => this.loadThread(scope), 300);
        } else {
          this.addCommentToThread(newComment);
        }
        this.composerBody.set('');
        this.replyingTo.set(null);
        this.submitting.set(false);
      },
      error: () => this.submitting.set(false),
    });
  }

  submitEdit(): void {
    const comment = this.editingComment();
    const body = this.editBody().trim();
    if (!comment || !body || this.submitting()) return;

    this.submitting.set(true);
    this.commentsApi.updateComment(comment.id, body).subscribe({
      next: res => {
        this.updateCommentInThread(res.data.comment);
        this.editingComment.set(null);
        this.editBody.set('');
        this.submitting.set(false);
      },
      error: () => this.submitting.set(false),
    });
  }

  deleteComment(comment: CommentItem): void {
    this.commentsApi.deleteComment(comment.id).subscribe(() => {
      this.markCommentDeleted(comment.id);
    });
  }

  // ─── Owner settings ────────────────────────────────────────────────────────

  saveFileSettings(): void {
    if (this.savingSettings()) return;
    this.savingSettings.set(true);
    this.commentsApi.updateFileCommentSettings(this.targetId(), {
      sharedCommentsEnabled: this.sharedEnabled(),
      sharedCommentsOverride: this.overrideValue(),
    }).subscribe({
      next: () => {
        this.savingSettings.set(false);
        this.settingsOpen.set(false);
        this.loadThreads();
      },
      error: () => this.savingSettings.set(false),
    });
  }

  // ─── Thread mutation helpers ────────────────────────────────────────────────

  private addCommentToThread(comment: CommentItem): void {
    const tab = this.activeTab();
    const update = (thread: CommentThreadDetail | null): CommentThreadDetail | null => {
      if (!thread) return null;
      if (comment.parent_comment_id) {
        const items = thread.items.map(c => {
          if (c.id === comment.parent_comment_id) {
            return { ...c, replies: [...c.replies, comment], replies_count: c.replies_count + 1 };
          }
          return c;
        });
        return { ...thread, items, comments_count: thread.comments_count + 1 };
      }
      return { ...thread, items: [...thread.items, comment], comments_count: thread.comments_count + 1 };
    };

    if (tab === 'shared') {
      this.sharedThread.update(update);
    } else {
      this.privateThread.update(update);
    }
  }

  private updateCommentInThread(updated: CommentItem): void {
    const tab = this.activeTab();
    const replaceComment = (items: CommentItem[]): CommentItem[] =>
      items.map(c => {
        if (c.id === updated.id) return updated;
        return { ...c, replies: c.replies.map(r => r.id === updated.id ? updated : r) };
      });

    const update = (thread: CommentThreadDetail | null): CommentThreadDetail | null =>
      thread ? { ...thread, items: replaceComment(thread.items) } : null;

    if (tab === 'shared') {
      this.sharedThread.update(update);
    } else {
      this.privateThread.update(update);
    }
  }

  private markCommentDeleted(id: string): void {
    const tab = this.activeTab();
    const markDeleted = (items: CommentItem[]): CommentItem[] =>
      items.map(c => {
        if (c.id === id) return { ...c, body: null, is_deleted: true };
        return { ...c, replies: c.replies.map(r => r.id === id ? { ...r, body: null, is_deleted: true } : r) };
      });

    const update = (thread: CommentThreadDetail | null): CommentThreadDetail | null =>
      thread ? { ...thread, items: markDeleted(thread.items) } : null;

    if (tab === 'shared') {
      this.sharedThread.update(update);
    } else {
      this.privateThread.update(update);
    }
  }
}
