<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('file_user_access', function (Blueprint $table) {
            $table->ulid('folder_id')->nullable()->after('saved_at');
            $table->foreign('folder_id')->references('id')->on('folders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('file_user_access', function (Blueprint $table) {
            $table->dropForeign(['folder_id']);
            $table->dropColumn('folder_id');
        });
    }
};
