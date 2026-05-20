<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shared_folder_accesses', function (Blueprint $table) {
            $table->unique(['shared_folder_id', 'user_id'], 'idx_sfa_folder_user');
        });
    }

    public function down(): void
    {
        Schema::table('shared_folder_accesses', function (Blueprint $table) {
            $table->dropUnique('idx_sfa_folder_user');
        });
    }
};
