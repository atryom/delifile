<?php

namespace App\Http\Controllers\Files;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileLike;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FileLikeController extends Controller
{
    public function store(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        $user = $request->user();

        FileLike::firstOrCreate(['file_id' => $fileId, 'user_id' => $user->id]);

        $count = FileLike::where('file_id', $fileId)->count();

        return $this->success('Liked', ['likes_count' => $count, 'is_liked' => true]);
    }

    public function destroy(Request $request, string $fileId): JsonResponse
    {
        $user = $request->user();

        FileLike::where('file_id', $fileId)->where('user_id', $user->id)->delete();

        $count = FileLike::where('file_id', $fileId)->count();

        return $this->success('Unliked', ['likes_count' => $count, 'is_liked' => false]);
    }
}
