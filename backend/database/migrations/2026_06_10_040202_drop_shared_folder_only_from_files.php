<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropColumn('shared_folder_only');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->boolean('shared_folder_only')->default(false)->after('folder_id');
        });
    }
};
