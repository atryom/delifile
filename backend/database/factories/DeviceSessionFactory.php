<?php

namespace Database\Factories;

use App\Models\DeviceSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DeviceSessionFactory extends Factory
{
    protected $model = DeviceSession::class;

    public function definition(): array
    {
        return [
            'user_id'        => User::factory(),
            'device_name'    => $this->faker->userAgent(),
            'user_agent'     => $this->faker->userAgent(),
            'ip_address'     => $this->faker->ipv4(),
            'last_active_at' => now(),
        ];
    }
}
