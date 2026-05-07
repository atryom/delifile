<?php

namespace App\Models;

use App\Enums\SharedFolderAccessType;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class SharedFolderLink extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'shared_folder_id',
        'created_by',
        'token',
        'access_type',
        'allow_save',
        'status',
        'ttl_hours',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'access_type' => SharedFolderAccessType::class,
            'allow_save'  => 'boolean',
            'expires_at'  => 'datetime',
            'ttl_hours'   => 'integer',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function (SharedFolderLink $link) {
            if (empty($link->token)) {
                $link->token = Str::random(32);
            }
        });
    }

    public function getUrlAttribute(): string
    {
        return rtrim(config('app.url'), '/') . '/shared-link/' . $this->token;
    }

    public function isValid(): bool
    {
        return $this->status === 'active'
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(SharedFolder::class, 'shared_folder_id');
    }
}
