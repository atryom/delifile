<?php

namespace App\Enums;

enum SharedCommentMode: string
{
    case Enabled          = 'enabled';
    case Disabled         = 'disabled';
    case InheritForItems  = 'inherit_for_items';
}
