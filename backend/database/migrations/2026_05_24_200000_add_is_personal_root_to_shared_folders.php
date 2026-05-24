<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shared_folders', function (Blueprint $table) {
            $table->boolean('is_personal_root')->default(false)->after('is_private');
        });
    }

    public function down(): void
    {
        Schema::table('shared_folders', function (Blueprint $table) {
            $table->dropColumn('is_personal_root');
        });
    }
};
