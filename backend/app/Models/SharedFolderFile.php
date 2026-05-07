<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SharedFolderFile extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'shared_folder_id',
        'file_id',
        'added_by',
    ];

    public function folder(): BelongsTo
    {
        return $this->belongsTo(SharedFolder::class, 'shared_folder_id');
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }
}
