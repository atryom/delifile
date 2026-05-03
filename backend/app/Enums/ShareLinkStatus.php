<?php

namespace App\Enums;

enum ShareLinkStatus: string
{
    case Active   = 'active';
    case Disabled = 'disabled';
    case Expired  = 'expired';

    public function isUsable(): bool
    {
        return $this === self::Active;
    }
}
