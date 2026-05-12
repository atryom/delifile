<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\FileUserAccess;

class Folder extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id',
        'parent_id',
        'name',
        'sort_order',
    ];

    // Relations
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Folder::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Folder::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function files(): HasMany
    {
        return $this->hasMany(File::class);
    }

    public function userAccesses(): HasMany
    {
        return $this->hasMany(FileUserAccess::class, 'folder_id');
    }

    public function hasChildren(): bool
    {
        return $this->children()->exists();
    }

    /**
     * Collect all ancestor IDs to detect cycles.
     */
    public function ancestorIds(): array
    {
        $ids  = [];
        $node = $this;
        while ($node->parent_id) {
            if (in_array($node->parent_id, $ids)) {
                break; // already have a cycle in stored data
            }
            $ids[]  = $node->parent_id;
            $node   = $node->parent;
            if (!$node) {
                break;
            }
        }
        return $ids;
    }
}