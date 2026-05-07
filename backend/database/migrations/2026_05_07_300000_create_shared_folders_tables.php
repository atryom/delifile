<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // shared_folders
        Schema::create('shared_folders', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->unsignedBigInteger('owner_id');
            $table->string('name', 100);
            $table->timestamps();

            $table->foreign('owner_id')->references('id')->on('users')->cascadeOnDelete();
        });

        // shared_folder_accesses
        Schema::create('shared_folder_accesses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('shared_folder_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->ulid('contact_id')->nullable();
            $table->string('access_type', 10); // view | edit
            $table->timestamps();

            $table->foreign('shared_folder_id')->references('id')->on('shared_folders')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();

            $table->index('shared_folder_id');
        });

        // shared_folder_links
        Schema::create('shared_folder_links', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('shared_folder_id');
            $table->unsignedBigInteger('created_by');
            $table->string('token', 64)->unique();
            $table->string('access_type', 10);
            $table->boolean('allow_save')->default(false);
            $table->string('status', 20)->default('active');
            $table->integer('ttl_hours')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->foreign('shared_folder_id')->references('id')->on('shared_folders')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();

            $table->index('token');
        });

        // shared_folder_files
        Schema::create('shared_folder_files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('shared_folder_id');
            $table->ulid('file_id');
            $table->unsignedBigInteger('added_by');
            $table->timestamps();

            $table->foreign('shared_folder_id')->references('id')->on('shared_folders')->cascadeOnDelete();
            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
            $table->foreign('added_by')->references('id')->on('users')->cascadeOnDelete();

            $table->unique(['shared_folder_id', 'file_id']);
            $table->index('file_id');
        });

        // Add shared_folder_only to files
        Schema::table('files', function (Blueprint $table) {
            $table->boolean('shared_folder_only')->default(false)->after('folder_id');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropColumn('shared_folder_only');
        });

        Schema::dropIfExists('shared_folder_files');
        Schema::dropIfExists('shared_folder_links');
        Schema::dropIfExists('shared_folder_accesses');
        Schema::dropIfExists('shared_folders');
    }
};
