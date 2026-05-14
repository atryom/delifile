<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('file_user_access', function (Blueprint $table) {
            $table->boolean('can_comment')->default(true)->after('folder_id');
        });
    }

    public function down(): void
    {
        Schema::table('file_user_access', function (Blueprint $table) {
            $table->dropColumn('can_comment');
        });
    }
};
