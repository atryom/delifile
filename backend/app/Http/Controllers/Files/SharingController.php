<?php

namespace App\Http\Controllers\Files;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Enums\ShareLinkStatus;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\ContactPendingShare;
use App\Models\DocumentLock;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedFile;
use App\Models\ShareLink;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderLink;
use App\Models\User;
use App\Services\ActivityService;
use App\Services\FileCardBuilder;
use App\Services\FileService;
use App\Services\MimeService;
use App\Services\NotificationService;
use App\Services\PushNotificationService;
use App\Services\S3UrlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class SharingController extends Controller
{
    public function __construct(
        private readonly FileService             $fileService,
        private readonly ActivityService         $activityService,
        private readonly S3UrlService            $s3,
        private readonly MimeService             $mime,
        private readonly FileCardBuilder         $cardBuilder,
        private readonly PushNotificationService $pushService,
        private readonly NotificationService     $notificationService,
    ) {}

    /**
     * POST /api/v1/files/{fileId}/share-to-contact
     * Grant access to a contact.
     */
    public function shareToContact(Request $request, string $fileId): JsonResponse
    {
        $request->validate([
            'contact_id' => 'required|string',
            'can_edit'   => 'sometimes|boolean',
        ]);

        $canEdit = $request->boolean('can_edit', false);

        $file    = File::find($fileId);
        $access  = $file ? FileUserAccess::where('file_id', $file->id)
                               ->where('user_id', $request->user()->id)->first() : null;
        $isOwner = $file?->isOwnedBy($request->user()) ?? false;
        $canShare = $isOwner || ($access?->access_type === AccessType::Shared);

        if (!$file || !$canShare) {
            return $this->notFound('File not found');
        }

        // Non-owners cannot grant edit access to markdown notes
        if (!$isOwner && $file->isMarkdownDocument()) {
            $canEdit = false;
        }

        if (!$file->isAvailable()) {
            return $this->error(__('messages.sharing.file_not_available'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $contact = Contact::where('id', $request->contact_id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        // Auto-resolve contact by email/phone if not yet resolved
        if (!$contact->isRegistered() && $contact->email) {
            $resolved = User::where('email', $contact->email)->first();
            if ($resolved) {
                $contact->update(['resolved_user_id' => $resolved->id]);
                $contact->refresh();
            }
        }

        if (!$contact->isRegistered()) {
            // Contact hasn't accepted invitation yet — queue the file as pending
            DB::transaction(function () use ($file, $contact, $request, $canEdit) {
                ContactPendingShare::firstOrCreate([
                    'contact_id' => $contact->id,
                    'file_id'    => $file->id,
                ], [
                    'sender_user_id' => $request->user()->id,
                    'can_edit'       => $canEdit,
                ]);

                $this->activityService->log($file, $request->user(), ActivityType::SharedToContact, [
                    'contact_id'   => $contact->id,
                    'contact_name' => $contact->name,
                    'pending'      => true,
                ]);
            });

            return $this->success(__('messages.sharing.access_pending'), [
                'share' => [
                    'contact_id' => $contact->id,
                    'status'     => 'pending',
                ],
            ]);
        }

        $recipientUser = $contact->resolvedUser;

        DB::transaction(function () use ($file, $contact, $request, $recipientUser, $canEdit) {
            $autoAdd = $recipientUser ? ($recipientUser->auto_add_received_files ?? true) : true;

            $alreadyHasAccess = $recipientUser && FileUserAccess::where('file_id', $file->id)
                ->where('user_id', $recipientUser->id)
                ->exists();

            if ($autoAdd || $alreadyHasAccess) {
                // If user already has any FileUserAccess, upgrade/confirm shared access directly
                // (avoids a stale pending entry when user can already access the file)
                $existing = FileUserAccess::where('file_id', $file->id)
                    ->where('user_id', $contact->resolved_user_id)
                    ->first();
                if ($existing) {
                    // Only update contact_id if not yet linked; don't downgrade access type
                    if (!$existing->contact_id) {
                        $existing->contact_id = $contact->id;
                        $existing->save();
                    }
                } else {
                    FileUserAccess::create([
                        'file_id'     => $file->id,
                        'user_id'     => $contact->resolved_user_id,
                        'access_type' => AccessType::Shared,
                        'contact_id'  => $contact->id,
                        'can_edit'    => $canEdit,
                    ]);
                }
            } else {
                // If the recipient already has folder-level access to this file,
                // grant FileUserAccess directly instead of creating a pending entry.
                if ($this->userHasSharedFolderAccess($recipientUser, $file)) {
                    FileUserAccess::create([
                        'file_id'     => $file->id,
                        'user_id'     => $contact->resolved_user_id,
                        'access_type' => AccessType::Shared,
                        'contact_id'  => $contact->id,
                        'can_edit'    => $canEdit,
                    ]);
                } else {
                    PendingReceivedFile::firstOrCreate([
                        'file_id'           => $file->id,
                        'recipient_user_id' => $recipientUser->id,
                    ], [
                        'sender_user_id' => $request->user()->id,
                        'can_edit'       => $canEdit,
                    ]);
                }
            }

            $this->activityService->log($file, $request->user(), ActivityType::SharedToContact, [
                'contact_id'   => $contact->id,
                'contact_name' => $contact->name,
            ]);

            // Log activity for the recipient as notification
            if ($recipientUser) {
                $this->activityService->log($file, $recipientUser, ActivityType::FileReceived, [
                    'shared_by' => $request->user()->email,
                ]);

                $senderName = $request->user()->name ?? $request->user()->email;
                $this->pushService->sendToUser(
                    $recipientUser,
                    __('notifications.new_file_title'),
                    $file->original_name . ' — от ' . $senderName,
                    ($autoAdd || $alreadyHasAccess)
                        ? config('app.url') . '/files/' . $file->id
                        : config('app.url') . '/communication/received',
                );
                $this->notificationService->notifyFileShared(
                    $recipientUser,
                    $senderName,
                    $file->display_name ?? $file->original_name,
                    $file->id,
                );
            }
        });

        return $this->success(__('messages.sharing.access_granted'), [
            'share' => [
                'contact_id' => $contact->id,
                'status'     => 'shared',
            ],
        ]);
    }

    /**
     * DELETE /api/v1/files/{fileId}/share-to-contact/{contactId}
     * Revoke access from a contact.
     */
    public function revokeContactAccess(Request $request, string $fileId, string $contactId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $contact = Contact::where('id', $contactId)
            ->where('user_id', $request->user()->id)
            ->first();

        if ($contact) {
            $revokedUserId = $contact->resolved_user_id;

            FileUserAccess::where('file_id', $file->id)
                ->where('user_id', $revokedUserId)
                ->delete();

            // Also remove any pending share for this contact (covers unregistered contacts).
            ContactPendingShare::where('contact_id', $contact->id)
                ->where('file_id', $file->id)
                ->delete();

            // If the revoked user is the current task assignee, reassign to the owner.
            if ($file->is_task && $file->task_assigned_user_id === $revokedUserId) {
                $file->update(['task_assigned_user_id' => $file->owner_id]);
            }

            // Release document lock if the revoked user currently holds it.
            DocumentLock::where('file_id', $file->id)
                ->where('user_id', $revokedUserId)
                ->delete();

            $this->activityService->log($file, $request->user(), ActivityType::ShareRevoked, [
                'contact_id' => $contactId,
            ]);
        } else {
            // Fallback: contactId may be a numeric user ID for direct-access records
            $targetUserId = is_numeric($contactId) ? (int) $contactId : null;
            if (!$targetUserId) {
                return $this->notFound('Contact not found');
            }

            $deletedAccess   = FileUserAccess::where('file_id', $file->id)
                ->where('user_id', $targetUserId)
                ->delete();

            $deletedPending  = PendingReceivedFile::where('file_id', $file->id)
                ->where('recipient_user_id', $targetUserId)
                ->delete();

            if (!$deletedAccess && !$deletedPending) {
                return $this->notFound('Access not found');
            }

            // If the revoked user is the current task assignee, reassign to the owner.
            if ($file->is_task && $file->task_assigned_user_id === $targetUserId) {
                $file->update(['task_assigned_user_id' => $file->owner_id]);
            }

            // Release document lock if the revoked user currently holds it.
            DocumentLock::where('file_id', $file->id)
                ->where('user_id', $targetUserId)
                ->delete();

            $this->activityService->log($file, $request->user(), ActivityType::ShareRevoked, [
                'user_id' => $targetUserId,
            ]);
        }

        return $this->success(__('messages.sharing.access_revoked'));
    }

    /**
     * POST /api/v1/files/{fileId}/create-link
     * Create a public share link.
     */
    public function createLink(Request $request, string $fileId): JsonResponse
    {
        $request->validate([
            'ttl_hours'  => 'nullable|integer|min:1|max:720',
            'allow_save' => 'nullable|boolean',
        ]);

        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        if (!$file->isAvailable()) {
            return $this->error(__('messages.sharing.file_not_available_link'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $ttlHours  = (int) ($request->ttl_hours ?? config('app.file_default_ttl_hours', 12));
        $allowSave = (bool) $request->input('allow_save', false);

        $link = DB::transaction(function () use ($file, $request, $ttlHours, $allowSave) {
            $link = ShareLink::create([
                'file_id'    => $file->id,
                'created_by' => $request->user()->id,
                'status'     => ShareLinkStatus::Active,
                'ttl_hours'  => $ttlHours,
                'expires_at' => now()->addHours($ttlHours),
                'allow_save' => $allowSave,
            ]);

            $this->activityService->log($file, $request->user(), ActivityType::LinkCreated, [
                'link_id'    => $link->id,
                'ttl_hours'  => $ttlHours,
                'allow_save' => $allowSave,
            ]);

            return $link;
        });

        return $this->success(__('messages.sharing.link_created'), [
            'link' => [
                'id'         => $link->id,
                'url'        => $link->url,
                'allow_save' => $link->allow_save,
                'expires_at' => $link->expires_at?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * GET /api/v1/files/{fileId}/links
     */
    public function listLinks(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $links = $file->shareLinks()
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($l) => [
                'id'         => $l->id,
                'url'        => $l->url,
                'status'     => $l->status->value,
                'ttl_hours'  => $l->ttl_hours,
                'allow_save' => $l->allow_save,
                'expires_at' => $l->expires_at?->toIso8601String(),
                'created_at' => $l->created_at?->toIso8601String(),
                'created_by' => $l->created_by,
            ]);

        return $this->success(__('messages.sharing.links_fetched'), [
            'items' => $links,
        ]);
    }

    /**
     * POST /api/v1/links/{linkId}/disable
     */
    public function disableLink(Request $request, string $linkId): JsonResponse
    {
        $link = ShareLink::find($linkId);

        if (!$link) {
            return $this->notFound('Link not found');
        }

        if ($link->created_by !== $request->user()->id && !$link->file->isOwnedBy($request->user())) {
            return $this->forbidden();
        }

        $link->update(['status' => ShareLinkStatus::Disabled]);

        $this->activityService->log($link->file, $request->user(), ActivityType::LinkDisabled, [
            'link_id' => $link->id,
        ]);

        return $this->success(__('messages.sharing.link_disabled'));
    }

    /**
     * POST /api/v1/links/{token}/resolve
     * Public endpoint — resolve link metadata without auth.
     */
    public function resolveLink(Request $request, string $token): JsonResponse
    {
        $link = ShareLink::where('token', $token)->with('file')->first();

        if (!$link || !$link->isValid()) {
            return $this->error(__('messages.sharing.link_invalid'), 'LINK_INVALID', [], 404);
        }

        $previewUrl = null;
        $viewUrl    = null;
        $mime       = $link->file->mime_type ?? '';

        $fileData = $this->cardBuilder->buildPublicItem($link->file);

        return $this->success(__('messages.sharing.link_resolved'), [
            'file' => $fileData,
            'link' => [
                'expires_at' => $link->expires_at?->toIso8601String(),
                'allow_save' => $link->allow_save,
            ],
        ]);
    }

    /**
     * POST /api/v1/links/{token}/download
     * Public endpoint — generate download URL via link token.
     */
    public function downloadViaLink(Request $request, string $token): JsonResponse
    {
        $link = ShareLink::where('token', $token)->with('file')->first();

        if (!$link || !$link->isValid()) {
            return $this->error(__('messages.sharing.link_invalid'), 'LINK_INVALID', [], 404);
        }

        if (!$link->file->isAvailable()) {
            return $this->error(__('messages.files.not_available'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $url = app(FileService::class)->generateDownloadUrl($link->file);

        return $this->success(__('messages.files.download_url'), [
            'url'        => $url,
            'expires_in' => 3600,
        ]);
    }

    /**
     * POST /api/v1/links/{token}/save
     * Authenticated — save a file from a public link to the user's own account.
     */
    public function saveViaLink(Request $request, string $token): JsonResponse
    {
        $link = ShareLink::where('token', $token)->with('file')->first();

        if (!$link || !$link->isValid()) {
            return $this->error(__('messages.sharing.link_invalid'), 'LINK_INVALID', [], 404);
        }

        if (!$link->allow_save) {
            return $this->error('Saving is not allowed for this link.', 'SAVE_NOT_ALLOWED', [], 403);
        }

        if (!$link->file->isAvailable()) {
            return $this->error(__('messages.files.not_available'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $user = $request->user();

        // Don't save to own files
        if ($link->file->isOwnedBy($user)) {
            return $this->error('Это ваш файл.', 'OWN_FILE', [], 422);
        }

        $alreadySaved = DB::transaction(function () use ($link, $user) {
            $existing = FileUserAccess::where('file_id', $link->file->id)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return true;
            }

            FileUserAccess::create([
                'file_id'     => $link->file->id,
                'user_id'     => $user->id,
                'access_type' => AccessType::Saved,
                'saved_at'    => now(),
            ]);

            $this->activityService->log($link->file, $user, ActivityType::SavedViaLink, [
                'link_id' => $link->id,
            ]);

            return false;
        });

        if ($alreadySaved) {
            return $this->error('Файл уже есть в вашем аккаунте.', 'ALREADY_SAVED', [], 422);
        }

        return $this->success('Файл сохранён в ваш аккаунт.', [
            'file_id' => $link->file->id,
        ]);
    }

    /**
     * GET /link/{token}
     * Public SPA page with injected OG meta tags for social sharing previews.
     */
    public function publicLinkPage(string $token): Response
    {
        $link = ShareLink::where('token', $token)->with('file')->first();

        $ogTags = '';

        if ($link && $link->isValid()) {
            $file = $link->file;
            $mime = $file->mime_type ?? '';
            $url  = config('app.url') . '/link/' . $token;

            if ($file->content_kind === 'url_file') {
                $title       = $file->link_title ?: $file->original_name;
                $description = $file->link_description ?? 'Файл из DeliFile';
                $image       = $file->link_image_url ?? '';
            } else {
                $title       = $file->original_name;
                $description = $this->buildOgDescription($mime, $file->size);
                $image       = $this->buildOgImage($file, $mime);
            }

            $ogTags = $this->renderOgTags(
                e($title),
                e($description),
                e($image),
                e($url),
            );
        }

        $indexPath = base_path('../public/index.html');
        $html = file_exists($indexPath)
            ? file_get_contents($indexPath)
            : '<!doctype html><html><head></head><body><app-root></app-root></body></html>';

        $html = str_replace('</head>', $ogTags . '</head>', $html);

        return response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    /**
     * GET /shared-link/{token}
     * Public SPA page with injected OG meta tags for shared folder links.
     */
    public function publicSharedFolderLinkPage(string $token): Response
    {
        $link = SharedFolderLink::where('token', $token)->with('folder')->first();

        $ogTags = '';

        if ($link && $link->isValid() && $link->folder) {
            $url    = config('app.url') . '/shared-link/' . $token;
            $ogTags = $this->renderOgTags(
                e($link->folder->name),
                e('Папка в DeliFile'),
                '',
                e($url),
            );
        }

        $indexPath = base_path('../public/index.html');
        $html = file_exists($indexPath)
            ? file_get_contents($indexPath)
            : '<!doctype html><html><head></head><body><app-root></app-root></body></html>';

        $html = str_replace('</head>', $ogTags . '</head>', $html);

        return response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    private function userHasSharedFolderAccess(User $user, File $file): bool
    {
        $folderIds = $file->sharedFolderFiles()->pluck('shared_folder_id')->toArray();
        if (empty($folderIds)) {
            return false;
        }

        $allFolderIds = $folderIds;
        $folders = SharedFolder::whereIn('id', $folderIds)->get();
        foreach ($folders as $folder) {
            $allFolderIds = array_merge($allFolderIds, $folder->ancestorIds());
        }

        return SharedFolderAccess::where('user_id', $user->id)
            ->whereIn('shared_folder_id', array_unique($allFolderIds))
            ->exists();
    }

    private function buildOgDescription(string $mime, int $size): string
    {
        $category = $this->mime->label($mime);

        $sizeStr = match(true) {
            $size >= 1024 ** 3 => round($size / 1024 ** 3, 1) . ' ГБ',
            $size >= 1024 ** 2 => round($size / 1024 ** 2, 1) . ' МБ',
            $size >= 1024      => round($size / 1024, 1) . ' КБ',
            default            => $size . ' Б',
        };

        return "{$category}, {$sizeStr} — поделились через DeliFile";
    }

    private function buildOgImage(File $file, string $mime): string
    {
        return $this->s3->resolveOgImageUrl($file, $mime);
    }

    private function renderOgTags(string $title, string $description, string $image, string $url): string
    {
        $hasImage = $image !== '';
        $card     = $hasImage ? 'summary_large_image' : 'summary';

        $tags  = "\n";
        $tags .= "  <meta property=\"og:type\"        content=\"website\">\n";
        $tags .= "  <meta property=\"og:site_name\"   content=\"DeliFile\">\n";
        $tags .= "  <meta property=\"og:url\"         content=\"{$url}\">\n";
        $tags .= "  <meta property=\"og:title\"       content=\"{$title}\">\n";
        $tags .= "  <meta property=\"og:description\" content=\"{$description}\">\n";
        if ($hasImage) {
            $tags .= "  <meta property=\"og:image\"       content=\"{$image}\">\n";
        }
        $tags .= "  <meta name=\"twitter:card\"        content=\"{$card}\">\n";
        $tags .= "  <meta name=\"twitter:title\"       content=\"{$title}\">\n";
        $tags .= "  <meta name=\"twitter:description\" content=\"{$description}\">\n";
        if ($hasImage) {
            $tags .= "  <meta name=\"twitter:image\"      content=\"{$image}\">\n";
        }
        $tags .= "  ";

        return $tags;
    }
}
