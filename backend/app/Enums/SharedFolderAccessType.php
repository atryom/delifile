<?php

namespace App\Enums;

enum SharedFolderAccessType: string
{
    case View = 'view';
    case Edit = 'edit';
}
