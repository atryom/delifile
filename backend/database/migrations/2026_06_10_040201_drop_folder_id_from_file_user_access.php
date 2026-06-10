<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('file_user_access', function (Blueprint $table) {
            $table->dropForeign('file_user_access_folder_id_foreign');
            $table->dropColumn('folder_id');
        });
    }

    public function down(): void
    {
        Schema::table('file_user_access', function (Blueprint $table) {
            $table->string('folder_id', 26)->nullable()->after('file_id');
            $table->foreign('folder_id')->references('id')->on('folders')->onDelete('set null');
        });
    }
};
