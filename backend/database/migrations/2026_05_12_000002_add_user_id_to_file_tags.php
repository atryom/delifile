<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('file_tags', 'user_id')) {
            Schema::table('file_tags', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->after('tag_id')->constrained('users')->cascadeOnDelete();
            });
        }

        // Populate existing records with the file owner's user_id
        DB::statement('UPDATE file_tags ft JOIN files f ON ft.file_id = f.id SET ft.user_id = f.owner_id WHERE ft.user_id IS NULL');

        // Drop FKs, drop old PK, create new composite PK, restore FKs
        Schema::table('file_tags', function (Blueprint $table) {
            $table->dropForeign(['file_id']);
            $table->dropForeign(['tag_id']);
            $table->dropPrimary(['file_id', 'tag_id']);
            $table->primary(['user_id', 'file_id', 'tag_id']);
            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
            $table->foreign('tag_id')->references('id')->on('tags')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('file_tags', function (Blueprint $table) {
            $table->dropForeign(['file_id']);
            $table->dropForeign(['tag_id']);
            $table->dropForeign(['user_id']);
            $table->dropPrimary(['user_id', 'file_id', 'tag_id']);
            $table->primary(['file_id', 'tag_id']);
            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
            $table->foreign('tag_id')->references('id')->on('tags')->cascadeOnDelete();
            $table->dropColumn('user_id');
        });
    }
};
