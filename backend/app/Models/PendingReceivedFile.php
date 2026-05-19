<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingReceivedFile extends Model
{
    use HasUlids;

    protected $fillable = [
        'file_id',
        'recipient_user_id',
        'sender_user_id',
        'can_edit',
    ];

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
