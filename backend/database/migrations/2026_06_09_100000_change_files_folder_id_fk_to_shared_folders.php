<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop old FK to folders if it exists
        $fks = DB::select("SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'files'
            AND COLUMN_NAME = 'folder_id' AND REFERENCED_TABLE_NAME = 'folders'");
        if (!empty($fks)) {
            Schema::table('files', fn (Blueprint $t) => $t->dropForeign(['folder_id']));
        }

        // Clear stale values that don't exist in shared_folders
        DB::statement('UPDATE files SET folder_id = NULL WHERE folder_id IS NOT NULL AND folder_id NOT IN (SELECT id FROM shared_folders)');

        // Add new FK to shared_folders
        Schema::table('files', function (Blueprint $table) {
            $table->foreign('folder_id')
                  ->references('id')->on('shared_folders')
                  ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropForeign(['folder_id']);
            $table->foreign('folder_id')
                  ->references('id')->on('folders')
                  ->onDelete('set null');
        });
    }
};
