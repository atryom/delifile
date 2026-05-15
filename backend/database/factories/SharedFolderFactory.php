<?php

namespace Database\Factories;

use App\Models\SharedFolder;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SharedFolderFactory extends Factory
{
    protected $model = SharedFolder::class;

    public function definition(): array
    {
        return [
            'owner_id' => User::factory(),
            'name'     => $this->faker->word(),
        ];
    }

    public function childOf(SharedFolder $parent): static
    {
        return $this->state(fn() => [
            'owner_id'  => $parent->owner_id,
            'parent_id' => $parent->id,
        ]);
    }
}
