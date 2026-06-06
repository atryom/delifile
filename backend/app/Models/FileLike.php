<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileLike extends Model
{
    use HasUlids;

    public $timestamps = false;
    const CREATED_AT = 'created_at';

    protected $fillable = ['file_id', 'user_id'];

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
