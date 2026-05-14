<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->boolean('has_versions')->default(false)->after('shared_folder_only');
            $table->string('display_name', 255)->nullable()->after('has_versions');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropColumn(['has_versions', 'display_name']);
        });
    }
};
