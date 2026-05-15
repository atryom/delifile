<?php

namespace Database\Factories;

use App\Models\User;
use App\Enums\TariffPlan;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'phone'         => $this->faker->unique()->phoneNumber(),
            'email'         => $this->faker->unique()->safeEmail(),
            'name'          => $this->faker->name(),
            'password'      => static::$password ??= Hash::make('password'),
            'account_status' => 'active',
            'plan'          => TariffPlan::Free,
            'email_verified_at' => now(),
            'is_superuser'  => false,
            'notifications_enabled' => true,
            'notify_new_files' => true,
            'notify_contacts_added' => true,
            'allow_contacts_without_confirmation' => false,
            'auto_add_received_files' => false,
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn() => [
            'email_verified_at' => null,
            'account_status' => 'pending_email_verification',
            'email_verification_token' => Str::random(60),
            'email_verification_sent_at' => now(),
            'email_verification_deadline_at' => now()->addHours(24),
        ]);
    }

    public function blocked(): static
    {
        return $this->state(fn() => [
            'email_verified_at' => null,
            'account_status' => 'blocked_unverified_email',
            'email_verification_deadline_at' => now()->subHour(),
        ]);
    }

    public function superuser(): static
    {
        return $this->state(fn() => ['is_superuser' => true]);
    }

    public function silver(): static
    {
        return $this->state(fn() => ['plan' => TariffPlan::Silver]);
    }

    public function gold(): static
    {
        return $this->state(fn() => ['plan' => TariffPlan::Gold]);
    }
}
