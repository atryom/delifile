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
        'name',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
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
}
