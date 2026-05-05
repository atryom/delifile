<?php

namespace App\Enums;

enum TariffPlan: string
{
    case Free   = 'free';
    case Silver = 'silver';
    case Gold   = 'gold';

    public function fileSizeLimitBytes(): int
    {
        return match($this) {
            self::Free   =>  50 * 1024 * 1024,
            self::Silver => 100 * 1024 * 1024,
            self::Gold   => 150 * 1024 * 1024,
        };
    }

    public function storageLimitBytes(): int
    {
        return match($this) {
            self::Free   =>   500 * 1024 * 1024,
            self::Silver =>  3072 * 1024 * 1024,
            self::Gold   => 10240 * 1024 * 1024,
        };
    }

    public function deviceLimit(): ?int
    {
        return match($this) {
            self::Free   => 3,
            self::Silver => 5,
            self::Gold   => null,
        };
    }

    public function priceRub(): int
    {
        return match($this) {
            self::Free   => 0,
            self::Silver => 100,
            self::Gold   => 300,
        };
    }
}
