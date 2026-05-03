<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Files\FileController;
use App\Http\Controllers\Files\SharingController;
use App\Http\Controllers\Contacts\ContactController;
use App\Http\Controllers\Organization\OrganizationController;
use App\Http\Controllers\Activity\ActivityController;
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

    // ─── Auth ──────────────────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        // Public
        Route::post('register',          [AuthController::class, 'register']);
        Route::post('login',             [AuthController::class, 'login']);
        Route::post('password/forgot',   [AuthController::class, 'forgotPassword']);
        Route::post('password/reset',    [AuthController::class, 'resetPassword']);

        // Protected
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout',              [AuthController::class, 'logout']);
            Route::post('logout-all',          [AuthController::class, 'logoutAll']);
            Route::get('me',                   [AuthController::class, 'me']);
            Route::get('sessions',             [AuthController::class, 'sessions']);
            Route::delete('sessions/{id}',     [AuthController::class, 'deleteSession']);
            Route::post('password/change',     [AuthController::class, 'changePassword']);
        });
    });

    // ─── Public Link Flow ──────────────────────────────────────────────────
    Route::prefix('links')->group(function () {
        Route::post('{token}/resolve',  [SharingController::class, 'resolveLink']);
        Route::post('{token}/download', [SharingController::class, 'downloadViaLink']);
    });

    // ─── Protected Routes ──────────────────────────────────────────────────
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

        // Organization — Folders
        Route::get('folders',                      [OrganizationController::class, 'listFolders']);
        Route::post('folders',                     [OrganizationController::class, 'createFolder']);
        Route::patch('folders/{id}',               [OrganizationController::class, 'updateFolder']);
        Route::delete('folders/{id}',              [OrganizationController::class, 'deleteFolder']);

        // Organization — Tags
        Route::get('tags',                         [OrganizationController::class, 'listTags']);
        Route::post('tags',                        [OrganizationController::class, 'createTag']);
        Route::delete('tags/{id}',                 [OrganizationController::class, 'deleteTag']);

        // Activity
        Route::get('activity',                     [ActivityController::class, 'index']);
    });
});
