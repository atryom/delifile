<?php

use App\Http\Controllers\Files\SharingController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Public link pages — serve the Angular SPA with injected OG meta tags
// so that messengers and social bots can read metadata on crawl.
Route::get('/link/{token}',        [SharingController::class, 'publicLinkPage']);
Route::get('/shared-link/{token}', [SharingController::class, 'publicSharedFolderLinkPage']);
