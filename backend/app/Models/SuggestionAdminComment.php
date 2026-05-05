<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SuggestionAdminComment extends Model
{
    use HasUlids;

    protected $fillable = [
        'suggestion_id',
        'body',
    ];

    public function suggestion(): BelongsTo
    {
        return $this->belongsTo(SuggestionTicket::class, 'suggestion_id');
    }
}
