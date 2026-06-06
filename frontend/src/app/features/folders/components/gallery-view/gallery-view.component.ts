import {
  Component, input, output, signal, computed, ChangeDetectionStrategy, ElementRef, ViewChild,
} from '@angular/core';
import { inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { CommentsApiService } from '../../../../core/api/comments-api.service';
import {
  SharedFolderFileItem,
  CommentItem,
  CommentTargetType,
  CommentScope,
} from '../../../../shared/models/api.models';

@Component({
  selector: 'app-gallery-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule],
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './gallery-view.component.html',
  styleUrl: './gallery-view.component.scss',
})
export class GalleryViewComponent {
  readonly files           = input.required<SharedFolderFileItem[]>();
  readonly contextFolderId = input<string | null>(null);
  readonly canEdit         = input<boolean>(false);
  readonly removeFile      = output<string>();
  readonly viewFile        = output<SharedFolderFileItem>();

  @ViewChild('commentsEnd') private commentsEnd?: ElementRef<HTMLDivElement>;
  @ViewChild('commentInputEl') private commentInputEl?: ElementRef<HTMLTextAreaElement>;

  private readonly filesApi    = inject(FilesApiService);
  private readonly commentsApi = inject(CommentsApiService);

  readonly mediaFiles = computed(() =>
    this.files().filter(
      f => f.content_kind === 'binary_file' && f.mime_type &&
           (f.mime_type.startsWith('image/') || f.mime_type.startsWith('video/')),
    ),
  );

  // Lightbox state
  readonly lightboxOpen  = signal(false);
  readonly lightboxIndex = signal(0);
  readonly currentFile   = computed(() => this.mediaFiles()[this.lightboxIndex()] ?? null);

  // Per-file like overrides (optimistic)
  private readonly _likeStates = signal<Map<string, { count: number; liked: boolean }>>(new Map());
  readonly likeLoading = signal(false);

  // Comments
  readonly commentsLoading    = signal(false);
  readonly threadId           = signal<string | null>(null);
  readonly comments           = signal<CommentItem[]>([]);
  readonly commentsCount      = signal(0);
  readonly canWriteComments   = signal(true);
  readonly commentInput       = signal('');
  readonly commentSubmitting  = signal(false);

  // ── Grid helpers ───────────────────────────────────────────────────────────

  getLikeCount(fileId: string): number {
    const ov = this._likeStates().get(fileId);
    if (ov !== undefined) return ov.count;
    return this.mediaFiles().find(f => f.id === fileId)?.likes_count ?? 0;
  }

  isLiked(fileId: string): boolean {
    const ov = this._likeStates().get(fileId);
    if (ov !== undefined) return ov.liked;
    return this.mediaFiles().find(f => f.id === fileId)?.is_liked ?? false;
  }

  getCommentsCount(fileId: string): number {
    return this.mediaFiles().find(f => f.id === fileId)?.comments_count ?? 0;
  }

  isVideo(file: SharedFolderFileItem): boolean {
    return !!file.mime_type?.startsWith('video/');
  }

  // ── Lightbox open / close ─────────────────────────────────────────────────

  open(index: number): void {
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
    this._loadComments();
  }

  close(): void {
    this.lightboxOpen.set(false);
    this.threadId.set(null);
    this.comments.set([]);
    this.commentsCount.set(0);
    this.commentInput.set('');
  }

  prev(): void {
    if (this.lightboxIndex() > 0) {
      this.lightboxIndex.update(i => i - 1);
      this._loadComments();
    }
  }

  next(): void {
    if (this.lightboxIndex() < this.mediaFiles().length - 1) {
      this.lightboxIndex.update(i => i + 1);
      this._loadComments();
    }
  }

  onKey(e: KeyboardEvent): void {
    if (!this.lightboxOpen()) return;
    if (e.key === 'Escape')     { this.close(); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { this.prev();  e.preventDefault(); }
    if (e.key === 'ArrowRight') { this.next();  e.preventDefault(); }
  }

  // ── Like ──────────────────────────────────────────────────────────────────

  toggleLike(): void {
    const file = this.currentFile();
    if (!file || this.likeLoading()) return;

    const curCount  = this.getLikeCount(file.id);
    const curLiked  = this.isLiked(file.id);
    const optimistic = { count: curLiked ? curCount - 1 : curCount + 1, liked: !curLiked };

    this._likeStates.update(m => new Map(m).set(file.id, optimistic));
    this.likeLoading.set(true);

    const obs = curLiked ? this.filesApi.unlikeFile(file.id) : this.filesApi.likeFile(file.id);
    obs.subscribe({
      next: res => {
        this._likeStates.update(m => new Map(m).set(file.id, {
          count: res.data.likes_count,
          liked: res.data.is_liked,
        }));
        this.likeLoading.set(false);
      },
      error: () => {
        this._likeStates.update(m => new Map(m).set(file.id, { count: curCount, liked: curLiked }));
        this.likeLoading.set(false);
      },
    });
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  focusCommentInput(): void {
    setTimeout(() => this.commentInputEl?.nativeElement.focus(), 50);
  }

  onCommentEnter(e: Event): void {
    if (!(e as KeyboardEvent).shiftKey) {
      e.preventDefault();
      this.submitComment();
    }
  }

  submitComment(): void {
    const body = this.commentInput().trim();
    const file = this.currentFile();
    if (!body || this.commentSubmitting() || !file) return;

    this.commentSubmitting.set(true);
    const payload = this.threadId()
      ? { threadId: this.threadId()!, body, contextSharedFolderId: this.contextFolderId() }
      : {
          targetType: 'file' as CommentTargetType,
          targetId: file.id,
          scope: 'shared' as CommentScope,
          body,
          contextSharedFolderId: this.contextFolderId(),
        };

    this.commentsApi.createComment(payload).subscribe({
      next: res => {
        this.comments.update(c => [...c, res.data.comment]);
        this.commentsCount.update(n => n + 1);
        this.commentInput.set('');
        this.commentSubmitting.set(false);
        if (!this.threadId()) {
          this.commentsApi
            .getThreads('file', file.id, 'shared', this.contextFolderId())
            .subscribe(r => this.threadId.set(r.data.threads.shared?.id ?? null));
        }
        setTimeout(() => this.commentsEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' }), 50);
      },
      error: () => this.commentSubmitting.set(false),
    });
  }

  // ── Owner display ─────────────────────────────────────────────────────────

  getUserDisplayName(): string {
    const owner = this.currentFile()?.owner;
    return owner?.name ?? owner?.email ?? 'Пользователь';
  }

  getUserInitial(): string {
    return this.getUserDisplayName().charAt(0).toUpperCase() || '?';
  }

  getCommentAuthorName(comment: CommentItem): string {
    return comment.author.name || `Пользователь ${comment.author.id}`;
  }

  getCommentInitial(comment: CommentItem): string {
    return this.getCommentAuthorName(comment).charAt(0).toUpperCase();
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private _loadComments(): void {
    const file = this.currentFile();
    if (!file) return;
    this.commentsLoading.set(true);
    this.threadId.set(null);
    this.comments.set([]);
    this.commentsCount.set(0);
    this.commentInput.set('');

    this.commentsApi
      .getThreads('file', file.id, 'shared', this.contextFolderId())
      .subscribe({
        next: res => {
          this.canWriteComments.set(res.data.policy.can_write_shared);
          const summary = res.data.threads.shared;
          if (summary) {
            this.threadId.set(summary.id);
            this.commentsCount.set(summary.comments_count);
            this.commentsApi.getThread(summary.id).subscribe({
              next: r => {
                this.comments.set(r.data.thread.items);
                this.commentsLoading.set(false);
              },
              error: () => this.commentsLoading.set(false),
            });
          } else {
            this.commentsLoading.set(false);
          }
        },
        error: () => this.commentsLoading.set(false),
      });
  }
}
