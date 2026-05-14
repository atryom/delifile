<?php

namespace App\Enums;

enum SharedCommentOverride: string
{
    case Inherit  = 'inherit';
    case Enabled  = 'enabled';
    case Disabled = 'disabled';
}
