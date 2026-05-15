<?php

namespace Database\Factories;

use App\Models\ShareLink;
use App\Models\User;
use App\Models\File;
use App\Enums\ShareLinkStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

class ShareLinkFactory extends Factory
{
    protected $model = ShareLink::class;

    public function definition(): array
    {
        return [
            'file_id'     => File::factory(),
            'created_by'  => User::factory(),
            'token'       => $this->faker->unique()->lexify('????????????????????????????????'),
            'status'      => ShareLinkStatus::Active,
            'ttl_hours'   => 12,
            'expires_at'  => now()->addHours(12),
            'allow_save'  => false,
        ];
    }

    public function disabled(): static
    {
        return $this->state(fn() => ['status' => ShareLinkStatus::Disabled]);
    }

    public function expired(): static
    {
        return $this->state(fn() => ['status' => ShareLinkStatus::Expired, 'expires_at' => now()->subHour()]);
    }

    public function withSave(): static
    {
        return $this->state(fn() => ['allow_save' => true]);
    }
}
