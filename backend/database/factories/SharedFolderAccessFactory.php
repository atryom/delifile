<?php

namespace Database\Factories;

use App\Models\SharedFolderAccess;
use App\Models\SharedFolder;
use App\Models\User;
use App\Enums\SharedFolderAccessType;
use Illuminate\Database\Eloquent\Factories\Factory;

class SharedFolderAccessFactory extends Factory
{
    protected $model = SharedFolderAccess::class;

    public function definition(): array
    {
        return [
            'shared_folder_id' => SharedFolder::factory(),
            'user_id'          => User::factory(),
            'access_type'      => SharedFolderAccessType::View,
        ];
    }

    public function edit(): static
    {
        return $this->state(fn() => ['access_type' => SharedFolderAccessType::Edit]);
    }
}
