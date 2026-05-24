<?php

namespace App\Enums;

enum NotificationType: string
{
    case AdminMessage    = 'admin_message';
    case FileShared      = 'file_shared';
    case FolderShared    = 'folder_shared';
    case ContactRequest  = 'contact_request';
    case AccessChanged   = 'access_changed';
    case FileExpired     = 'file_expired';

    public function group(): string
    {
        return match($this) {
            self::AdminMessage   => 'administrative',
            self::FileShared,
            self::FolderShared,
            self::AccessChanged  => 'access',
            self::ContactRequest => 'contacts',
            self::FileExpired    => 'other',
        };
    }

    public function label(): string
    {
        return match($this) {
            self::AdminMessage   => 'Administrative message',
            self::FileShared     => 'File shared',
            self::FolderShared   => 'Folder shared',
            self::ContactRequest => 'Contact request',
            self::AccessChanged  => 'Access changed',
            self::FileExpired    => 'File expired',
        };
    }
}
