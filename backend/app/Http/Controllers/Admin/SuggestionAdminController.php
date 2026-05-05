<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SuggestionAdminComment;
use App\Models\SuggestionTicket;
use App\Services\SupportAttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SuggestionAdminController extends Controller
{
    public function __construct(
        private readonly SupportAttachmentService $attachmentService
    ) {}

    /**
     * GET /api/v1/admin/suggestions
     */
    public function index(Request $request): JsonResponse
    {
        $page    = max(1, (int) $request->get('page', 1));
        $perPage = 20;
        $status  = $request->get('status');

        $query = SuggestionTicket::with(['user:id,email,name', 'attachments'])
            ->orderByDesc('created_at');

        if ($status) {
            $query->where('status', $status);
        }

        $total = $query->count();
        $items = $query->skip(($page - 1) * $perPage)->take($perPage)->get();

        return $this->success('Предложения получены', [
            'items'      => $items->map(fn($s) => $this->formatSuggestion($s))->values(),
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
        ]);
    }

    /**
     * GET /api/v1/admin/suggestions/{id}
     */
    public function show(string $id): JsonResponse
    {
        $suggestion = SuggestionTicket::with([
            'user:id,email,name',
            'attachments',
            'adminComments',
        ])->find($id);

        if (!$suggestion) {
            return $this->notFound('Предложение не найдено');
        }

        return $this->success('Предложение получено', ['suggestion' => $this->formatSuggestionDetail($suggestion)]);
    }

    /**
     * PATCH /api/v1/admin/suggestions/{id}/status
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:new,accepted'],
        ]);

        $suggestion = SuggestionTicket::find($id);
        if (!$suggestion) {
            return $this->notFound('Предложение не найдено');
        }

        $suggestion->update(['status' => $request->input('status')]);

        return $this->success('Статус обновлён', ['status' => $suggestion->status]);
    }

    /**
     * POST /api/v1/admin/suggestions/{id}/comments
     */
    public function addComment(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'body' => ['required', 'string', 'max:10000'],
        ]);

        $suggestion = SuggestionTicket::find($id);
        if (!$suggestion) {
            return $this->notFound('Предложение не найдено');
        }

        $comment = SuggestionAdminComment::create([
            'suggestion_id' => $id,
            'body'          => $request->input('body'),
        ]);

        return $this->success('Комментарий добавлен', [
            'comment' => [
                'id'         => $comment->id,
                'body'       => $comment->body,
                'created_at' => $comment->created_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/suggestions/{id}/attachments/{attachmentId}
     */
    public function downloadAttachment(string $id, string $attachmentId): JsonResponse
    {
        $suggestion = SuggestionTicket::find($id);
        if (!$suggestion) {
            return $this->notFound('Предложение не найдено');
        }

        $attachment = \App\Models\SuggestionAttachment::where('suggestion_id', $id)->find($attachmentId);
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
            'user'        => $s->user ? ['id' => $s->user->id, 'email' => $s->user->email, 'name' => $s->user->name] : null,
            'attachments' => $s->relationLoaded('attachments')
                ? $s->attachments->map(fn($a) => ['id' => $a->id, 'original_name' => $a->original_name, 'mime_type' => $a->mime_type, 'size' => $a->size])->values()
                : [],
        ];
    }

    private function formatSuggestionDetail(SuggestionTicket $s): array
    {
        $base = $this->formatSuggestion($s);
        $base['admin_comments'] = $s->relationLoaded('adminComments')
            ? $s->adminComments->map(fn($c) => ['id' => $c->id, 'body' => $c->body, 'created_at' => $c->created_at?->toIso8601String()])->values()
            : [];
        return $base;
    }
}
