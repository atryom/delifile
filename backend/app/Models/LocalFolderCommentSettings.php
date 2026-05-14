<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocalFolderCommentSettings extends Model
{
    public $timestamps = false;
    public $incrementing = false;
    protected $primaryKey = 'local_folder_id';
    protected $keyType = 'string';

    protected $fillable = [
        'local_folder_id',
        'private_comments_enabled',
        'updated_by',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'private_comments_enabled' => 'boolean',
            'updated_at'               => 'datetime',
        ];
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(Folder::class, 'local_folder_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
