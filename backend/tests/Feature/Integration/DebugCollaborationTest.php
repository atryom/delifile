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

class DebugCollaborationTest extends TestCase
{
    public function test_debug(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();

        // Step 1: P1 creates folder
        $folderResponse = $this->actingAs($p1)
            ->postJson('/api/v1/shared-folders', ['name' => 'Project']);
        
        $status1 = $folderResponse->status();
        echo "Step 1 (create folder): $status1\n";
        if ($status1 !== 201) {
            echo "Body: " . $folderResponse->content() . "\n";
            return;
        }
        
        $folderId = $folderResponse->json('data.folder.id');
        echo "Folder ID: $folderId\n";

        // Step 2: Create contact and add access
        $contact = Contact::factory()->resolvedTo($p2)->create([
            'user_id' => $p1->id,
            'email'   => $p2->email,
        ]);
        echo "Contact ID: {$contact->id}, resolved_user_id: {$contact->resolved_user_id}\n";

        $accessResponse = $this->actingAs($p1)
            ->postJson("/api/v1/shared-folders/{$folderId}/accesses", [
                'contact_id'  => $contact->id,
                'access_type' => 'edit',
            ]);
        
        $status2 = $accessResponse->status();
        echo "Step 2 (add access): $status2\n";
        if ($status2 !== 201) {
            echo "Body: " . $accessResponse->content() . "\n";
            return;
        }

        // Step 3: P2 lists folders
        $listResponse = $this->actingAs($p2)
            ->getJson('/api/v1/shared-folders');
        
        $status3 = $listResponse->status();
        echo "Step 3 (P2 lists folders): $status3\n";
        echo "Body: " . $listResponse->content() . "\n";
    }
}
