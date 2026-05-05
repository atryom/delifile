<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SuggestionAttachment extends Model
{
    use HasUlids;

    protected $fillable = [
        'suggestion_id',
        'original_name',
        'storage_key',
        'mime_type',
        'size',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
        ];
    }

    public function suggestion(): BelongsTo
    {
        return $this->belongsTo(SuggestionTicket::class, 'suggestion_id');
    }
}
