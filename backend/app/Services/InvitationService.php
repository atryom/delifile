<?php

namespace App\Services;

use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

class InvitationService
{
    /**
     * Create and send invitation.
     */
    public function send(User $sender, array $data): Invitation
    {
        $invitation = Invitation::create([
            'sender_user_id' => $sender->id,
            'target_email'   => $data['email'],
            'file_id'        => $data['file_id'] ?? null,
            'comment'        => $data['comment'] ?? null,
        ]);

        Mail::to($invitation->target_email)->send(new InvitationMail($invitation, $sender));

        return $invitation;
    }

    /**
     * Accept invitation as current user.
     */
    public function accept(Invitation $invitation, User $user): bool
    {
        if (!$invitation->isUsable()) {
            return false;
        }

        $invitation->update([
            'status'              => 'accepted',
            'accepted_by_user_id' => $user->id,
        ]);

        return true;
    }

    /**
     * Reject invitation.
     */
    public function reject(Invitation $invitation): void
    {
        $invitation->update(['status' => 'cancelled']);
    }

    /**
     * Cancel invitation by sender.
     */
    public function cancel(Invitation $invitation, User $sender): bool
    {
        if ($invitation->sender_user_id !== $sender->id) {
            return false;
        }

        $invitation->update(['status' => 'cancelled']);
        return true;
    }

    /**
     * Mark expired invitations.
     */
    public function expireOverdue(): int
    {
        return Invitation::where('status', 'pending')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired']);
    }

    public function formatInvitation(Invitation $invitation): array
    {
        return [
            'id'           => $invitation->id,
            'target_email' => $invitation->target_email,
            'status'       => $invitation->status,
            'file_id'      => $invitation->file_id,
            'expires_at'   => $invitation->expires_at?->toIso8601String(),
            'created_at'   => $invitation->created_at?->toIso8601String(),
        ];
    }
}