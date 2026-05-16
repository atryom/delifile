<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->boolean('is_editable')->default(false)->after('has_versions');
            $table->string('editor_type', 50)->nullable()->after('is_editable');
            $table->string('etag', 255)->nullable()->after('editor_type');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete()->after('etag');
            $table->unsignedInteger('width')->nullable()->after('updated_by');
            $table->unsignedInteger('height')->nullable()->after('width');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropForeign(['updated_by']);
            $table->dropColumn(['is_editable', 'editor_type', 'etag', 'updated_by', 'width', 'height']);
        });
    }
};
