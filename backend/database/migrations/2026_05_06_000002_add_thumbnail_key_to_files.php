<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->string('thumbnail_key')->nullable()->after('storage_key');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropColumn('thumbnail_key');
        });
    }
};
