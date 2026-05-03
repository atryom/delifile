<?php

return [
    'default' => env('FILESYSTEM_DISK', 's3'),

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root'   => storage_path('app'),
            'throw'  => false,
        ],

        'public' => [
            'driver'     => 'local',
            'root'       => storage_path('app/public'),
            'url'        => env('APP_URL') . '/storage',
            'visibility' => 'public',
            'throw'      => false,
        ],

        /*
        |----------------------------------------------------------------------
        | S3 Private Bucket — FileSpace primary storage
        |----------------------------------------------------------------------
        | Files are NEVER publicly accessible.
        | All downloads go through backend permission check + presigned URL.
        |
        */
        's3' => [
            'driver'                  => 's3',
            'key'                     => env('AWS_ACCESS_KEY_ID'),
            'secret'                  => env('AWS_SECRET_ACCESS_KEY'),
            'region'                  => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'bucket'                  => env('AWS_BUCKET'),
            'url'                     => env('AWS_URL'),
            'endpoint'                => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'visibility'              => 'private',  // Always private
            'throw'                   => true,
            'presigned_url_ttl'       => (int) env('S3_PRESIGNED_URL_TTL', 3600),
        ],
    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],
];
