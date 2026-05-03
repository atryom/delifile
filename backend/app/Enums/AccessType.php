<?php

namespace App\Enums;

enum AccessType: string
{
    case Owner  = 'owner';
    case Shared = 'shared';
    case Saved  = 'saved';

    public function label(): string
    {
        return match($this) {
            self::Owner  => 'Owner',
            self::Shared => 'Shared',
            self::Saved  => 'Saved',
        };
    }
}
