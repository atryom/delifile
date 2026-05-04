<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Invitation extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'sender_user_id',
        'target_email',
        'file_id',
        'token',
        'status',
        'accepted_by_user_id',
        'comment',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (self $model) {
            if (empty($model->token)) {
                $model->token = Str::random(48);
            }
            if (empty($model->expires_at)) {
                $model->expires_at = now()->addDays(7);
            }
        });
    }

    // Relations
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by_user_id');
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    // Helpers
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function isUsable(): bool
    {
        return $this->isPending() && !$this->isExpired();
    }
}