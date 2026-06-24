<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserFileMovieMeta extends Model
{
    protected $table = 'user_file_movie_meta';

    protected $fillable = [
        'user_id',
        'file_id',
        'watched',
        'personal_rating',
    ];

    protected function casts(): array
    {
        return [
            'watched'         => 'boolean',
            'personal_rating' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
