<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shared_folders', function (Blueprint $table) {
            $table->boolean('is_private')->default(false)->after('parent_id');
            $table->unsignedInteger('sort_order')->nullable()->after('name');
        });

        Schema::table('shared_folder_files', function (Blueprint $table) {
            $table->boolean('is_private')->default(false)->after('added_by');
        });
    }

    public function down(): void
    {
        Schema::table('shared_folder_files', function (Blueprint $table) {
            $table->dropColumn('is_private');
        });

        Schema::table('shared_folders', function (Blueprint $table) {
            $table->dropColumn(['is_private', 'sort_order']);
        });
    }
};
