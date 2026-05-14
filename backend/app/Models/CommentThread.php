<?php

namespace App\Models;

use App\Enums\CommentScope;
use App\Enums\CommentTargetType;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CommentThread extends Model
{
    use HasUlids;

    protected $fillable = [
        'target_type',
        'target_id',
        'scope',
        'owner_user_id',
        'context_shared_folder_id',
        'created_by',
        'last_comment_id',
        'comments_count',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'scope'       => CommentScope::class,
            'target_type' => CommentTargetType::class,
        ];
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'thread_id')->whereNull('deleted_at');
    }

    public function allComments(): HasMany
    {
        return $this->hasMany(Comment::class, 'thread_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function readRecord(int $userId): HasOne
    {
        return $this->hasOne(CommentRead::class, 'thread_id')->where('user_id', $userId);
    }
}
