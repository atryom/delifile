<?php

use App\Http\Controllers\Files\SharingController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Public link page — serves the Angular SPA with injected OG meta tags
// so that messengers and social bots can read file metadata on crawl.
Route::get('/link/{token}', [SharingController::class, 'publicLinkPage']);
