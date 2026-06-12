<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\File;
use App\Models\FileRequest;
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

    public function notifyFileShared(User $recipient, string $senderName, string $fileName, string $fileId, bool $isInbox = false): void
    {
        if (!($recipient->notify_new_files ?? true)) {
            return;
        }
        $this->create(
            $recipient->id,
            NotificationType::FileShared,
            "Вам передан файл",
            "{$senderName} поделился файлом «{$fileName}»",
            ['file_id' => $fileId, 'is_inbox' => $isInbox],
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

    public function notifySharedFolderContentAdded(User $recipient, string $adderName, string $folderName, string $folderId, string $contentType, ?string $contentId = null): void
    {
        if (!($recipient->notify_shared_folder_updates ?? true)) {
            return;
        }

        $contentLabel = match($contentType) {
            'link' => 'ссылку',
            'note' => 'заметку',
            default => 'файл',
        };

        $data = ['folder_id' => $folderId];
        if ($contentId !== null) {
            $data['content_id'] = $contentId;
        }

        $this->create(
            $recipient->id,
            NotificationType::SharedFolderContentAdded,
            'Новое в общей папке',
            "{$adderName} добавил {$contentLabel} в папку «{$folderName}»",
            $data,
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

    public function notifyCommentCreated(User $recipient, string $authorName, string $fileName, string $fileId, string $threadId): void
    {
        if (!($recipient->notify_comments ?? true)) {
            return;
        }
        $this->create(
            $recipient->id,
            NotificationType::CommentCreated,
            'Новый комментарий',
            "{$authorName} оставил комментарий к «{$fileName}»",
            ['file_id' => $fileId, 'thread_id' => $threadId],
        );
    }

    public function notifyNoteChanged(User $recipient, string $authorName, string $folderName, string $folderId, string $threadId): void
    {
        if (!($recipient->notify_comments ?? true)) {
            return;
        }
        $this->create(
            $recipient->id,
            NotificationType::NoteChanged,
            'Изменена заметка',
            "{$authorName} изменил заметку в папке «{$folderName}»",
            ['folder_id' => $folderId, 'thread_id' => $threadId],
        );
    }

    public function notifyFileRequestFulfilled(User $requester, FileRequest $req): void
    {
        $short = mb_substr($req->description, 0, 60);
        $ellipsis = mb_strlen($req->description) > 60 ? '…' : '';
        $this->create(
            $requester->id,
            NotificationType::FileRequestFulfilled,
            'Файл получен по запросу',
            "Кто-то отправил файл по вашему запросу: «{$short}{$ellipsis}»",
            ['file_request_id' => $req->id],
        );
    }

    public function notifyAdmin(string $recipientUserId, string $title, ?string $body = null): void
    {
        $this->create($recipientUserId, NotificationType::AdminMessage, $title, $body);
    }
}
