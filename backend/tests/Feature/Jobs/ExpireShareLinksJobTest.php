<?php

namespace Tests\Feature\Jobs;

use App\Jobs\ExpireShareLinksJob;
use App\Models\File;
use App\Models\ShareLink;
use App\Models\SharedFolder;
use App\Models\SharedFolderLink;
use App\Models\User;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class ExpireShareLinksJobTest extends TestCase
{
    public function test_expired_file_links_are_deleted(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        ShareLink::factory()->expired()->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        ExpireShareLinksJob::dispatchSync();

        $this->assertDatabaseMissing('share_links', [
            'file_id' => $file->id,
        ]);
    }

    public function test_expired_folder_links_are_deleted(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        $link = SharedFolderLink::create([
            'shared_folder_id' => $folder->id,
            'created_by'       => $user->id,
            'access_type'      => 'view',
            'allow_save'       => false,
            'status'           => 'active',
            'ttl_hours'        => 1,
            'expires_at'       => now()->subHour(),
        ]);

        ExpireShareLinksJob::dispatchSync();

        $this->assertDatabaseMissing('shared_folder_links', [
            'id' => $link->id,
        ]);
    }

    public function test_unexpired_links_are_not_deleted(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        ShareLink::factory()->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        ExpireShareLinksJob::dispatchSync();

        $this->assertDatabaseHas('share_links', [
            'file_id' => $file->id,
        ]);
    }

    public function test_job_is_queued(): void
    {
        Bus::fake();

        ExpireShareLinksJob::dispatch();

        Bus::assertDispatched(ExpireShareLinksJob::class);
    }
}
