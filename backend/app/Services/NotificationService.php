<?php

namespace App\Services;

use App\Enums\NotificationType;
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

    public function notifyFileShared(string $recipientUserId, string $senderName, string $fileName, string $fileId): void
    {
        $this->create(
            $recipientUserId,
            NotificationType::FileShared,
            "Вам передан файл",
            "{$senderName} поделился файлом «{$fileName}»",
            ['file_id' => $fileId],
        );
    }

    public function notifyFolderShared(string $recipientUserId, string $senderName, string $folderName, string $folderId): void
    {
        $this->create(
            $recipientUserId,
            NotificationType::FolderShared,
            "Вам открыт доступ к папке",
            "{$senderName} открыл доступ к папке «{$folderName}»",
            ['folder_id' => $folderId],
        );
    }

    public function notifyContactRequest(string $recipientUserId, string $requesterName, string $requesterId): void
    {
        $this->create(
            $recipientUserId,
            NotificationType::ContactRequest,
            "Запрос на добавление в контакты",
            "{$requesterName} хочет добавить вас в контакты",
            ['requester_id' => $requesterId],
        );
    }

    public function notifyAdmin(string $recipientUserId, string $title, ?string $body = null): void
    {
        $this->create($recipientUserId, NotificationType::AdminMessage, $title, $body);
    }
}
