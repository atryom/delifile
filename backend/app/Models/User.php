<?php

namespace App\Models;

use App\Enums\TariffPlan;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'email',
        'phone',
        'name',
        'password',
        'email_verified_at',
        'email_verification_token',
        'email_verification_sent_at',
        'email_verification_deadline_at',
        'account_status',
        'plan',
        'is_superuser',
        'notifications_enabled',
        'notify_new_files',
        'notify_contacts_added',
        'allow_contacts_without_confirmation',
        'auto_add_received_files',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'email_verification_token',
    ];

    protected function casts(): array
    {
        return [
            'password'                       => 'hashed',
            'email_verified_at'              => 'datetime',
            'email_verification_sent_at'     => 'datetime',
            'email_verification_deadline_at' => 'datetime',
            'plan'                                  => TariffPlan::class,
            'is_superuser'                          => 'boolean',
            'notifications_enabled'                 => 'boolean',
            'notify_new_files'                      => 'boolean',
            'notify_contacts_added'                 => 'boolean',
            'allow_contacts_without_confirmation'   => 'boolean',
            'auto_add_received_files'               => 'boolean',
        ];
    }

    public function getPlan(): TariffPlan
    {
        return $this->plan ?? TariffPlan::Free;
    }

    public function isEmailVerified(): bool
    {
        return $this->email_verified_at !== null;
    }

    public function isBlocked(): bool
    {
        return $this->account_status === 'blocked_unverified_email';
    }

    public function isActive(): bool
    {
        return in_array($this->account_status, ['active', 'pending_email_verification']);
    }

    // Relations
    public function files(): HasMany
    {
        return $this->hasMany(File::class, 'owner_id');
    }

    public function fileAccesses(): HasMany
    {
        return $this->hasMany(FileUserAccess::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function folders(): HasMany
    {
        return $this->hasMany(Folder::class);
    }

    public function tags(): HasMany
    {
        return $this->hasMany(Tag::class);
    }

    public function deviceSessions(): HasMany
    {
        return $this->hasMany(DeviceSession::class);
    }

    public function sentInvitations(): HasMany
    {
        return $this->hasMany(Invitation::class, 'sender_user_id');
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }
}