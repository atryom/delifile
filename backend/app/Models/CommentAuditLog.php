<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommentAuditLog extends Model
{
    use HasUlids;

    protected $table = 'comment_audit_log';

    public $timestamps = false;

    protected $fillable = [
        'comment_id',
        'actor_user_id',
        'action',
        'old_value_json',
        'new_value_json',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old_value_json' => 'array',
            'new_value_json' => 'array',
            'created_at'     => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
