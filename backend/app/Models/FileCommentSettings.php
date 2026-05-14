<?php

namespace App\Models;

use App\Enums\SharedCommentOverride;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileCommentSettings extends Model
{
    public $timestamps = false;
    public $incrementing = false;
    protected $primaryKey = 'file_id';
    protected $keyType = 'string';

    protected $fillable = [
        'file_id',
        'shared_comments_enabled',
        'shared_comments_override',
        'private_comments_enabled',
        'mentions_enabled',
        'updated_by',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'shared_comments_enabled'  => 'boolean',
            'shared_comments_override' => SharedCommentOverride::class,
            'private_comments_enabled' => 'boolean',
            'mentions_enabled'         => 'boolean',
            'updated_at'               => 'datetime',
        ];
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
