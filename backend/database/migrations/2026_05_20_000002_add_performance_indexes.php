<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shared_folder_accesses', function (Blueprint $table) {
            $table->index('user_id', 'idx_sfa_user_id');
        });

        Schema::table('shared_folders', function (Blueprint $table) {
            $table->index('parent_id', 'idx_sf_parent_id');
        });

        Schema::table('pending_received_files', function (Blueprint $table) {
            $table->index('recipient_user_id', 'idx_prf_recipient_user_id');
        });

        Schema::table('pending_received_shared_folders', function (Blueprint $table) {
            $table->index('recipient_user_id', 'idx_prsf_recipient_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('shared_folder_accesses', function (Blueprint $table) {
            $table->dropIndex('idx_sfa_user_id');
        });

        Schema::table('shared_folders', function (Blueprint $table) {
            $table->dropIndex('idx_sf_parent_id');
        });

        Schema::table('pending_received_files', function (Blueprint $table) {
            $table->dropIndex('idx_prf_recipient_user_id');
        });

        Schema::table('pending_received_shared_folders', function (Blueprint $table) {
            $table->dropIndex('idx_prsf_recipient_user_id');
        });
    }
};
