<?php

namespace Database\Factories;

use App\Models\Folder;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class FolderFactory extends Factory
{
    protected $model = Folder::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name'    => $this->faker->word(),
        ];
    }

    public function childOf(Folder $parent): static
    {
        return $this->state(fn() => [
            'user_id'   => $parent->user_id,
            'parent_id' => $parent->id,
        ]);
    }
}
