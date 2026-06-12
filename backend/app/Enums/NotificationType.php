<?php

namespace App\Enums;

enum NotificationType: string
{
    case AdminMessage              = 'admin_message';
    case FileShared                = 'file_shared';
    case FolderShared              = 'folder_shared';
    case ContactRequest            = 'contact_request';
    case SharedFolderContentAdded  = 'shared_folder_content_added';
    case TaskAssigned              = 'task_assigned';
    case CommentCreated            = 'comment_created';
    case NoteChanged               = 'note_changed';
    case FileRequestFulfilled      = 'file_request_fulfilled';

    public function group(): string
    {
        return match($this) {
            self::AdminMessage              => 'administrative',
            self::FileShared,
            self::FolderShared,
            self::SharedFolderContentAdded,
            self::TaskAssigned,
            self::FileRequestFulfilled      => 'access',
            self::ContactRequest            => 'contacts',
            self::CommentCreated,
            self::NoteChanged               => 'comments',
        };
    }

    public function label(): string
    {
        return match($this) {
            self::AdminMessage             => 'Administrative message',
            self::FileShared               => 'File shared',
            self::FolderShared             => 'Folder shared',
            self::ContactRequest           => 'Contact request',
            self::SharedFolderContentAdded => 'Content added to shared folder',
            self::TaskAssigned             => 'Task assigned',
            self::CommentCreated           => 'New comment',
            self::NoteChanged              => 'Note changed',
            self::FileRequestFulfilled     => 'File request fulfilled',
        };
    }
}
