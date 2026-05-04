<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $resetUrl;
    public string $code;

    public function __construct(
        public readonly User $user,
        string $token,
        string $code,
    ) {
        $appUrl = rtrim(config('app.url'), '/');
        $this->resetUrl = $appUrl . '/reset-password?token=' . $token;
        $this->code     = $code;
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Восстановление пароля — ' . config('app.name'));
    }

    public function content(): Content
    {
        return new Content(view: 'mail.password-reset');
    }
}
