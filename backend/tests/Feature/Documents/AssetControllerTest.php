<?php

namespace Tests\Feature\Documents;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use App\Services\S3UrlService;
use Mockery;
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
                    'items' => [['id', 'fileName', 'mimeType', 'size', 'previewUrl', 'embedUrl', 'stableUrl']],
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

    public function test_stable_url_is_always_auth_required_content_path(): void
    {
        $user = User::factory()->create();

        $image = File::factory()->create([
            'owner_id'  => $user->id,
            'mime_type' => 'image/webp',
            'status'    => FileStatus::Available,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/assets/images');

        $item = $response->json('data.items.0');
        $this->assertArrayHasKey('stableUrl', $item);
        $this->assertEquals('/api/v1/files/' . $image->id . '/content', $item['stableUrl']);
    }

    /**
     * Regression test: embedUrl must be a presigned S3 URL so the browser <img> tag
     * can load the image immediately after insertion without auth headers.
     *
     * Bug in Sprint 7-22: embedUrl (formerly assetUrl) was set to the same stable
     * /content path as stableUrl. Because /content requires auth:sanctum and browser
     * <img> tags cannot send Bearer tokens, the image showed as broken (401) after
     * insertion and only appeared correctly after document reload (when hydrateImageUrls
     * replaced stable URLs with presigned ones).
     */
    public function test_embed_url_is_presigned_when_s3_available(): void
    {
        $user  = User::factory()->create();
        $image = File::factory()->create([
            'owner_id'    => $user->id,
            'mime_type'   => 'image/png',
            'status'      => FileStatus::Available,
            'storage_key' => 'files/' . $user->id . '/photo.png',
        ]);

        $fakePresigned = 'https://s3.example.com/bucket/files/' . $user->id
            . '/photo.png?X-Amz-Algorithm=AWS4&X-Amz-Signature=deadbeef';

        $s3Mock = Mockery::mock(S3UrlService::class);
        $s3Mock->shouldReceive('tryTemporaryUrl')->andReturn($fakePresigned);
        $this->app->instance(S3UrlService::class, $s3Mock);

        $response = $this->actingAs($user)->getJson('/api/v1/assets/images');
        $item     = $response->json('data.items.0');

        $this->assertEquals($fakePresigned, $item['embedUrl']);
        // embedUrl must differ from stableUrl — if they match the browser gets 401 on insert
        $this->assertNotEquals($item['stableUrl'], $item['embedUrl']);
    }

    public function test_embed_url_falls_back_to_stable_url_when_s3_unavailable(): void
    {
        $user  = User::factory()->create();
        $image = File::factory()->create([
            'owner_id'  => $user->id,
            'mime_type' => 'image/png',
            'status'    => FileStatus::Available,
        ]);

        $s3Mock = Mockery::mock(S3UrlService::class);
        $s3Mock->shouldReceive('tryTemporaryUrl')->andReturnNull();
        $this->app->instance(S3UrlService::class, $s3Mock);

        $response = $this->actingAs($user)->getJson('/api/v1/assets/images');
        $item     = $response->json('data.items.0');

        $this->assertEquals($item['stableUrl'], $item['embedUrl']);
        $this->assertStringContainsString('/content', $item['embedUrl']);
    }

    public function test_cursor_pagination_returns_next_cursor_and_second_page(): void
    {
        $user = User::factory()->create();

        File::factory()->count(3)->create([
            'owner_id'  => $user->id,
            'mime_type' => 'image/jpeg',
            'status'    => FileStatus::Available,
        ]);

        // First page: 2 items + cursor
        $page1 = $this->actingAs($user)
            ->getJson('/api/v1/assets/images?per_page=2');

        $page1->assertOk();
        $this->assertCount(2, $page1->json('data.items'));
        $cursor = $page1->json('data.nextCursor');
        $this->assertNotNull($cursor);

        // Second page: 1 remaining item, no cursor
        $page2 = $this->actingAs($user)
            ->getJson('/api/v1/assets/images?per_page=2&cursor=' . $cursor);

        $page2->assertOk();
        $this->assertCount(1, $page2->json('data.items'));
        $this->assertNull($page2->json('data.nextCursor'));

        // No overlap between pages
        $ids1 = collect($page1->json('data.items'))->pluck('id');
        $ids2 = collect($page2->json('data.items'))->pluck('id');
        $this->assertEmpty($ids1->intersect($ids2));
    }
}
