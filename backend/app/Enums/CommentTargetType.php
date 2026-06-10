<?php

namespace App\Enums;

enum CommentTargetType: string
{
    case File         = 'file';
    case SharedFolder = 'shared_folder';
}
