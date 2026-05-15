<?php

namespace Tests\Feature\Links;

use App\Models\File;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class UrlFileTest extends TestCase
{
    public function test_preview_returns_metadata(): void
    {
        $user = User::factory()->create();
        Http::fake([
            'example.com' => Http::response(
                '<html><head><title>Test Page</title><meta property="og:description" content="A test page"></head></html>'
            ),
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/links-preview', ['url' => 'https://example.com']);

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['preview' => ['title', 'description', 'hostname']]]);
    }

    public function test_preview_requires_valid_url(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/links-preview', ['url' => 'not-a-url']);

        $response->assertStatus(422);
    }

    public function test_preview_returns_minimal_on_fetch_failure(): void
    {
        $user = User::factory()->create();
        Http::fake([
            'example.com' => Http::response('', 500),
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/links-preview', ['url' => 'https://example.com']);

        $response->assertOk()
            ->assertJsonPath('data.preview.title', 'example.com');
    }

    public function test_user_can_create_url_file(): void
    {
        $user = User::factory()->create();
        Http::fake([
            'example.com' => Http::response('<html><title>Example</title></html>'),
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/url-files', ['url' => 'https://example.com']);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['file' => ['id', 'original_name']]]);
    }

    public function test_create_url_file_requires_valid_url(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/url-files', ['url' => 'invalid']);

        $response->assertStatus(422);
    }

    public function test_created_url_file_has_correct_type(): void
    {
        $user = User::factory()->create();
        Http::fake([
            'example.com' => Http::response('<html><title>Example</title></html>'),
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/url-files', ['url' => 'https://example.com']);

        $response->assertStatus(201);
        $fileId = $response->json('data.file.id');
        $file = File::find($fileId);
        $this->assertNotNull($file);
        $this->assertEquals('url_file', $file->content_kind);
        $this->assertEquals('https://example.com', $file->link_url);
    }

    public function test_create_url_file_without_auth_returns_401(): void
    {
        $response = $this->postJson('/api/v1/url-files', ['url' => 'https://example.com']);
        $response->assertUnauthorized();
    }

    public function test_preview_without_auth_returns_401(): void
    {
        $response = $this->postJson('/api/v1/links-preview', ['url' => 'https://example.com']);
        $response->assertUnauthorized();
    }
}
