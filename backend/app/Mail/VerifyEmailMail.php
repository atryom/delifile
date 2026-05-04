<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerifyEmailMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $verifyUrl;

    public function __construct(
        public readonly User $user,
        string $token
    ) {
        $appUrl = rtrim(config('app.url'), '/');
        $this->verifyUrl = $appUrl . '/api/v1/auth/email/verify/' . $token;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Подтвердите адрес электронной почты — ' . config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.verify-email',
        );
    }
}
