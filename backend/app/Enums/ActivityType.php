<?php

namespace App\Enums;

enum ActivityType: string
{
    case Uploaded          = 'uploaded';
    case Downloaded        = 'downloaded';
    case SharedToContact   = 'shared_to_contact';
    case ShareRevoked      = 'share_revoked';
    case LinkCreated       = 'link_created';
    case LinkDisabled      = 'link_disabled';
    case Pinned            = 'pinned';
    case Unpinned          = 'unpinned';
    case Favorited         = 'favorited';
    case Unfavorited       = 'unfavorited';
    case MovedToFolder     = 'moved_to_folder';
    case TagUpdated        = 'tag_updated';
    case SavedByRecipient  = 'saved_by_recipient';
    case Deleted           = 'deleted';

    public function label(): string
    {
        return match($this) {
            self::Uploaded         => 'File uploaded',
            self::Downloaded       => 'File downloaded',
            self::SharedToContact  => 'Shared to contact',
            self::ShareRevoked     => 'Share access revoked',
            self::LinkCreated      => 'Public link created',
            self::LinkDisabled     => 'Public link disabled',
            self::Pinned           => 'File pinned',
            self::Unpinned         => 'File unpinned',
            self::Favorited        => 'Added to favorites',
            self::Unfavorited      => 'Removed from favorites',
            self::MovedToFolder    => 'Moved to folder',
            self::TagUpdated       => 'Tags updated',
            self::SavedByRecipient => 'Saved by recipient',
            self::Deleted          => 'File deleted',
        };
    }
}
