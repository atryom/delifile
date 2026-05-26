<?php

namespace Tests\Feature\Jobs;

use App\Enums\FileStatus;
use App\Jobs\CleanExpiredFilesJob;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\FileVersion;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CleanExpiredFilesJobTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('s3');
    }

    public function test_expired_file_without_saved_access_or_links_is_cleaned(): void
    {
        $owner = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'  => $owner->id,
            'status'    => FileStatus::Available,
            'expires_at' => now()->subHour(),
            'storage_key' => 'files/test/expired-file.pdf',
        ]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        CleanExpiredFilesJob::dispatchSync();

        $this->assertDatabaseHas('files', [
            'id'     => $file->id,
            'status' => FileStatus::Expired->value,
        ]);
        $this->assertNotNull($file->fresh()->deleted_at);
    }

    public function test_expired_file_with_saved_access_is_not_cleaned(): void
    {
        $owner = User::factory()->create();
        $saver = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'   => $owner->id,
            'status'     => FileStatus::Available,
            'expires_at' => now()->subHour(),
        ]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        FileUserAccess::factory()->saved()->create([
            'file_id' => $file->id,
            'user_id' => $saver->id,
        ]);

        CleanExpiredFilesJob::dispatchSync();

        $this->assertDatabaseHas('files', [
            'id'     => $file->id,
            'status' => FileStatus::Available->value,
        ]);
    }

    public function test_stuck_versions_are_cleaned(): void
    {
        $owner = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        $version = FileVersion::create([
            'file_id'        => $file->id,
            'version_number' => 1,
            'original_name'  => 'stuck.pdf',
            'size'           => 1024,
            'mime_type'      => 'application/pdf',
            'status'         => FileStatus::Uploading->value,
            'expires_at'     => now()->subHour(),
            'storage_key'    => 'files/test/stuck-version.pdf',
        ]);

        CleanExpiredFilesJob::dispatchSync();

        $this->assertDatabaseMissing('file_versions', [
            'id' => $version->id,
        ]);
    }

    public function test_upload_orphans_older_than_24h_are_cleaned(): void
    {
        $owner = User::factory()->create();
        $file = File::factory()->uploading()->create([
            'owner_id'   => $owner->id,
            'created_at' => now()->subHours(25),
            'storage_key' => 'files/test/orphan-file.pdf',
        ]);

        CleanExpiredFilesJob::dispatchSync();

        $this->assertDatabaseHas('files', [
            'id'     => $file->id,
            'status' => FileStatus::Deleted->value,
        ]);
        $this->assertNotNull($file->fresh()->deleted_at);
    }

    public function test_recent_upload_orphans_are_not_cleaned(): void
    {
        $owner = User::factory()->create();
        $file = File::factory()->uploading()->create([
            'owner_id'   => $owner->id,
            'created_at' => now()->subHours(2),
        ]);

        CleanExpiredFilesJob::dispatchSync();

        $this->assertDatabaseHas('files', [
            'id'     => $file->id,
            'status' => FileStatus::Uploading->value,
        ]);
    }

    public function test_s3_delete_failure_handled_gracefully(): void
    {
        $owner = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'   => $owner->id,
            'status'     => FileStatus::Available,
            'expires_at' => now()->subHour(),
        ]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        Storage::disk('s3')->delete('nonexistent');

        CleanExpiredFilesJob::dispatchSync();

        $this->assertDatabaseHas('files', [
            'id'     => $file->id,
            'status' => FileStatus::Expired->value,
        ]);
    }
}
