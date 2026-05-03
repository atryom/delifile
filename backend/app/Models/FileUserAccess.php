<?php

namespace App\Models;

use App\Enums\AccessType;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileUserAccess extends Model
{
    use HasFactory, HasUlids;

    protected $table = 'file_user_access';

    protected $fillable = [
        'file_id',
        'user_id',
        'contact_id',
        'access_type',
        'is_favorite',
        'pinned_at',
        'saved_at',
    ];

    protected function casts(): array
    {
        return [
            'access_type' => AccessType::class,
            'is_favorite' => 'boolean',
            'pinned_at'   => 'datetime',
            'saved_at'    => 'datetime',
        ];
    }

    // Relations
    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    // Helpers
    public function isOwner(): bool
    {
        return $this->access_type === AccessType::Owner;
    }

    public function isSaved(): bool
    {
        return $this->access_type === AccessType::Saved;
    }
}
