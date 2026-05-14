<?php

namespace App\Models;

use App\Enums\SharedCommentMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SharedFolderCommentSettings extends Model
{
    public $timestamps = false;
    public $incrementing = false;
    protected $primaryKey = 'shared_folder_id';
    protected $keyType = 'string';

    protected $fillable = [
        'shared_folder_id',
        'shared_comments_mode',
        'private_comments_enabled',
        'mentions_enabled',
        'updated_by',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'shared_comments_mode'     => SharedCommentMode::class,
            'private_comments_enabled' => 'boolean',
            'mentions_enabled'         => 'boolean',
            'updated_at'               => 'datetime',
        ];
    }

    public function sharedFolder(): BelongsTo
    {
        return $this->belongsTo(SharedFolder::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
