<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Files\FileController;
use App\Http\Controllers\Files\SharingController;
use App\Http\Controllers\Contacts\ContactController;
use App\Http\Controllers\Organization\OrganizationController;
use App\Http\Controllers\Activity\ActivityController;
use App\Http\Controllers\Invitations\InvitationController;
use App\Http\Controllers\Links\UrlFileController;
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

    // ─── Public Link Flow ──────────────────────────────────────────────────────
    Route::prefix('links')->group(function () {
        Route::post('{token}/resolve',  [SharingController::class, 'resolveLink']);
        Route::post('{token}/download', [SharingController::class, 'downloadViaLink']);
    });

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
    });
});
