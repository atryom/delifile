<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shared_folders', function (Blueprint $table) {
            $table->index('owner_id');
        });

        Schema::table('support_attachments', function (Blueprint $table) {
            $table->index('message_id');
        });

        Schema::table('suggestion_attachments', function (Blueprint $table) {
            $table->index('suggestion_id');
        });

        Schema::table('comment_audit_log', function (Blueprint $table) {
            $table->index('comment_id');
        });

        Schema::table('pending_received_files', function (Blueprint $table) {
            $table->index('file_id');
        });
    }

    public function down(): void
    {
        Schema::table('shared_folders', function (Blueprint $table) {
            $table->dropIndex(['owner_id']);
        });

        Schema::table('support_attachments', function (Blueprint $table) {
            $table->dropIndex(['message_id']);
        });

        Schema::table('suggestion_attachments', function (Blueprint $table) {
            $table->dropIndex(['suggestion_id']);
        });

        Schema::table('comment_audit_log', function (Blueprint $table) {
            $table->dropIndex(['comment_id']);
        });

        Schema::table('pending_received_files', function (Blueprint $table) {
            $table->dropIndex(['file_id']);
        });
    }
};
