<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileRequestFile extends Model
{
    use HasUlids;

    protected $fillable = [
        'file_request_id',
        'file_id',
        'sender_name',
        'sender_email',
        'status',
    ];

    public function fileRequest(): BelongsTo
    {
        return $this->belongsTo(FileRequest::class);
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }
}
