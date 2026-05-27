<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Mail\InvitationMail;
use App\Models\Contact;
use App\Models\ContactPendingShare;
use App\Models\FileUserAccess;
use App\Models\Invitation;
use App\Models\PendingReceivedFile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
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
     * Resolves matching contacts and delivers any queued pending file shares.
     */
    public function accept(Invitation $invitation, User $user): bool
    {
        if (!$invitation->isUsable()) {
            return false;
        }

        DB::transaction(function () use ($invitation, $user) {
            $invitation->update([
                'status'              => 'accepted',
                'accepted_by_user_id' => $user->id,
            ]);

            // Resolve all contacts that belong to the sender and match the target email
            $contacts = Contact::where('user_id', $invitation->sender_user_id)
                ->where('email', $invitation->target_email)
                ->get();

            foreach ($contacts as $contact) {
                $contact->update(['resolved_user_id' => $user->id]);

                // Apply pending file shares queued for this contact
                $pendingShares = ContactPendingShare::where('contact_id', $contact->id)->get();

                $grantedFileIds = [];
                foreach ($pendingShares as $pending) {
                    $existing = FileUserAccess::where('file_id', $pending->file_id)
                        ->where('user_id', $user->id)
                        ->first();
                    if ($existing) {
                        if (!$existing->contact_id) {
                            $existing->contact_id = $contact->id;
                            $existing->save();
                        }
                    } else {
                        FileUserAccess::create([
                            'file_id'     => $pending->file_id,
                            'user_id'     => $user->id,
                            'access_type' => AccessType::Shared,
                            'contact_id'  => $contact->id,
                            'can_edit'    => (bool) $pending->can_edit,
                        ]);
                    }
                    $grantedFileIds[] = $pending->file_id;
                }

                // Remove processed pending shares
                ContactPendingShare::where('contact_id', $contact->id)->delete();

                // Clean up any stale PendingReceivedFile for the same user+files
                if (!empty($grantedFileIds)) {
                    PendingReceivedFile::whereIn('file_id', $grantedFileIds)
                        ->where('recipient_user_id', $user->id)
                        ->delete();
                }
            }
        });

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