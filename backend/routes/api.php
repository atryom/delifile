<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\SupportAdminController;
use App\Http\Controllers\Admin\SuggestionAdminController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Files\FileController;
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
use App\Http\Controllers\SharedFolders\SharedFolderController;
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
    Route::prefix('auth')->group(function () {
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
        Route::post('push/subscribe',   [PushController::class, 'subscribe']);
        Route::delete('push/unsubscribe', [PushController::class, 'unsubscribe']);
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

        // Files — actions
        Route::post('files/{id}/download',         [FileController::class, 'download']);
        Route::post('files/{id}/pin',              [FileController::class, 'pin']);
        Route::post('files/{id}/unpin',            [FileController::class, 'unpin']);
        Route::post('files/{id}/favorite',         [FileController::class, 'favorite']);
        Route::post('files/{id}/unfavorite',       [FileController::class, 'unfavorite']);
        Route::post('files/{id}/move-folder',      [FileController::class, 'moveFolder']);
        Route::post('files/{id}/set-tags',         [FileController::class, 'setTags']);
        Route::patch('files/{id}/description',     [FileController::class, 'updateDescription']);
        Route::get('files/{id}/activity',          [FileController::class, 'activity']);
        Route::get('files/{id}/accesses',          [FileController::class, 'accesses']);

        // Files — new tag/folder actions
        Route::post('files/{id}/attach-tags',  [OrganizationController::class, 'attachTags']);
        Route::post('files/{id}/detach-tags',  [OrganizationController::class, 'detachTags']);
        Route::post('files/{id}/clear-folder', [OrganizationController::class, 'clearFolder']);

        // URL Files
        Route::post('links-preview',  [UrlFileController::class, 'preview']);
        Route::post('url-files',      [UrlFileController::class, 'store']);

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
        });

        // File shared folder operations
        Route::post('files/{id}/add-to-my-files',  [SharedFolderFileController::class, 'addToMyFiles']);
        Route::post('files/{id}/shared-folders',   [SharedFolderFileController::class, 'updateSharedFolders']);
        Route::get('files/{id}/shared-folders',    [SharedFolderFileController::class, 'getSharedFolders']);

        // Admin (superuser only)
        Route::middleware(\App\Http\Middleware\SuperUserMiddleware::class)->prefix('admin')->group(function () {
            Route::get('stats',                           [AdminController::class, 'stats']);
            Route::get('users',                           [AdminController::class, 'users']);
            Route::patch('users/{id}/plan',               [AdminController::class, 'updatePlan']);
            Route::post('users/{id}/block',               [AdminController::class, 'blockUser']);
            Route::post('users/{id}/reset-link',          [AdminController::class, 'generateResetLink']);
            Route::post('users/{id}/reset-sessions',      [AdminController::class, 'resetSessions']);

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
