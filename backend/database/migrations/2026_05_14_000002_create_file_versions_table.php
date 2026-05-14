<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('file_versions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('file_id');
            $table->integer('version_number');
            $table->string('version_label', 50)->nullable();
            $table->text('comment')->nullable();
            $table->string('storage_key', 500);
            $table->string('thumbnail_key', 500)->nullable();
            $table->string('original_name', 255);
            $table->unsignedBigInteger('size');
            $table->string('mime_type', 100);
            $table->boolean('is_active')->default(true);
            $table->string('status', 20)->default('uploading');
            $table->timestamps();

            $table->unique(['file_id', 'version_number']);
            $table->index('file_id');
            $table->index('status');

            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_versions');
    }
};
