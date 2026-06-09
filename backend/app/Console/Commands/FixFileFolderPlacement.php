<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixFileFolderPlacement extends Command
{
    protected $signature = 'files:fix-folder-placement
                            {--dry-run : Show what would be changed without making changes}
                            {--user=   : Process only the specified user ID}';

    protected $description = 'Fix files that appear in root AND in folders simultaneously. '
        . 'Sets folder_id to the matching shared folder for files that have exactly one '
        . 'non-root folder association via shared_folder_files and are owned by that folder\'s owner.';

    public function handle(): int
    {
        $isDryRun   = (bool) $this->option('dry-run');
        $targetUser = $this->option('user');

        if ($isDryRun) {
            $this->warn('=== DRY RUN — никаких изменений не будет ===');
        }

        // Find files where:
        //   - folder_id IS NULL (visible in root)
        //   - deleted_at IS NULL (not deleted)
        //   - linked via shared_folder_files to exactly one non-root shared folder
        //   - that shared folder is owned by the same user who owns the file
        $query = DB::table('files as f')
            ->join('shared_folder_files as sff', 'sff.file_id', '=', 'f.id')
            ->join('shared_folders as sf', function ($join) {
                $join->on('sf.id', '=', 'sff.shared_folder_id')
                     ->where('sf.is_personal_root', false);
            })
            ->whereRaw('sf.owner_id = f.owner_id')
            ->whereNull('f.folder_id')
            ->whereNull('f.deleted_at')
            ->select(
                'f.id as file_id',
                'f.original_name',
                'f.owner_id',
                DB::raw('COUNT(DISTINCT sff.shared_folder_id) as folder_count'),
                DB::raw('MAX(sff.shared_folder_id) as target_folder_id'),
                DB::raw('MAX(sf.name) as folder_name')
            )
            ->groupBy('f.id', 'f.original_name', 'f.owner_id')
            ->having('folder_count', '=', 1);

        if ($targetUser) {
            $query->where('f.owner_id', $targetUser);
        }

        $candidates = $query->get();

        if ($candidates->isEmpty()) {
            $this->info('Файлов для исправления не найдено.');
            return 0;
        }

        $this->info("Найдено файлов для исправления: {$candidates->count()}");

        if ($this->output->isVerbose()) {
            $this->table(
                ['file_id', 'original_name', 'target_folder'],
                $candidates->map(fn ($r) => [$r->file_id, $r->original_name, $r->folder_name])->toArray()
            );
        }

        if ($isDryRun) {
            $this->warn('Dry run завершён — изменений не внесено.');
            return 0;
        }

        $updated = 0;
        foreach ($candidates as $row) {
            DB::table('files')
                ->where('id', $row->file_id)
                ->whereNull('folder_id')
                ->update(['folder_id' => $row->target_folder_id]);
            $updated++;
        }

        $this->info("Обновлено файлов: {$updated}");

        // Report files that were skipped (multiple folders — ambiguous placement)
        $ambiguous = DB::table('files as f')
            ->join('shared_folder_files as sff', 'sff.file_id', '=', 'f.id')
            ->join('shared_folders as sf', function ($join) {
                $join->on('sf.id', '=', 'sff.shared_folder_id')
                     ->where('sf.is_personal_root', false);
            })
            ->whereRaw('sf.owner_id = f.owner_id')
            ->whereNull('f.folder_id')
            ->whereNull('f.deleted_at')
            ->select('f.id')
            ->groupBy('f.id')
            ->having(DB::raw('COUNT(DISTINCT sff.shared_folder_id)'), '>', 1)
            ->when($targetUser, fn ($q) => $q->where('f.owner_id', $targetUser))
            ->count();

        if ($ambiguous > 0) {
            $this->warn("Пропущено (файл в нескольких папках, неоднозначно): {$ambiguous}");
        }

        return 0;
    }
}
