<?php

namespace Tests\Feature\Documents;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use Tests\TestCase;

class AssetControllerTest extends TestCase
{
    public function test_user_sees_own_images(): void
    {
        $user = User::factory()->create();

        File::factory()->create([
            'owner_id'  => $user->id,
            'mime_type' => 'image/png',
            'status'    => FileStatus::Available,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/assets/images');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'items' => [['id', 'fileName', 'mimeType', 'size', 'previewUrl', 'assetUrl']],
                    'nextCursor',
                ],
            ]);

        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_user_sees_shared_images(): void
    {
        $owner  = User::factory()->create();
        $viewer = User::factory()->create();

        $image = File::factory()->create([
            'owner_id'  => $owner->id,
            'mime_type' => 'image/jpeg',
            'status'    => FileStatus::Available,
        ]);

        FileUserAccess::factory()->create([
            'file_id'     => $image->id,
            'user_id'     => $viewer->id,
            'access_type' => AccessType::Shared,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson('/api/v1/assets/images');

        $response->assertOk();
        $ids = collect($response->json('data.items'))->pluck('id');
        $this->assertTrue($ids->contains($image->id));
    }

    public function test_user_does_not_see_other_users_images(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        File::factory()->create([
            'owner_id'  => $owner->id,
            'mime_type' => 'image/png',
            'status'    => FileStatus::Available,
        ]);

        $response = $this->actingAs($other)
            ->getJson('/api/v1/assets/images');

        $response->assertOk();
        $this->assertCount(0, $response->json('data.items'));
    }

    public function test_non_image_files_are_excluded(): void
    {
        $user = User::factory()->create();

        File::factory()->create([
            'owner_id'  => $user->id,
            'mime_type' => 'application/pdf',
            'status'    => FileStatus::Available,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/assets/images');

        $response->assertOk();
        $this->assertCount(0, $response->json('data.items'));
    }

    public function test_images_can_be_filtered_by_search(): void
    {
        $user = User::factory()->create();

        File::factory()->create([
            'owner_id'      => $user->id,
            'original_name' => 'logo.png',
            'mime_type'     => 'image/png',
            'status'        => FileStatus::Available,
        ]);

        File::factory()->create([
            'owner_id'      => $user->id,
            'original_name' => 'banner.jpg',
            'mime_type'     => 'image/jpeg',
            'status'        => FileStatus::Available,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/assets/images?search=logo');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
        $this->assertEquals('logo.png', $response->json('data.items.0.fileName'));
    }

    public function test_images_endpoint_requires_auth(): void
    {
        $this->getJson('/api/v1/assets/images')
            ->assertUnauthorized();
    }

    public function test_asset_url_uses_stable_application_path(): void
    {
        $user = User::factory()->create();

        $image = File::factory()->create([
            'owner_id'  => $user->id,
            'mime_type' => 'image/png',
            'status'    => FileStatus::Available,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/assets/images');

        $assetUrl = $response->json('data.items.0.assetUrl');
        $this->assertStringContainsString('/api/v1/files/' . $image->id . '/content', $assetUrl);
        $this->assertStringNotContainsString('X-Amz-Signature', $assetUrl);
    }
}
