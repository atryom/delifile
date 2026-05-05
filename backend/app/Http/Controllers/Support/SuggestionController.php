<?php

namespace App\Http\Controllers\Support;

use App\Http\Controllers\Controller;
use App\Models\SuggestionTicket;
use App\Services\SupportAttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuggestionController extends Controller
{
    public function __construct(
        private readonly SupportAttachmentService $attachmentService
    ) {}

    /**
     * GET /api/v1/support/suggestions
     */
    public function index(Request $request): JsonResponse
    {
        $user    = $request->user();
        $page    = max(1, (int) $request->get('page', 1));
        $perPage = 10;

        $query = SuggestionTicket::where('user_id', $user->id)
            ->orderByDesc('created_at');

        $total = $query->count();
        $items = $query->with('attachments')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return $this->success('Предложения получены', [
            'items'      => $items->map(fn($s) => $this->formatSuggestion($s))->values(),
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
        ]);
    }

    /**
     * POST /api/v1/support/suggestions
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'body'          => ['required', 'string', 'max:10000'],
            'attachments'   => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file'],
        ]);

        $files = $request->file('attachments', []);
        if (!empty($files)) {
            $error = $this->attachmentService->validateUserFiles($files);
            if ($error) {
                return $this->error($error, 422);
            }
        }

        DB::transaction(function () use ($request, $files, &$suggestion) {
            $suggestion = SuggestionTicket::create([
                'user_id' => $request->user()->id,
                'body'    => $request->input('body'),
                'status'  => 'new',
            ]);

            if (!empty($files)) {
                $this->attachmentService->storeSuggestionAttachments($suggestion->id, $files);
            }
        });

        $suggestion->load('attachments');

        return $this->success('Предложение отправлено', ['suggestion' => $this->formatSuggestion($suggestion)], 201);
    }

    /**
     * GET /api/v1/support/suggestions/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $suggestion = SuggestionTicket::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->with('attachments')
            ->first();

        if (!$suggestion) {
            return $this->notFound('Предложение не найдено');
        }

        return $this->success('Предложение получено', ['suggestion' => $this->formatSuggestion($suggestion)]);
    }

    /**
     * GET /api/v1/support/suggestions/{id}/attachments/{attachmentId}
     */
    public function downloadAttachment(Request $request, string $id, string $attachmentId): JsonResponse
    {
        $suggestion = SuggestionTicket::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$suggestion) {
            return $this->notFound('Предложение не найдено');
        }

        $attachment = \App\Models\SuggestionAttachment::where('suggestion_id', $id)
            ->find($attachmentId);

        if (!$attachment) {
            return $this->notFound('Вложение не найдено');
        }

        return $this->success('Ссылка получена', [
            'url'           => $this->attachmentService->downloadUrl($attachment->storage_key),
            'original_name' => $attachment->original_name,
        ]);
    }

    private function formatSuggestion(SuggestionTicket $s): array
    {
        return [
            'id'          => $s->id,
            'body'        => $s->body,
            'status'      => $s->status,
            'created_at'  => $s->created_at?->toIso8601String(),
            'attachments' => $s->relationLoaded('attachments')
                ? $s->attachments->map(fn($a) => [
                    'id'            => $a->id,
                    'original_name' => $a->original_name,
                    'mime_type'     => $a->mime_type,
                    'size'          => $a->size,
                ])->values()
                : [],
        ];
    }
}
