<?php

namespace App\Models;

use App\Enums\FileStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class File extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'owner_id',
        'original_name',
        'storage_key',
        'size',
        'mime_type',
        'checksum',
        'status',
        'folder_id',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'status'     => FileStatus::class,
            'expires_at' => 'datetime',
            'size'       => 'integer',
        ];
    }

    // Relations
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(Folder::class);
    }

    public function accesses(): HasMany
    {
        return $this->hasMany(FileUserAccess::class);
    }

    public function shareLinks(): HasMany
    {
        return $this->hasMany(ShareLink::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function tags(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'file_tags');
    }

    // Helpers
    public function isAvailable(): bool
    {
        return $this->status === FileStatus::Available;
    }

    public function isOwnedBy(User $user): bool
    {
        return $this->owner_id === $user->id;
    }

    public function hasAccessFor(User $user): bool
    {
        return $this->accesses()->where('user_id', $user->id)->exists();
    }

    public function canBeDeleted(): bool
    {
        // Can only be physically deleted when:
        // - TTL expired
        // - No active share links
        // - No 'saved' type accesses keeping it alive
        $hasActiveSaved = $this->accesses()
            ->where('access_type', 'saved')
            ->exists();

        $hasActiveLinks = $this->shareLinks()
            ->where('status', 'active')
            ->exists();

        return !$hasActiveSaved && !$hasActiveLinks;
    }
}
