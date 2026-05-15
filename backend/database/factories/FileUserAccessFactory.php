<?php

namespace Database\Factories;

use App\Models\FileUserAccess;
use App\Models\File;
use App\Models\User;
use App\Enums\AccessType;
use Illuminate\Database\Eloquent\Factories\Factory;

class FileUserAccessFactory extends Factory
{
    protected $model = FileUserAccess::class;

    public function definition(): array
    {
        return [
            'file_id'      => File::factory(),
            'user_id'      => User::factory(),
            'access_type'  => AccessType::Shared,
            'can_comment'  => true,
        ];
    }

    public function owner(): static
    {
        return $this->state(fn() => ['access_type' => AccessType::Owner]);
    }

    public function saved(): static
    {
        return $this->state(fn() => [
            'access_type' => AccessType::Saved,
            'saved_at'    => now(),
        ]);
    }

    public function favorite(): static
    {
        return $this->state(fn() => ['is_favorite' => true]);
    }

    public function pinned(): static
    {
        return $this->state(fn() => ['pinned_at' => now()]);
    }
}
