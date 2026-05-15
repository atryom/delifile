<?php

namespace Database\Factories;

use App\Models\Invitation;
use App\Models\User;
use App\Models\File;
use Illuminate\Database\Eloquent\Factories\Factory;

class InvitationFactory extends Factory
{
    protected $model = Invitation::class;

    public function definition(): array
    {
        return [
            'sender_user_id' => User::factory(),
            'target_email'   => $this->faker->safeEmail(),
            'token'          => $this->faker->unique()->lexify('????????????????????????????????'),
            'status'         => 'pending',
            'expires_at'     => now()->addDays(7),
        ];
    }

    public function forFile(File $file): static
    {
        return $this->state(fn() => ['file_id' => $file->id]);
    }

    public function accepted(User $user): static
    {
        return $this->state(fn() => [
            'status'              => 'accepted',
            'accepted_by_user_id' => $user->id,
        ]);
    }
}
