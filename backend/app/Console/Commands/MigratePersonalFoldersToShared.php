<?php

namespace App\Console\Commands;

use App\Models\File;
use App\Models\Folder;
use App\Models\SharedFolder;
use App\Models\SharedFolderFile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigratePersonalFoldersToShared extends Command
{
    protected $signature = 'folders:migrate-to-shared
                            {--dry-run   : Show what would be migrated without making changes}
                            {--user=     : Migrate only the specified user ID}
                            {--verify    : After migration, compare counts and report discrepancies}';

    protected $description = 'Migrate personal folders (folders table) into the shared-folders system';

    private int $foldersCreated = 0;
    private int $filesLinked    = 0;
    private int $filesSkipped   = 0;

    public function handle(): int
    {
        $isDryRun    = (bool) $this->option('dry-run');
        $targetUser  = $this->option('user');
        $verify      = (bool) $this->option('verify');

        if ($isDryRun) {
            $this->warn('=== DRY RUN — никаких изменений не будет ===');
        }

        $users = $targetUser
            ? User::where('id', $targetUser)->get()
            : User::all();

        if ($users->isEmpty()) {
            $this->error('Пользователи не найдены.');
            return 1;
        }

        // ── Pre-migration counts ──────────────────────────────────────────────
        $preFolders = Folder::count();
        $preFiles   = File::whereNotNull('folder_id')->count();
        $this->info("До миграции: личных папок = {$preFolders}, файлов с folder_id = {$preFiles}");
        $this->newLine();

        foreach ($users as $user) {
            $this->processUser($user, $isDryRun);
        }

        $this->newLine();
        $this->info("Итог: папок создано = {$this->foldersCreated}, файлов привязано = {$this->filesLinked}, пропущено = {$this->filesSkipped}");

        // ── Verify ────────────────────────────────────────────────────────────
        if ($verify && !$isDryRun) {
            $this->newLine();
            $this->info('=== Верификация ===');

            // Every file that had a folder_id should now have a shared_folder_files record
            $orphans = File::whereNotNull('folder_id')
                ->whereDoesntHave('sharedFolderFiles')
                ->count();

            if ($orphans > 0) {
                $this->error("Файлов без shared_folder_files после миграции: {$orphans}");
            } else {
                $this->info('Все файлы с folder_id привязаны к shared_folder_files. OK');
            }
        }

        return 0;
    }

    private function processUser(User $user, bool $isDryRun): void
    {
        $personalFolders = Folder::where('user_id', $user->id)->count();
        $personalFiles   = File::where('owner_id', $user->id)->whereNotNull('folder_id')->count();

        $this->line("User #{$user->id} {$user->email} — папок: {$personalFolders}, файлов в папках: {$personalFiles}");

        if ($personalFolders === 0) {
            $this->line('  (нет личных папок — пропуск)');
            return;
        }

        if ($isDryRun) {
            $this->previewUser($user);
            return;
        }

        DB::transaction(function () use ($user) {
            $folderMap = [];
            $this->migrateFolderLevel($user, null, null, $folderMap);
            $this->migrateUserFiles($user, $folderMap);
        });
    }

    private function migrateFolderLevel(User $user, ?string $localParentId, ?string $sharedParentId, array &$folderMap): void
    {
        $children = Folder::where('user_id', $user->id)
            ->where('parent_id', $localParentId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        foreach ($children as $folder) {
            // Idempotency: find existing SharedFolder with same owner/parent/name
            $query = SharedFolder::where('owner_id', $user->id)
                ->where('name', $folder->name);

            if ($sharedParentId === null) {
                $query->whereNull('parent_id');
            } else {
                $query->where('parent_id', $sharedParentId);
            }

            $shared = $query->first();

            if (!$shared) {
                $shared = SharedFolder::create([
                    'owner_id'   => $user->id,
                    'parent_id'  => $sharedParentId,
                    'name'       => $folder->name,
                    'sort_order' => $folder->sort_order,
                    'is_private' => false,
                ]);
                $this->foldersCreated++;
                $this->line("  + SharedFolder «{$folder->name}»");
            } else {
                $this->line("  ~ SharedFolder «{$folder->name}» уже существует — используем");
            }

            $folderMap[$folder->id] = $shared->id;

            // Recurse into children
            $this->migrateFolderLevel($user, $folder->id, $shared->id, $folderMap);
        }
    }

    private function migrateUserFiles(User $user, array $folderMap): void
    {
        $files = File::where('owner_id', $user->id)
            ->whereNotNull('folder_id')
            ->get();

        foreach ($files as $file) {
            $sharedFolderId = $folderMap[$file->folder_id] ?? null;

            if (!$sharedFolderId) {
                $this->warn("  ! Файл {$file->id} ({$file->original_name}): folder_id {$file->folder_id} не в карте — пропуск");
                $this->filesSkipped++;
                continue;
            }

            // Idempotency: skip if already linked
            $exists = SharedFolderFile::where('file_id', $file->id)
                ->where('shared_folder_id', $sharedFolderId)
                ->exists();

            if (!$exists) {
                SharedFolderFile::create([
                    'shared_folder_id' => $sharedFolderId,
                    'file_id'          => $file->id,
                    'added_by'         => $user->id,
                    'is_private'       => false,
                ]);
                $this->filesLinked++;
            }
        }
    }

    private function previewUser(User $user): void
    {
        $this->previewFolderLevel($user, null, 0);

        $files = File::where('owner_id', $user->id)->whereNotNull('folder_id')->count();
        $this->line("  [DRY] Файлов для привязки: {$files}");
        $this->foldersCreated += Folder::where('user_id', $user->id)->count();
        $this->filesLinked    += $files;
    }

    private function previewFolderLevel(User $user, ?string $localParentId, int $depth): void
    {
        $children = Folder::where('user_id', $user->id)
            ->where('parent_id', $localParentId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $indent = str_repeat('  ', $depth + 1);
        foreach ($children as $folder) {
            $filesCount = File::where('owner_id', $user->id)->where('folder_id', $folder->id)->count();
            $this->line("{$indent}[DRY] SharedFolder «{$folder->name}» ({$filesCount} файлов)");
            $this->previewFolderLevel($user, $folder->id, $depth + 1);
        }
    }
}
