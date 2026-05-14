<?php

namespace App\Enums;

enum CommentScope: string
{
    case Shared  = 'shared';
    case Private = 'private';
}
