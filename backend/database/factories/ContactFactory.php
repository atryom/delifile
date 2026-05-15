<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ContactFactory extends Factory
{
    protected $model = Contact::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name'    => $this->faker->name(),
            'phone'   => $this->faker->unique()->phoneNumber(),
            'email'   => $this->faker->safeEmail(),
        ];
    }

    public function resolvedTo(User $user): static
    {
        return $this->state(fn() => ['resolved_user_id' => $user->id]);
    }
}
