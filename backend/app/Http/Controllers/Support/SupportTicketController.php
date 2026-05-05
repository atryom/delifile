<?php

namespace App\Http\Controllers\Support;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Services\SupportAttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportTicketController extends Controller
{
    public function __construct(
        private readonly SupportAttachmentService $attachmentService
    ) {}

    /**
     * GET /api/v1/support/tickets
     * Paginated list of user's own tickets, sorted by last event.
     */
    public function index(Request $request): JsonResponse
    {
        $user    = $request->user();
        $page    = max(1, (int) $request->get('page', 1));
        $perPage = 5;

        $tickets = SupportTicket::where('user_id', $user->id)
            ->withCount(['messages as unread_count' => function ($q) {
                $q->where('is_admin_message', true)->whereNull('read_at');
            }])
            ->with(['messages' => fn($q) => $q->latest()->limit(1)])
            ->get()
            ->sortByDesc(fn($t) => $t->messages->first()?->created_at ?? $t->updated_at)
            ->values();

        $total  = $tickets->count();
        $items  = $tickets->forPage($page, $perPage)->values();

        return $this->success('Обращения получены', [
            'items'      => $items->map(fn($t) => $this->formatTicketListItem($t)),
            'pagination' => [
                'page'     => $page,
                'per_page' => $perPage,
                'total'    => $total,
            ],
        ]);
    }

    /**
     * POST /api/v1/support/tickets
     * Create a new ticket with the first message.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'body'        => ['required', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file'],
        ]);

        $files = $request->file('attachments', []);
        if (!empty($files)) {
            $error = $this->attachmentService->validateUserFiles($files);
            if ($error) {
                return $this->error($error, 422);
            }
        }

        DB::transaction(function () use ($request, $files, &$ticket) {
            $ticket = SupportTicket::create([
                'user_id' => $request->user()->id,
                'status'  => 'new',
            ]);

            $message = SupportMessage::create([
                'ticket_id'        => $ticket->id,
                'sender_id'        => $request->user()->id,
                'is_admin_message' => false,
                'body'             => $request->input('body'),
            ]);

            if (!empty($files)) {
                $this->attachmentService->storeSupportAttachments($message->id, $files);
            }
        });

        return $this->success('Обращение создано', ['ticket' => $this->formatTicketDetail($ticket->fresh(['messages.attachments']))], 201);
    }

    /**
     * GET /api/v1/support/tickets/{id}
     * Full ticket detail with messages and attachments.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $ticket = SupportTicket::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->with(['messages' => fn($q) => $q->orderBy('created_at'), 'messages.attachments'])
            ->first();

        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        return $this->success('Обращение получено', ['ticket' => $this->formatTicketDetail($ticket)]);
    }

    /**
     * POST /api/v1/support/tickets/{id}/messages
     * Send a new message in a ticket.
     */
    public function addMessage(Request $request, string $id): JsonResponse
    {
        $ticket = SupportTicket::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        if ($ticket->isCompleted()) {
            return $this->error('Обращение закрыто, отправка сообщений недоступна', 422);
        }

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

        DB::transaction(function () use ($request, $ticket, $files, &$message) {
            // If ticket was awaiting confirmation and user sends a message → back to in_progress
            if ($ticket->status === 'awaiting_confirmation') {
                $ticket->update(['status' => 'in_progress']);
            }

            $message = SupportMessage::create([
                'ticket_id'        => $ticket->id,
                'sender_id'        => $request->user()->id,
                'is_admin_message' => false,
                'body'             => $request->input('body'),
            ]);

            if (!empty($files)) {
                $this->attachmentService->storeSupportAttachments($message->id, $files);
            }
        });

        $message->load('attachments');

        return $this->success('Сообщение отправлено', ['message' => $this->formatMessage($message)]);
    }

    /**
     * POST /api/v1/support/tickets/{id}/confirm
     * User confirms ticket completion (from awaiting_confirmation → completed).
     */
    public function confirm(Request $request, string $id): JsonResponse
    {
        $ticket = SupportTicket::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        if ($ticket->status !== 'awaiting_confirmation') {
            return $this->error('Обращение не ожидает подтверждения', 422);
        }

        $now = now();
        $ticket->update([
            'status'             => 'completed',
            'completion_reason'  => 'user_confirmed',
            'confirmed_at'       => $now,
            'completed_at'       => $now,
        ]);

        return $this->success('Обращение подтверждено и закрыто', ['status' => 'completed']);
    }

    /**
     * POST /api/v1/support/tickets/{id}/mark-read
     * Mark admin messages in this ticket as read by the user.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $ticket = SupportTicket::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        SupportMessage::where('ticket_id', $id)
            ->where('is_admin_message', true)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $this->success('Прочитано');
    }

    /**
     * GET /api/v1/support/tickets/{id}/attachments/{attachmentId}
     * Download an attachment.
     */
    public function downloadAttachment(Request $request, string $id, string $attachmentId): JsonResponse
    {
        $ticket = SupportTicket::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$ticket) {
            return $this->notFound('Обращение не найдено');
        }

        $attachment = \App\Models\SupportAttachment::whereHas(
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

    private function formatTicketListItem(SupportTicket $ticket): array
    {
        return [
            'id'           => $ticket->id,
            'status'       => $ticket->status,
            'unread_count' => $ticket->unread_count ?? 0,
            'created_at'   => $ticket->created_at?->toIso8601String(),
            'updated_at'   => $ticket->updated_at?->toIso8601String(),
            'last_event_at'=> $ticket->messages->first()?->created_at?->toIso8601String()
                ?? $ticket->updated_at?->toIso8601String(),
        ];
    }

    private function formatTicketDetail(SupportTicket $ticket): array
    {
        return [
            'id'                 => $ticket->id,
            'status'             => $ticket->status,
            'completion_reason'  => $ticket->completion_reason,
            'completed_at'       => $ticket->completed_at?->toIso8601String(),
            'created_at'         => $ticket->created_at?->toIso8601String(),
            'messages'           => $ticket->messages->map(fn($m) => $this->formatMessage($m))->values(),
        ];
    }

    private function formatMessage(SupportMessage $message): array
    {
        return [
            'id'               => $message->id,
            'is_admin_message' => $message->is_admin_message,
            'body'             => $message->body,
            'read_at'          => $message->read_at?->toIso8601String(),
            'created_at'       => $message->created_at?->toIso8601String(),
            'attachments'      => $message->relationLoaded('attachments')
                ? $message->attachments->map(fn($a) => $this->formatAttachment($a))->values()
                : [],
        ];
    }

    private function formatAttachment(\App\Models\SupportAttachment $a): array
    {
        return [
            'id'            => $a->id,
            'original_name' => $a->original_name,
            'mime_type'     => $a->mime_type,
            'size'          => $a->size,
        ];
    }
}
