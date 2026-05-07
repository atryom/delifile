<?php

namespace App\Models;

use App\Enums\SharedFolderAccessType;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SharedFolderAccess extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'shared_folder_id',
        'user_id',
        'contact_id',
        'access_type',
    ];

    protected function casts(): array
    {
        return [
            'access_type' => SharedFolderAccessType::class,
        ];
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(SharedFolder::class, 'shared_folder_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
