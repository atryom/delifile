<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SuggestionTicket extends Model
{
    use HasUlids;

    protected $fillable = [
        'user_id',
        'body',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(SuggestionAttachment::class, 'suggestion_id');
    }

    public function adminComments(): HasMany
    {
        return $this->hasMany(SuggestionAdminComment::class, 'suggestion_id');
    }
}
