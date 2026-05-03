<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FileSpace MVP — Complete initial migration
 * Creates all domain tables:
 *   users, device_sessions, files, file_user_access,
 *   share_links, contacts, folders, tags, file_tags, activity_logs
 */
return new class extends Migration
{
    public function up(): void
    {
        // ─── Users ─────────────────────────────────────────────────────────
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 20)->unique();
            $table->string('name')->nullable();
            $table->string('password');
            $table->timestamp('phone_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        // ─── Password Resets (stub for SMS flow) ───────────────────────────
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('phone', 20)->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // ─── Sanctum Tokens ────────────────────────────────────────────────
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // ─── Device Sessions ───────────────────────────────────────────────
        Schema::create('device_sessions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('token_id')->nullable(); // personal_access_tokens.id
            $table->string('device_name')->default('Web Browser');
            $table->string('user_agent', 500)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('last_active_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        // ─── Folders ───────────────────────────────────────────────────────
        Schema::create('folders', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->timestamps();

            $table->index('user_id');
        });

        // ─── Files ─────────────────────────────────────────────────────────
        Schema::create('files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('original_name', 255);
            $table->string('storage_key', 500);         // S3 object key
            $table->unsignedBigInteger('size');          // bytes
            $table->string('mime_type', 100);
            $table->string('checksum', 64)->nullable();
            $table->string('status', 20)->default('uploading');
            $table->ulid('folder_id')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index('owner_id');
            $table->index('status');
            $table->index('expires_at');

            $table->foreign('folder_id')->references('id')->on('folders')->nullOnDelete();
        });

        // ─── File User Access ──────────────────────────────────────────────
        Schema::create('file_user_access', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('file_id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->ulid('contact_id')->nullable();      // which contact record initiated share
            $table->string('access_type', 20);           // owner | shared | saved
            $table->boolean('is_favorite')->default(false);
            $table->timestamp('pinned_at')->nullable();
            $table->timestamp('saved_at')->nullable();
            $table->timestamps();

            $table->unique(['file_id', 'user_id']);
            $table->index('file_id');
            $table->index('user_id');
            $table->index('access_type');

            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
        });

        // ─── Share Links ───────────────────────────────────────────────────
        Schema::create('share_links', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('file_id');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('status', 20)->default('active');  // active | disabled | expired
            $table->unsignedSmallInteger('ttl_hours')->default(12);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index('token');
            $table->index('status');
            $table->index('expires_at');

            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
        });

        // ─── Contacts ──────────────────────────────────────────────────────
        Schema::create('contacts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('phone', 20);
            $table->foreignId('resolved_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'phone']);
            $table->index('user_id');
            $table->index('resolved_user_id');
        });

        // ─── Tags ──────────────────────────────────────────────────────────
        Schema::create('tags', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->timestamps();

            $table->unique(['user_id', 'name']);
            $table->index('user_id');
        });

        // ─── File Tags Pivot ───────────────────────────────────────────────
        Schema::create('file_tags', function (Blueprint $table) {
            $table->ulid('file_id');
            $table->ulid('tag_id');
            $table->primary(['file_id', 'tag_id']);

            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
            $table->foreign('tag_id')->references('id')->on('tags')->cascadeOnDelete();
        });

        // ─── Activity Logs ─────────────────────────────────────────────────
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('file_id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('action', 50);
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('file_id');
            $table->index('user_id');
            $table->index('action');
            $table->index('created_at');

            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('file_tags');
        Schema::dropIfExists('tags');
        Schema::dropIfExists('contacts');
        Schema::dropIfExists('share_links');
        Schema::dropIfExists('file_user_access');
        Schema::dropIfExists('files');
        Schema::dropIfExists('folders');
        Schema::dropIfExists('device_sessions');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
