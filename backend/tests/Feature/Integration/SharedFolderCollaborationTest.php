<?php

namespace Tests\Feature\Integration;

use App\Models\Contact;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\User;
use Tests\TestCase;

class SharedFolderCollaborationTest extends TestCase
{
    /**
     * 14.2: Folder → Add member → Upload files → Subfolder → Move → Privacy
     */
    public function test_shared_folder_collaboration_flow(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create(['auto_add_received_files' => true]);

        // ─── P1 creates folder ──────────────────────────────────────────
        $folderResponse = $this->actingAs($p1)
            ->postJson('/api/v1/shared-folders', ['name' => 'Проект']);

        $folderResponse->assertStatus(201);
        $folderId = $folderResponse->json('data.folder.id');

        // ─── P1 adds P2 with edit access ────────────────────────────────
        $contact = Contact::factory()->resolvedTo($p2)->create([
            'user_id' => $p1->id,
            'email'   => $p2->email,
        ]);

        $this->actingAs($p1)
            ->postJson("/api/v1/shared-folders/{$folderId}/accesses", [
                'contact_id'  => $contact->id,
                'access_type' => 'edit',
            ])
            ->assertStatus(201);

        // ─── P2 can see folder in their list ─────────────────────────────
        $this->actingAs($p2)
            ->getJson('/api/v1/shared-folders')
            ->assertOk()
            ->assertJsonPath('result', 'success');

        // ─── P1 uploads file to folder ──────────────────────────────────
        $p1File = File::factory()->create([
            'owner_id' => $p1->id,
            'status'   => \App\Enums\FileStatus::Available,
        ]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $p1File->id,
            'user_id' => $p1->id,
        ]);
        SharedFolderFile::create([
            'shared_folder_id' => $folderId,
            'file_id'          => $p1File->id,
            'added_by'         => $p1->id,
        ]);

        // ─── P2 uploads their file to same folder ───────────────────────
        $p2File = File::factory()->create([
            'owner_id' => $p2->id,
            'status'   => \App\Enums\FileStatus::Available,
        ]);
        SharedFolderFile::create([
            'shared_folder_id' => $folderId,
            'file_id'          => $p2File->id,
            'added_by'         => $p2->id,
        ]);

        // ─── Both files visible in folder listing ───────────────────────
        $filesResponse = $this->actingAs($p2)
            ->getJson("/api/v1/shared-folders/{$folderId}/files");

        $filesResponse->assertOk();
        $fileIds = array_column($filesResponse->json('data.items'), 'id');
        $this->assertContains($p1File->id, $fileIds);
        $this->assertContains($p2File->id, $fileIds);

        // ─── P1 creates subfolder ───────────────────────────────────────
        $subResponse = $this->actingAs($p1)
            ->postJson("/api/v1/shared-folders/{$folderId}/subfolders", [
                'name' => 'Архив',
            ]);

        $subResponse->assertStatus(201);
        $subId = $subResponse->json('data.folder.id');

        // ─── P2 creates subfolder too (has edit) ────────────────────────
        $this->actingAs($p2)
            ->postJson("/api/v1/shared-folders/{$folderId}/subfolders", [
                'name' => 'P2 Sub',
            ])
            ->assertStatus(201);

        // ─── P1 moves file to private (file-level privacy) ──────────────
        $this->actingAs($p1)
            ->patchJson("/api/v1/shared-folders/{$folderId}/files/{$p1File->id}/privacy", [
                'is_private' => true,
            ])
            ->assertOk();

        // ─── P2 cannot see the private file ─────────────────────────────
        $filesAfterPrivacy = $this->actingAs($p2)
            ->getJson("/api/v1/shared-folders/{$folderId}/files");

        $filesAfterPrivacy->assertOk();
        $visibleIds = array_column($filesAfterPrivacy->json('data.items'), 'id');
        $this->assertNotContains($p1File->id, $visibleIds);
        $this->assertContains($p2File->id, $visibleIds);

        // ─── P1 still sees private file ─────────────────────────────────
        $p1Files = $this->actingAs($p1)
            ->getJson("/api/v1/shared-folders/{$folderId}/files");

        $p1Ids = array_column($p1Files->json('data.items'), 'id');
        $this->assertContains($p1File->id, $p1Ids);
    }
}
