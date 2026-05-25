<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('notify_folder_shared')->default(true)->after('notify_new_files');
            $table->boolean('notify_comments')->default(true)->after('notify_folder_shared');
            $table->boolean('notify_mentions')->default(true)->after('notify_comments');
            $table->boolean('notify_support_reply')->default(true)->after('notify_mentions');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['notify_folder_shared', 'notify_comments', 'notify_mentions', 'notify_support_reply']);
        });
    }
};
