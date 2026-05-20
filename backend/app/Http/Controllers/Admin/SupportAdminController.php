<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Services\PushNotificationService;
use App\Services\SupportAttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportAdminController extends Controller
{
    public function __construct(
        private readonly SupportAttachmentService $attachmentService,
        private readonly PushNotificationService  $pushService,
    ) {}

    /**
     * GET /api/v1/admin/support/tickets
     */
    public function index(Request $request): JsonResponse
    {
        $page    = max(1, (int) $request->get('page', 1));
        $perPage = 20;
        $status  = $request->get('status');

        $baseQuery = fn() => SupportTicket::query()->when($status, fn($q) => $q->where('status', $status));

        $total = $baseQuery()->count();

        $tickets = $baseQuery()
            ->with(['user:id,email,name'])
            ->withCount(['messages as unread_count' => fn($q) =>
                $q->where('is_admin_message', false)->whereNull('read_at')
            ])
            ->addSelect([
                'last_message_at' => SupportMessage::select('created_at')
                    ->whereColumn('ticket_id', 'support_tickets.id')
                    ->latest()
                    ->limit(1),
            ])
            ->orderByRaw('COALESCE(last_message_at, updated_at) DESC')
            ->forPage($page, $perPage)
            ->get();

        return $this->success('Обращения получены', [
            'items'      => $tickets->map(fn($t) => $this->formatListItem($t))->values(),
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
        ]);
    }

    /**
     * GET /api/v1/admin/support/tickets/{id}
     */
    public function show(string $id): JsonResponse
    {
        $ticket = SupportTicket::with([
            'user:id,email,name',
            'messages' => fn($q) => $q->orderBy('created_at'),
            'messages.attachments',
        ])->find($id);

        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        return $this->success('Обращение получено', ['ticket' => $this->formatDetail($ticket)]);
    }

    /**
     * POST /api/v1/admin/support/tickets/{id}/take
     * Transition: new → in_progress
     */
    public function takeInWork(string $id): JsonResponse
    {
        $ticket = SupportTicket::find($id);
        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        if ($ticket->status !== 'new') {
            return $this->error('Обращение уже взято в работу', 422);
        }

        $ticket->update(['status' => 'in_progress', 'taken_at' => now()]);

        return $this->success('Обращение взято в работу', ['status' => 'in_progress']);
    }

    /**
     * POST /api/v1/admin/support/tickets/{id}/await-confirmation
     * Transition: in_progress → awaiting_confirmation
     */
    public function awaitConfirmation(string $id): JsonResponse
    {
        $ticket = SupportTicket::with(['user'])->find($id);
        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        if ($ticket->status !== 'in_progress') {
            return $this->error('Обращение должно быть в статусе «В работе»', 422);
        }

        $now = now();
        $ticket->update(['status' => 'awaiting_confirmation', 'awaiting_at' => $now]);

        $this->pushService->sendToUser(
            $ticket->user,
            'Ваше обращение #' . $ticket->id . ' ожидает подтверждения',
            'Поддержка считает вопрос решённым. Подтвердите закрытие или напишите, если проблема осталась.',
            config('app.url') . '/support/' . $ticket->id,
        );

        return $this->success('Ожидает подтверждения пользователя', ['status' => 'awaiting_confirmation']);
    }

    /**
     * POST /api/v1/admin/support/tickets/{id}/messages
     * Admin sends a message.
     */
    public function addMessage(Request $request, string $id): JsonResponse
    {
        $ticket = SupportTicket::find($id);
        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        if ($ticket->isCompleted()) {
            return $this->error('Обращение закрыто', 422);
        }

        $request->validate([
            'body'          => ['required', 'string', 'max:50000'],
            'attachments'   => ['nullable', 'array', 'max:20'],
            'attachments.*' => ['file'],
        ]);

        $files = $request->file('attachments', []);
        if (!empty($files)) {
            $error = $this->attachmentService->validateAdminFiles($files);
            if ($error) {
                return $this->error($error, 422);
            }
        }

        DB::transaction(function () use ($request, $ticket, $files, &$message) {
            $message = SupportMessage::create([
                'ticket_id'        => $ticket->id,
                'sender_id'        => $request->user()->id,
                'is_admin_message' => true,
                'body'             => $request->input('body'),
            ]);

            if (!empty($files)) {
                $this->attachmentService->storeSupportAttachments($message->id, $files);
            }
        });

        $message->load('attachments');

        $ticket->loadMissing('user');
        $this->pushService->sendToUser(
            $ticket->user,
            'Ответ поддержки по обращению #' . $ticket->id,
            mb_substr($request->input('body'), 0, 80),
            config('app.url') . '/support/' . $ticket->id,
        );

        return $this->success('Сообщение отправлено', ['message' => $this->formatMessage($message)]);
    }

    /**
     * POST /api/v1/admin/support/tickets/{id}/mark-read
     * Mark user messages in this ticket as read by admin.
     */
    public function markRead(string $id): JsonResponse
    {
        $ticket = SupportTicket::find($id);
        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        SupportMessage::where('ticket_id', $id)
            ->where('is_admin_message', false)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $this->success('Прочитано');
    }

    /**
     * GET /api/v1/admin/support/tickets/{id}/attachments/{attachmentId}
     */
    public function downloadAttachment(string $id, string $attachmentId): JsonResponse
    {
        $ticket = SupportTicket::find($id);
        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        $attachment = SupportAttachment::whereHas(
            'message',
            fn($q) => $q->where('ticket_id', $id)
        )->find($attachmentId);

        if (!$attachment) {
            return $this->notFound('Вложение не найдено');
        }

        return $this->success('Ссылка получена', [
            'url'           => $this->attachmentService->downloadUrl($attachment->storage_key),
            'original_name' => $attachment->original_name,
        ]);
    }

    // ─── Formatters ──────────────────────────────────────────────────────────

    private function formatListItem(SupportTicket $t): array
    {
        $lastEventAt = $t->last_message_at
            ? \Carbon\Carbon::parse($t->last_message_at)->toIso8601String()
            : $t->updated_at?->toIso8601String();

        return [
            'id'            => $t->id,
            'status'        => $t->status,
            'unread_count'  => $t->unread_count ?? 0,
            'user'          => $t->user ? ['id' => $t->user->id, 'email' => $t->user->email, 'name' => $t->user->name] : null,
            'created_at'    => $t->created_at?->toIso8601String(),
            'last_event_at' => $lastEventAt,
        ];
    }

    private function formatDetail(SupportTicket $t): array
    {
        return [
            'id'                => $t->id,
            'status'            => $t->status,
            'completion_reason' => $t->completion_reason,
            'completed_at'      => $t->completed_at?->toIso8601String(),
            'taken_at'          => $t->taken_at?->toIso8601String(),
            'awaiting_at'       => $t->awaiting_at?->toIso8601String(),
            'confirmed_at'      => $t->confirmed_at?->toIso8601String(),
            'auto_closed_at'    => $t->auto_closed_at?->toIso8601String(),
            'created_at'        => $t->created_at?->toIso8601String(),
            'user'              => $t->user ? ['id' => $t->user->id, 'email' => $t->user->email, 'name' => $t->user->name] : null,
            'messages'          => $t->messages->map(fn($m) => $this->formatMessage($m))->values(),
        ];
    }

    private function formatMessage(SupportMessage $m): array
    {
        return [
            'id'               => $m->id,
            'is_admin_message' => $m->is_admin_message,
            'body'             => $m->body,
            'read_at'          => $m->read_at?->toIso8601String(),
            'created_at'       => $m->created_at?->toIso8601String(),
            'attachments'      => $m->relationLoaded('attachments')
                ? $m->attachments->map(fn($a) => [
                    'id'            => $a->id,
                    'original_name' => $a->original_name,
                    'mime_type'     => $a->mime_type,
                    'size'          => $a->size,
                ])->values()
                : [],
        ];
    }


}
