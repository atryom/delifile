<?php

namespace App\Models;

use App\Enums\ShareLinkStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ShareLink extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'file_id',
        'created_by',
        'token',
        'status',
        'ttl_hours',
        'expires_at',
        'allow_save',
    ];

    protected function casts(): array
    {
        return [
            'status'     => ShareLinkStatus::class,
            'expires_at' => 'datetime',
            'ttl_hours'  => 'integer',
            'allow_save' => 'boolean',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function (ShareLink $link) {
            if (empty($link->token)) {
                $link->token = Str::random(32);
            }
        });
    }

    // Relations
    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Helpers
    public function isValid(): bool
    {
        return $this->status === ShareLinkStatus::Active
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function getUrlAttribute(): string
    {
        return rtrim(config('app.url'), '/') . '/link/' . $this->token;
    }
}
