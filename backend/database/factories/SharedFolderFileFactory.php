<?php

namespace Database\Factories;

use App\Models\SharedFolderFile;
use App\Models\SharedFolder;
use App\Models\File;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SharedFolderFileFactory extends Factory
{
    protected $model = SharedFolderFile::class;

    public function definition(): array
    {
        return [
            'shared_folder_id' => SharedFolder::factory(),
            'file_id'          => File::factory(),
            'added_by'         => User::factory(),
        ];
    }
}
