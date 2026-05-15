<?php

namespace Database\Factories;

use App\Models\File;
use App\Models\User;
use App\Enums\FileStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

class FileFactory extends Factory
{
    protected $model = File::class;

    public function definition(): array
    {
        return [
            'owner_id'      => User::factory(),
            'original_name' => $this->faker->word() . '.' . $this->faker->fileExtension(),
            'storage_key'   => 'files/' . $this->faker->uuid() . '/' . $this->faker->uuid(),
            'size'          => $this->faker->numberBetween(1024, 10485760),
            'mime_type'     => $this->faker->mimeType(),
            'status'        => FileStatus::Available,
            'expires_at'    => now()->addHours(12),
            'content_kind'  => 'binary_file',
        ];
    }

    public function uploading(): static
    {
        return $this->state(fn() => ['status' => FileStatus::Uploading, 'expires_at' => null]);
    }

    public function expired(): static
    {
        return $this->state(fn() => ['status' => FileStatus::Expired, 'expires_at' => now()->subHour()]);
    }

    public function urlFile(): static
    {
        return $this->state(fn() => [
            'content_kind' => 'url_file',
            'link_url'     => $this->faker->url(),
            'link_title'   => $this->faker->sentence(),
        ]);
    }
}
