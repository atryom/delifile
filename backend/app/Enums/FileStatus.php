<?php

namespace App\Enums;

enum FileStatus: string
{
    case Uploading  = 'uploading';
    case Available  = 'available';
    case Processing = 'processing';
    case Expired    = 'expired';
    case Deleted    = 'deleted';

    public function label(): string
    {
        return match($this) {
            self::Uploading  => 'Uploading',
            self::Available  => 'Available',
            self::Processing => 'Processing',
            self::Expired    => 'Expired',
            self::Deleted    => 'Deleted',
        };
    }

    public function isAccessible(): bool
    {
        return $this === self::Available;
    }
}
