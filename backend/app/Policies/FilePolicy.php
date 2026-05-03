<?php

namespace App\Policies;

use App\Models\File;
use App\Models\User;
use App\Models\FileUserAccess;

class FilePolicy
{
    /**
     * Any authenticated user can attempt to view files (access checked separately).
     */
    public function view(User $user, File $file): bool
    {
        if ($file->isOwnedBy($user)) {
            return true;
        }

        return FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Only owner can delete.
     */
    public function delete(User $user, File $file): bool
    {
        return $file->isOwnedBy($user);
    }

    /**
     * Only owner can share.
     */
    public function share(User $user, File $file): bool
    {
        return $file->isOwnedBy($user);
    }

    /**
     * Only owner can create links.
     */
    public function createLink(User $user, File $file): bool
    {
        return $file->isOwnedBy($user);
    }

    /**
     * Anyone with access can pin/save.
     */
    public function pin(User $user, File $file): bool
    {
        return $this->view($user, $file);
    }
}
