<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\SupportAdminController;
use App\Http\Controllers\Admin\SuggestionAdminController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Files\FileController;
use App\Http\Controllers\Files\FileVersionController;
use App\Http\Controllers\Files\SharingController;
use App\Http\Controllers\Files\SharedFolderFileController;
use App\Http\Controllers\Contacts\ContactController;
use App\Http\Controllers\Contacts\ContactRequestController;
use App\Http\Controllers\Organization\OrganizationController;
use App\Http\Controllers\Activity\ActivityController;
use App\Http\Controllers\Invitations\InvitationController;
use App\Http\Controllers\Links\UrlFileController;
use App\Http\Controllers\Support\SupportTicketController;
use App\Http\Controllers\Support\SuggestionController;
use App\Http\Controllers\Tariff\TariffController;
use App\Http\Controllers\Push\PushController;
use App\Http\Controllers\User\UserSettingsController;
use App\Http\Controllers\User\ApiTokenController;
use App\Http\Controllers\User\InboxController;
use App\Http\Controllers\SharedFolders\SharedFolderController;
use App\Http\Controllers\Comments\CommentThreadController;
use App\Http\Controllers\Comments\CommentController;
use App\Http\Controllers\Comments\CommentSettingsController;
use App\Http\Controllers\Documents\DocumentController;
use App\Http\Controllers\Documents\DocumentLockController;
use App\Http\Controllers\Assets\AssetController;
use App\Http\Controllers\Notifications\NotificationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — FileSpace MVP
|--------------------------------------------------------------------------
|
| All responses follow the unified contract: {result, message, data}
| Protected routes require Laravel Sanctum authentication.
| Public link-flow routes are explicitly marked.
|
*/

Route::prefix('v1')->group(function () {

    // ─── Auth — Public ────────────────────────────────────────────────────────
    Route::prefix('auth')->middleware('throttle:auth')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login',    [AuthController::class, 'login']);

        // Password reset (public)
        Route::post('password/forgot',             [AuthController::class, 'forgotPassword']);
        Route::post('password/verify-reset-token', [AuthController::class, 'verifyResetToken']);
        Route::post('password/reset',              [AuthController::class, 'resetPassword']);

        // Email verification (GET → redirect to SPA)
        Route::get('email/verify/{token}', [AuthController::class, 'verifyEmail'])
            ->name('email.verify');

        // Protected auth endpoints
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout',     [AuthController::class, 'logout']);
            Route::post('logout-all', [AuthController::class, 'logoutAll']);
            Route::get('me',          [AuthController::class, 'me']);
            Route::get('sessions',    [AuthController::class, 'sessions']);
            Route::delete('sessions/{id}', [AuthController::class, 'deleteSession']);
            Route::post('password/change', [AuthController::class, 'changePassword']);

            // Email verification actions
            Route::post('email/resend-verification', [AuthController::class, 'resendVerification']);
            Route::post('email/change',              [AuthController::class, 'changeEmail']);
        });
    });

    // ─── Push Notifications ───────────────────────────────────────────────────
    Route::get('push/vapid-key', [PushController::class, 'vapidKey']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('push/subscribe',        [PushController::class, 'subscribe']);
        Route::delete('push/unsubscribe',    [PushController::class, 'unsubscribe']);
        Route::post('push/device-token',     [PushController::class, 'registerDeviceToken']);
        Route::delete('push/device-token',   [PushController::class, 'unregisterDeviceToken']);
    });

    // ─── Public Link Flow ──────────────────────────────────────────────────────
    Route::prefix('links')->group(function () {
        Route::post('{token}/resolve',  [SharingController::class, 'resolveLink']);
        Route::post('{token}/download', [SharingController::class, 'downloadViaLink']);
    });

    // ─── Public Shared Folder Link Flow ───────────────────────────────────────
    Route::post('shared-links/{token}/resolve', [SharedFolderController::class, 'resolveSharedLink']);
    Route::get('shared-links/{token}/files',    [SharedFolderController::class, 'publicFiles']);

    // ─── Save via link (requires auth) ────────────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('links/{token}/save', [SharingController::class, 'saveViaLink']);
    });

    // ─── Public Invitation Info ────────────────────────────────────────────────
    Route::get('invitations/{token}', [InvitationController::class, 'show']);

    // ─── Protected Routes ──────────────────────────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        // Files — core CRUD
        Route::get('files',                        [FileController::class, 'index']);
        Route::post('files/init-upload',           [FileController::class, 'initUpload']);
        Route::post('files/complete-upload',       [FileController::class, 'completeUpload']);
        Route::get('files/{id}',                   [FileController::class, 'show']);
        Route::delete('files/{id}',                [FileController::class, 'destroy']);
        Route::post('files/{id}/cancel-upload',    [FileController::class, 'cancelUpload']);

        // Files — stable content/preview URLs (used in markdown documents)
        Route::get('files/{id}/content',  [FileController::class, 'content']);
        Route::get('files/{id}/preview',  [FileController::class, 'preview']);

        // Files — actions
        Route::post('files/{id}/download',         [FileController::class, 'download']);
        Route::post('files/{id}/pin',              [FileController::class, 'pin']);
        Route::post('files/{id}/unpin',            [FileController::class, 'unpin']);
        Route::post('files/{id}/favorite',         [FileController::class, 'favorite']);
        Route::post('files/{id}/unfavorite',       [FileController::class, 'unfavorite']);
        Route::post('files/{id}/move-folder',      [FileController::class, 'moveFolder']);
        Route::post('files/{id}/set-tags',         [FileController::class, 'setTags']);
        Route::patch('files/{id}/description',     [FileController::class, 'updateDescription']);
        Route::patch('files/{id}/rename',          [FileController::class, 'rename']);
        Route::patch('files/{id}/task',            [FileController::class, 'updateTask']);
        Route::get('files/{id}/activity',          [FileController::class, 'activity']);
        Route::get('files/{id}/accesses',          [FileController::class, 'accesses']);

        // Files — versioning
        Route::post('files/{id}/versions/init-upload',      [FileVersionController::class, 'initUpload']);
        Route::post('files/{id}/versions/complete-upload',  [FileVersionController::class, 'completeUpload']);
        Route::patch('files/{id}/versions/{vid}',           [FileVersionController::class, 'update']);
        Route::post('files/{id}/versions/{vid}/download',   [FileVersionController::class, 'download']);
        Route::patch('files/{id}/display-name',             [FileVersionController::class, 'updateDisplayName']);

        // Files — new tag/folder actions
        Route::post('files/{id}/attach-tags',  [OrganizationController::class, 'attachTags']);
        Route::post('files/{id}/detach-tags',  [OrganizationController::class, 'detachTags']);
        Route::post('files/{id}/clear-folder', [OrganizationController::class, 'clearFolder']);

        // URL Files
        Route::post('links-preview',  [UrlFileController::class, 'preview']);
        Route::post('url-files',      [UrlFileController::class, 'store']);

        // Documents (Markdown editor)
        Route::post('documents',             [DocumentController::class, 'create']);
        Route::get('documents/{id}',         [DocumentController::class, 'show']);
        Route::put('documents/{id}',         [DocumentController::class, 'update']);
        Route::patch('files/{id}/accesses/{accessId}', [DocumentController::class, 'updateAccess']);

        // Document locks
        Route::post('documents/{id}/lock',             [DocumentLockController::class, 'acquire']);
        Route::post('documents/{id}/lock/heartbeat',   [DocumentLockController::class, 'heartbeat']);
        Route::post('documents/{id}/lock/takeover',    [DocumentLockController::class, 'takeover']);
        Route::delete('documents/{id}/lock',           [DocumentLockController::class, 'release']);

        // Assets
        Route::get('assets/images', [AssetController::class, 'images']);

        // Sharing
        Route::post('files/{id}/share-to-contact',             [SharingController::class, 'shareToContact']);
        Route::delete('files/{id}/share-to-contact/{contact}', [SharingController::class, 'revokeContactAccess']);
        Route::post('files/{id}/create-link',                  [SharingController::class, 'createLink']);
        Route::get('files/{id}/links',                         [SharingController::class, 'listLinks']);
        Route::post('links/{id}/disable',                      [SharingController::class, 'disableLink']);

        // Contacts
        Route::get('contacts',                     [ContactController::class, 'index']);
        Route::post('contacts',                    [ContactController::class, 'store']);
        Route::post('contacts/import',             [ContactController::class, 'import']);
        Route::post('contacts/resolve',            [ContactController::class, 'resolve']);
        Route::get('contacts/{id}',                [ContactController::class, 'show']);
        Route::get('contacts/{id}/history',        [ContactController::class, 'history']);
        Route::delete('contacts/{id}',             [ContactController::class, 'destroy']);

        // Organization — Folders
        Route::get('folders/tree',    [OrganizationController::class, 'folderTree']);
        Route::get('folders',         [OrganizationController::class, 'listFolders']);
        Route::post('folders',        [OrganizationController::class, 'createFolder']);
        Route::patch('folders/{id}',  [OrganizationController::class, 'updateFolder']);
        Route::delete('folders/{id}', [OrganizationController::class, 'deleteFolder']);

        // Organization — Tags
        Route::get('tags',            [OrganizationController::class, 'listTags']);
        Route::post('tags',           [OrganizationController::class, 'createTag']);
        Route::patch('tags/{id}',     [OrganizationController::class, 'updateTag']);
        Route::delete('tags/{id}',    [OrganizationController::class, 'deleteTag']);

        // Invitations
        Route::post('invitations',                    [InvitationController::class, 'send']);
        Route::post('invitations/{token}/accept',     [InvitationController::class, 'accept']);
        Route::post('invitations/{token}/reject',     [InvitationController::class, 'reject']);
        Route::post('invitations/{id}/cancel',        [InvitationController::class, 'cancel']);

        // Activity
        Route::get('activity', [ActivityController::class, 'index']);

        // Tariffs
        Route::get('tariffs',         [TariffController::class, 'index']);
        Route::get('tariffs/usage',   [TariffController::class, 'usage']);
        Route::post('tariffs/request', [TariffController::class, 'request']);

        // User settings
        Route::patch('user/settings', [UserSettingsController::class, 'update']);

        // API tokens
        Route::get('api-tokens',         [ApiTokenController::class, 'index']);
        Route::post('api-tokens',        [ApiTokenController::class, 'store']);
        Route::delete('api-tokens/{id}', [ApiTokenController::class, 'destroy']);

        // Notifications
        Route::prefix('notifications')->group(function () {
            Route::get('',            [NotificationController::class, 'index']);
            Route::get('count',       [NotificationController::class, 'count']);
            Route::post('read-all',   [NotificationController::class, 'markAllRead']);
            Route::post('{id}/read',  [NotificationController::class, 'markRead']);
        });

        // Inbox (received files & shared folders pending acceptance)
        Route::prefix('inbox')->group(function () {
            Route::get('count',                          [InboxController::class, 'count']);
            Route::get('files',                          [InboxController::class, 'files']);
            Route::post('files/accept',                  [InboxController::class, 'acceptFiles']);
            Route::post('files/reject',                  [InboxController::class, 'rejectFiles']);
            Route::get('shared-folders',                 [InboxController::class, 'sharedFolders']);
            Route::post('shared-folders/accept',         [InboxController::class, 'acceptSharedFolders']);
            Route::post('shared-folders/reject',         [InboxController::class, 'rejectSharedFolders']);
        });

        // Contact requests
        Route::get('contact-requests',                      [ContactRequestController::class, 'index']);
        Route::post('contact-requests/{id}/accept',         [ContactRequestController::class, 'accept']);
        Route::post('contact-requests/{id}/reject',         [ContactRequestController::class, 'reject']);

        // Support (user-facing)
        Route::prefix('support')->group(function () {
            // Tickets
            Route::get('tickets',                                             [SupportTicketController::class, 'index']);
            Route::post('tickets',                                            [SupportTicketController::class, 'store']);
            Route::get('tickets/{id}',                                        [SupportTicketController::class, 'show']);
            Route::post('tickets/{id}/messages',                              [SupportTicketController::class, 'addMessage']);
            Route::post('tickets/{id}/confirm',                               [SupportTicketController::class, 'confirm']);
            Route::post('tickets/{id}/mark-read',                             [SupportTicketController::class, 'markRead']);
            Route::get('tickets/{id}/attachments/{attachmentId}',             [SupportTicketController::class, 'downloadAttachment']);
            // Suggestions
            Route::get('suggestions',                                         [SuggestionController::class, 'index']);
            Route::post('suggestions',                                        [SuggestionController::class, 'store']);
            Route::get('suggestions/{id}',                                    [SuggestionController::class, 'show']);
            Route::get('suggestions/{id}/attachments/{attachmentId}',         [SuggestionController::class, 'downloadAttachment']);
        });

        // Shared Folders
        Route::prefix('shared-folders')->group(function () {
            Route::get('',                               [SharedFolderController::class, 'index']);
            Route::get('all-flat',                       [SharedFolderController::class, 'allFlat']);
            Route::post('ensure-root',                   [SharedFolderController::class, 'ensurePersonalRoot']);
            Route::post('',                              [SharedFolderController::class, 'store']);
            Route::patch('{id}',                         [SharedFolderController::class, 'update']);
            Route::delete('{id}',                        [SharedFolderController::class, 'destroy']);
            Route::get('{id}/files',                     [SharedFolderController::class, 'files']);
            Route::post('{id}/init-upload',              [SharedFolderController::class, 'initUpload']);
            Route::post('{id}/complete-upload',          [SharedFolderController::class, 'completeUpload']);
            Route::post('{id}/url-file',                 [SharedFolderController::class, 'addUrlFile']);
            Route::get('{id}/accesses',                  [SharedFolderController::class, 'listAccesses']);
            Route::post('{id}/accesses',                 [SharedFolderController::class, 'addAccess']);
            Route::delete('{id}/accesses/{accessId}',    [SharedFolderController::class, 'removeAccess']);
            Route::get('{id}/links',                     [SharedFolderController::class, 'listLinks']);
            Route::post('{id}/links',                    [SharedFolderController::class, 'createLink']);
            Route::post('{id}/links/{linkId}/disable',   [SharedFolderController::class, 'disableLink']);
            Route::get('{id}/subfolders',                [SharedFolderController::class, 'subfolders']);
            Route::post('{id}/subfolders',               [SharedFolderController::class, 'createSubfolder']);
            Route::post('{id}/files/{fileId}',               [SharedFolderFileController::class, 'addFile']);
            Route::delete('{id}/files/{fileId}',            [SharedFolderFileController::class, 'removeFile']);
            Route::patch('{id}/files/{fileId}/privacy',     [SharedFolderController::class, 'setFilePrivacy']);
            Route::patch('{id}/privacy',                    [SharedFolderController::class, 'setFolderPrivacy']);
            Route::delete('{id}/leave',                     [SharedFolderController::class, 'leave']);
        });

        // Comments — threads
        Route::get('comment-threads',                           [CommentThreadController::class, 'index']);
        Route::get('comment-threads/unread-counters',           [CommentThreadController::class, 'unreadCounters']);
        Route::get('comment-threads/{threadId}',                [CommentThreadController::class, 'show']);
        Route::post('comment-threads/{threadId}/read',          [CommentThreadController::class, 'markRead']);

        // Comments — CRUD
        Route::post('comments',                                 [CommentController::class, 'store']);
        Route::patch('comments/{id}',                           [CommentController::class, 'update']);
        Route::delete('comments/{id}',                          [CommentController::class, 'destroy']);

        // Comment settings
        Route::get('files/{fileId}/comment-settings',           [CommentSettingsController::class, 'getFileSettings']);
        Route::patch('files/{fileId}/comment-settings',         [CommentSettingsController::class, 'updateFileSettings']);
        Route::get('shared-folders/{folderId}/comment-settings',    [CommentSettingsController::class, 'getSharedFolderSettings']);
        Route::patch('shared-folders/{folderId}/comment-settings',  [CommentSettingsController::class, 'updateSharedFolderSettings']);
        Route::patch('local-folders/{folderId}/comment-settings',   [CommentSettingsController::class, 'updateLocalFolderSettings']);

        // File shared folder operations
        Route::post('files/{id}/add-to-my-files',  [SharedFolderFileController::class, 'addToMyFiles']);
        Route::post('files/{id}/shared-folders',   [SharedFolderFileController::class, 'updateSharedFolders']);
        Route::get('files/{id}/shared-folders',    [SharedFolderFileController::class, 'getSharedFolders']);

        // Admin (superuser only)
        Route::middleware(\App\Http\Middleware\SuperUserMiddleware::class)->prefix('admin')->group(function () {
            Route::get('stats',                           [AdminController::class, 'stats']);
            Route::get('users',                           [AdminController::class, 'users']);
            Route::post('notify-all',                     [AdminController::class, 'notifyAll']);
            Route::patch('users/{id}/plan',               [AdminController::class, 'updatePlan']);
            Route::post('users/{id}/block',               [AdminController::class, 'blockUser']);
            Route::post('users/{id}/reset-link',          [AdminController::class, 'generateResetLink']);
            Route::post('users/{id}/reset-sessions',      [AdminController::class, 'resetSessions']);
            Route::post('users/{id}/notify',              [AdminController::class, 'notifyUser']);

            // Support admin
            Route::get('support/tickets',                                     [SupportAdminController::class, 'index']);
            Route::get('support/tickets/{id}',                                [SupportAdminController::class, 'show']);
            Route::post('support/tickets/{id}/take',                          [SupportAdminController::class, 'takeInWork']);
            Route::post('support/tickets/{id}/await-confirmation',            [SupportAdminController::class, 'awaitConfirmation']);
            Route::post('support/tickets/{id}/messages',                      [SupportAdminController::class, 'addMessage']);
            Route::post('support/tickets/{id}/mark-read',                     [SupportAdminController::class, 'markRead']);
            Route::get('support/tickets/{id}/attachments/{attachmentId}',     [SupportAdminController::class, 'downloadAttachment']);

            // Suggestions admin
            Route::get('suggestions',                                         [SuggestionAdminController::class, 'index']);
            Route::get('suggestions/{id}',                                    [SuggestionAdminController::class, 'show']);
            Route::patch('suggestions/{id}/status',                           [SuggestionAdminController::class, 'updateStatus']);
            Route::post('suggestions/{id}/comments',                          [SuggestionAdminController::class, 'addComment']);
            Route::get('suggestions/{id}/attachments/{attachmentId}',         [SuggestionAdminController::class, 'downloadAttachment']);
        });
    });
});
