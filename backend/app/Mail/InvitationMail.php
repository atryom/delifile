<?php

namespace App\Mail;

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $inviteUrl;
    public string $senderName;

    public function __construct(
        public readonly Invitation $invitation,
        public readonly User $sender
    ) {
        $appUrl = rtrim(config('app.url'), '/');
        $this->inviteUrl  = $appUrl . '/invite/' . $invitation->token;
        $this->senderName = $sender->name ?? $sender->email;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->senderName . ' приглашает вас в ' . config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.invitation',
        );
    }
}
