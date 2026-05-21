<?php

namespace App\Http\Controllers\Invitations;

use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvitationController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitationService
    ) {}

    /**
     * POST /api/v1/invitations
     */
    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'   => 'required|email|max:255',
            'file_id' => 'nullable|string|exists:files,id',
            'comment' => 'nullable|string|max:1000',
        ]);

        if (!empty($data['file_id'])) {
            $file = \App\Models\File::find($data['file_id']);
            if (!$file || !$file->isOwnedBy($request->user())) {
                return $this->forbidden('You can only invite others to your own files');
            }
        }

        $invitation = $this->invitationService->send($request->user(), $data);

        return $this->success('Invitation sent successfully', [
            'invitation' => $this->invitationService->formatInvitation($invitation),
        ], 201);
    }

    /**
     * GET /api/v1/invitations/{token}
     */
    public function show(string $token): JsonResponse
    {
        $invitation = Invitation::where('token', $token)->with('sender')->first();

        if (!$invitation) {
            return $this->notFound('Invitation not found');
        }

        if ($invitation->isExpired() && $invitation->isPending()) {
            $invitation->update(['status' => 'expired']);
        }

        // Check if target email is already registered
        $targetUser = User::where('email', $invitation->target_email)->first();

        return $this->success('Invitation fetched successfully', [
            'invitation'    => $this->invitationService->formatInvitation($invitation),
            'sender'        => [
                'name'  => $invitation->sender->name ?? $invitation->sender->email,
                'email' => $invitation->sender->email,
            ],
            'target_email'  => $invitation->target_email,
            'user_exists'   => $targetUser !== null,
        ]);
    }

    /**
     * POST /api/v1/invitations/{token}/accept
     */
    public function accept(Request $request, string $token): JsonResponse
    {
        $invitation = Invitation::where('token', $token)->first();

        if (!$invitation) {
            return $this->notFound('Invitation not found');
        }

        if (!$invitation->isUsable()) {
            $reason = $invitation->isExpired() ? 'EXPIRED' : 'NOT_PENDING';
            return $this->error('Приглашение недоступно', $reason, [], 422);
        }

        if (strtolower($request->user()->email) !== strtolower($invitation->target_email)) {
            return $this->forbidden('This invitation was not sent to you');
        }

        if (!$this->invitationService->accept($invitation, $request->user())) {
            return $this->error('Не удалось принять приглашение', 'ACCEPT_FAILED', [], 422);
        }

        return $this->success('Invitation accepted successfully', [
            'invitation' => $this->invitationService->formatInvitation($invitation->fresh()),
        ]);
    }

    /**
     * POST /api/v1/invitations/{token}/reject
     */
    public function reject(Request $request, string $token): JsonResponse
    {
        $invitation = Invitation::where('token', $token)->first();

        if (!$invitation) {
            return $this->notFound('Invitation not found');
        }

        $user = $request->user();
        $isSender    = $invitation->sender_user_id === $user->id;
        $isRecipient = strtolower($invitation->target_email) === strtolower($user->email);

        if (!$isSender && !$isRecipient) {
            return $this->forbidden('You are not authorized to reject this invitation');
        }

        $this->invitationService->reject($invitation);

        return $this->success('Invitation rejected');
    }

    /**
     * POST /api/v1/invitations/{id}/cancel
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        $invitation = Invitation::find($id);

        if (!$invitation) {
            return $this->notFound('Invitation not found');
        }

        if (!$this->invitationService->cancel($invitation, $request->user())) {
            return $this->forbidden('Only the sender can cancel this invitation');
        }

        return $this->success('Invitation cancelled');
    }
}
