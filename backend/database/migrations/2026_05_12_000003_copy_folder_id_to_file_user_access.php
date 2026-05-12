<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Copy files.folder_id → file_user_access.folder_id for file owners
        DB::statement('
            UPDATE file_user_access fua
            JOIN files f ON fua.file_id = f.id AND fua.user_id = f.owner_id
            SET fua.folder_id = f.folder_id
            WHERE f.folder_id IS NOT NULL
              AND fua.folder_id IS NULL
        ');
    }

    public function down(): void
    {
        // Cannot reliably reverse — leave as is
    }
};
