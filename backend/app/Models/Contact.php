<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contact extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id',
        'name',
        'phone',
        'resolved_user_id',
    ];

    protected function casts(): array
    {
        return [];
    }

    // Relations
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function resolvedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_user_id');
    }

    // Helpers
    public function isRegistered(): bool
    {
        return $this->resolved_user_id !== null;
    }
}
