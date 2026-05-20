<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileVersion extends Model
{
    use HasUlids;

    protected $fillable = [
        'file_id',
        'version_number',
        'version_label',
        'comment',
        'storage_key',
        'thumbnail_key',
        'original_name',
        'size',
        'mime_type',
        'is_active',
        'status',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'version_number' => 'integer',
            'size'           => 'integer',
            'is_active'      => 'boolean',
            'expires_at'     => 'datetime',
        ];
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }
}
