<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\File;
use App\Models\User;
use App\Models\UserNotification;

class NotificationService
{
    public function create(
        string $userId,
        NotificationType $type,
        string $title,
        ?string $body = null,
        ?array $data = null,
    ): UserNotification {
        return UserNotification::create([
            'user_id' => $userId,
            'type'    => $type,
            'title'   => $title,
            'body'    => $body,
            'data'    => $data,
        ]);
    }

    public function notifyFileShared(User $recipient, string $senderName, string $fileName, string $fileId): void
    {
        if (!($recipient->notify_new_files ?? true)) {
            return;
        }
        $this->create(
            $recipient->id,
            NotificationType::FileShared,
            "Вам передан файл",
            "{$senderName} поделился файлом «{$fileName}»",
            ['file_id' => $fileId],
        );
    }

    public function notifyFolderShared(User $recipient, string $senderName, string $folderName, string $folderId): void
    {
        if (!($recipient->notify_folder_shared ?? true)) {
            return;
        }
        $this->create(
            $recipient->id,
            NotificationType::FolderShared,
            "Вам открыт доступ к папке",
            "{$senderName} открыл доступ к папке «{$folderName}»",
            ['folder_id' => $folderId],
        );
    }

    public function notifyContactRequest(User $recipient, string $requesterName, string $requesterId): void
    {
        if (!($recipient->notify_contacts_added ?? true)) {
            return;
        }
        $this->create(
            $recipient->id,
            NotificationType::ContactRequest,
            "Запрос на добавление в контакты",
            "{$requesterName} хочет добавить вас в контакты",
            ['requester_id' => $requesterId],
        );
    }

    public function notifySharedFolderContentAdded(User $recipient, string $adderName, string $folderName, string $folderId, string $contentType): void
    {
        if (!($recipient->notify_shared_folder_updates ?? true)) {
            return;
        }

        $contentLabel = match($contentType) {
            'link' => 'ссылку',
            'note' => 'заметку',
            default => 'файл',
        };

        $this->create(
            $recipient->id,
            NotificationType::SharedFolderContentAdded,
            'Новое в общей папке',
            "{$adderName} добавил {$contentLabel} в папку «{$folderName}»",
            ['folder_id' => $folderId],
        );
    }

    public function notifyTaskAssigned(User $assignee, File $file, User $assigner): void
    {
        $fileName = $file->display_name ?? $file->original_name;
        $this->create(
            $assignee->id,
            NotificationType::TaskAssigned,
            'Вы назначены исполнителем',
            "{$assigner->name} назначил вас исполнителем задачи «{$fileName}»",
            ['file_id' => $file->id],
        );
    }

    public function notifyAdmin(string $recipientUserId, string $title, ?string $body = null): void
    {
        $this->create($recipientUserId, NotificationType::AdminMessage, $title, $body);
    }
}
