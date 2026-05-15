<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shared_folders', function (Blueprint $table) {
            $table->ulid('parent_id')->nullable()->after('owner_id');
            $table->foreign('parent_id')->references('id')->on('shared_folders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('shared_folders', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn('parent_id');
        });
    }
};
