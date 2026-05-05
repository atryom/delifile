<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    use HasUlids;

    protected $fillable = [
        'user_id',
        'status',
        'completion_reason',
        'taken_at',
        'awaiting_at',
        'confirmed_at',
        'auto_closed_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'taken_at'       => 'datetime',
            'awaiting_at'    => 'datetime',
            'confirmed_at'   => 'datetime',
            'auto_closed_at' => 'datetime',
            'completed_at'   => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'ticket_id');
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function unreadCountFor(bool $isAdmin): int
    {
        // Admin sees unread user messages; user sees unread admin messages
        return $this->messages()
            ->where('is_admin_message', !$isAdmin)
            ->whereNull('read_at')
            ->count();
    }

    public function lastEventAt(): \Carbon\Carbon|null
    {
        $lastMsg = $this->messages()->latest()->first();
        if ($lastMsg) {
            return $lastMsg->created_at;
        }
        return $this->updated_at ?? $this->created_at;
    }
}
