<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingReceivedSharedFolder extends Model
{
    use HasUlids;

    protected $fillable = [
        'shared_folder_id',
        'recipient_user_id',
        'inviter_user_id',
        'access_type',
    ];

    public function sharedFolder(): BelongsTo
    {
        return $this->belongsTo(SharedFolder::class);
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inviter_user_id');
    }
}
