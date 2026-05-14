<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // comment_threads
        Schema::create('comment_threads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('target_type', 20);      // file | shared_folder | local_folder
            $table->string('target_id', 26);        // ULID of target entity
            $table->string('scope', 10);            // shared | private
            $table->unsignedBigInteger('owner_user_id')->nullable(); // для private-треда
            $table->string('context_shared_folder_id', 26)->nullable();
            $table->unsignedBigInteger('created_by');
            $table->string('last_comment_id', 26)->nullable();
            $table->unsignedInteger('comments_count')->default(0);
            $table->string('status', 10)->default('active'); // active | archived
            $table->timestamps();

            $table->foreign('owner_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();

            // Один shared-тред на (target_type, target_id)
            $table->unique(['target_type', 'target_id', 'scope', 'owner_user_id'], 'uq_thread_target_scope_owner');
            $table->index(['target_type', 'target_id']);
        });

        // comments
        Schema::create('comments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('thread_id', 26);
            $table->string('parent_comment_id', 26)->nullable();
            $table->unsignedBigInteger('author_user_id');
            $table->text('body');
            $table->text('body_plain');
            $table->json('mentions_json')->nullable();
            $table->unsignedInteger('replies_count')->default(0);
            $table->timestamp('edited_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->foreign('thread_id')->references('id')->on('comment_threads')->cascadeOnDelete();
            $table->foreign('author_user_id')->references('id')->on('users')->cascadeOnDelete();

            $table->index('thread_id');
            $table->index('author_user_id');
        });

        // comment_reads
        Schema::create('comment_reads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('thread_id', 26);
            $table->unsignedBigInteger('user_id');
            $table->string('last_read_comment_id', 26)->nullable();
            $table->timestamp('last_read_at')->useCurrent();
            $table->unsignedInteger('unread_count_cache')->default(0);

            $table->foreign('thread_id')->references('id')->on('comment_threads')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();

            $table->unique(['thread_id', 'user_id']);
        });

        // comment_mentions
        Schema::create('comment_mentions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('comment_id', 26);
            $table->unsignedBigInteger('mentioned_user_id');
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('comment_id')->references('id')->on('comments')->cascadeOnDelete();
            $table->foreign('mentioned_user_id')->references('id')->on('users')->cascadeOnDelete();

            $table->index('comment_id');
            $table->index('mentioned_user_id');
        });

        // comment_audit_log
        Schema::create('comment_audit_log', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('comment_id', 26)->nullable();
            $table->unsignedBigInteger('actor_user_id');
            $table->string('action', 20); // create | edit | delete | restore | settings_change
            $table->json('old_value_json')->nullable();
            $table->json('new_value_json')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('actor_user_id')->references('id')->on('users')->cascadeOnDelete();

            $table->index('actor_user_id');
        });

        // file_comment_settings (1:1 с files)
        Schema::create('file_comment_settings', function (Blueprint $table) {
            $table->string('file_id', 26)->primary();
            $table->boolean('shared_comments_enabled')->default(true);
            $table->string('shared_comments_override', 10)->default('inherit'); // inherit | enabled | disabled
            $table->boolean('private_comments_enabled')->default(true);
            $table->boolean('mentions_enabled')->default(true);
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
        });

        // shared_folder_comment_settings (1:1 с shared_folders)
        Schema::create('shared_folder_comment_settings', function (Blueprint $table) {
            $table->string('shared_folder_id', 26)->primary();
            $table->string('shared_comments_mode', 20)->default('enabled'); // enabled | disabled | inherit_for_items
            $table->boolean('private_comments_enabled')->default(true);
            $table->boolean('mentions_enabled')->default(true);
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('shared_folder_id')->references('id')->on('shared_folders')->cascadeOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
        });

        // local_folder_comment_settings (1:1 с folders)
        Schema::create('local_folder_comment_settings', function (Blueprint $table) {
            $table->string('local_folder_id', 26)->primary();
            $table->boolean('private_comments_enabled')->default(true);
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('local_folder_id')->references('id')->on('folders')->cascadeOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('local_folder_comment_settings');
        Schema::dropIfExists('shared_folder_comment_settings');
        Schema::dropIfExists('file_comment_settings');
        Schema::dropIfExists('comment_audit_log');
        Schema::dropIfExists('comment_mentions');
        Schema::dropIfExists('comment_reads');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('comment_threads');
    }
};
