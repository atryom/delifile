<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('file_requests', function (Blueprint $table) {
            $table->string('folder_id', 26)->nullable()->after('file_id');
            $table->foreign('folder_id')->references('id')->on('shared_folders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('file_requests', function (Blueprint $table) {
            $table->dropForeign(['folder_id']);
            $table->dropColumn('folder_id');
        });
    }
};
