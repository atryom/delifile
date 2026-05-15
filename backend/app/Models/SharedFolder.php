<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SharedFolder extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'owner_id',
        'parent_id',
        'name',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(SharedFolder::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(SharedFolder::class, 'parent_id');
    }

    /**
     * Walk up the parent chain and collect all ancestor IDs (root first).
     */
    public function ancestorIds(): array
    {
        $ids = [];
        $current = $this->parent_id ? SharedFolder::find($this->parent_id) : null;
        while ($current) {
            $ids[] = $current->id;
            $current = $current->parent_id ? SharedFolder::find($current->parent_id) : null;
        }
        return array_reverse($ids);
    }

    /**
     * Get the root shared folder (the top-level ancestor).
     */
    public function rootFolder(): SharedFolder
    {
        $current = $this;
        while ($current->parent_id) {
            $parent = SharedFolder::find($current->parent_id);
            if (!$parent) break;
            $current = $parent;
        }
        return $current;
    }

    public function accesses(): HasMany
    {
        return $this->hasMany(SharedFolderAccess::class);
    }

    public function links(): HasMany
    {
        return $this->hasMany(SharedFolderLink::class);
    }

    public function sharedFiles(): HasMany
    {
        return $this->hasMany(SharedFolderFile::class);
    }

    public function commentSettings(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(SharedFolderCommentSettings::class);
    }
}
