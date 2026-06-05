<?php

namespace App\Models;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Enums\ShareLinkStatus;
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
        'thumbnail_key',
        'size',
        'mime_type',
        'checksum',
        'status',
        'folder_id',
        'shared_folder_only',
        'has_versions',
        'is_editable',
        'editor_type',
        'etag',
        'updated_by',
        'width',
        'height',
        'display_name',
        'expires_at',
        'content_kind',
        'link_url',
        'link_title',
        'link_description',
        'link_image_url',
        'link_site_name',
        'link_fetched_at',
        'is_task',
        'task_status',
        'task_assigned_user_id',
        'task_start_date',
        'task_due_date',
        'custom_metadata',
    ];

    protected function casts(): array
    {
        return [
            'status'             => FileStatus::class,
            'expires_at'         => 'datetime',
            'link_fetched_at'    => 'datetime',
            'size'               => 'integer',
            'shared_folder_only' => 'boolean',
            'has_versions'       => 'boolean',
            'is_editable'        => 'boolean',
            'width'              => 'integer',
            'height'             => 'integer',
            'is_task'            => 'boolean',
            'task_start_date'    => 'datetime',
            'task_due_date'      => 'datetime',
            'custom_metadata'    => 'array',
        ];
    }

    public function isUrlFile(): bool
    {
        return $this->content_kind === 'url_file';
    }

    public function isMarkdownDocument(): bool
    {
        return $this->is_editable && $this->editor_type === 'markdown';
    }

    public function taskAssignee(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'task_assigned_user_id');
    }

    public function isTask(): bool
    {
        return (bool) $this->is_task;
    }

    public function updatedByUser(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function documentLock(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(DocumentLock::class, 'file_id');
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

    public function sharedFolderFiles(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SharedFolderFile::class);
    }

    public function versions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(FileVersion::class)->orderBy('version_number');
    }

    public function commentSettings(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(FileCommentSettings::class);
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
        return !$this->accesses()->where('access_type', AccessType::Saved->value)->exists()
            && !$this->shareLinks()->where('status', ShareLinkStatus::Active->value)->exists();
    }
}
