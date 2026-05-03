<?php

return [
    'name'  => env('APP_NAME', 'FileSpace'),
    'env'   => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url'   => env('APP_URL', 'http://localhost'),

    'timezone'  => 'UTC',
    'locale'    => env('APP_LOCALE', 'en'),
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),
    'faker_locale'    => env('APP_FAKER_LOCALE', 'en_US'),

    'cipher' => 'AES-256-CBC',
    'key'    => env('APP_KEY'),

    'previous_keys' => array_filter(
        explode(',', env('APP_PREVIOUS_KEYS', ''))
    ),

    'maintenance' => ['driver' => env('APP_MAINTENANCE_DRIVER', 'file')],

    // FileSpace product settings
    'file_default_ttl_hours' => (int) env('FILE_DEFAULT_TTL_HOURS', 12),
    'file_max_size_mb'        => (int) env('FILE_MAX_SIZE_MB', 100),
];
