<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AdminNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $title,
        public readonly string $body,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->title . ' — ' . config('app.name'));
    }

    public function content(): Content
    {
        return new Content(view: 'mail.admin-notification');
    }
}
