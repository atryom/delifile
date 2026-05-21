<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    use HasUlids;

    protected $fillable = [
        'thread_id',
        'parent_comment_id',
        'author_user_id',
        'body',
        'body_plain',
        'mentions_json',
        'edited_at',
    ];

    protected function casts(): array
    {
        return [
            'mentions_json' => 'array',
            'edited_at'     => 'datetime',
            'deleted_at'    => 'datetime',
        ];
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(CommentThread::class, 'thread_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_comment_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_comment_id')->whereNull('deleted_at');
    }

    public function mentions(): HasMany
    {
        return $this->hasMany(CommentMention::class, 'comment_id');
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }
}
