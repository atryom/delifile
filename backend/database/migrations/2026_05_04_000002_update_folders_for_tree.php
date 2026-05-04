<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            $table->ulid('parent_id')->nullable()->after('user_id');
            $table->unsignedInteger('sort_order')->nullable()->after('name');

            $table->foreign('parent_id')->references('id')->on('folders')->nullOnDelete();
            $table->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropIndex(['parent_id']);
            $table->dropColumn(['parent_id', 'sort_order']);
        });
    }
};