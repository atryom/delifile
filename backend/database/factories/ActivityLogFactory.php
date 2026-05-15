<?php

namespace Database\Factories;

use App\Models\ActivityLog;
use App\Models\File;
use App\Models\User;
use App\Enums\ActivityType;
use Illuminate\Database\Eloquent\Factories\Factory;

class ActivityLogFactory extends Factory
{
    protected $model = ActivityLog::class;

    public function definition(): array
    {
        return [
            'file_id' => File::factory(),
            'user_id' => User::factory(),
            'action'  => ActivityType::Uploaded,
            'meta'    => [],
            'created_at' => now(),
        ];
    }

    public function ofType(ActivityType $type): static
    {
        return $this->state(fn() => ['action' => $type]);
    }
}
