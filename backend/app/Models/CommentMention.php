<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommentMention extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $fillable = [
        'comment_id',
        'mentioned_user_id',
        'delivered_at',
        'read_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at'   => 'datetime',
            'delivered_at' => 'datetime',
            'read_at'      => 'datetime',
        ];
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    public function mentionedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentioned_user_id');
    }
}
