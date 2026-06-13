<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class FileRequest extends Model
{
    use HasUlids;

    protected $fillable = [
        'user_id',
        'token',
        'description',
        'status',
        'file_id',
        'folder_id',
        'allow_multiple',
        'sender_name',
        'sender_email',
        'ttl_hours',
        'expires_at',
        'fulfilled_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at'     => 'datetime',
            'fulfilled_at'   => 'datetime',
            'ttl_hours'      => 'integer',
            'allow_multiple' => 'boolean',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function (FileRequest $req) {
            if (empty($req->token)) {
                $req->token = Str::random(48);
            }
        });
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(FileRequestFile::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isFulfilled(): bool
    {
        return $this->status === 'fulfilled';
    }

    public function isActive(): bool
    {
        return $this->status === 'pending'
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function getUrlAttribute(): string
    {
        return rtrim(config('app.url'), '/') . '/file-request/' . $this->token;
    }
}
