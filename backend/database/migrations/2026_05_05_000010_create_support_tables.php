<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Support tickets
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->unsignedBigInteger('user_id');
            $table->string('status', 30)->default('new'); // new|in_progress|awaiting_confirmation|completed
            $table->string('completion_reason', 30)->nullable(); // user_confirmed|auto_closed
            $table->timestamp('taken_at')->nullable();            // audit: when taken in work
            $table->timestamp('awaiting_at')->nullable();         // audit: when moved to awaiting_confirmation
            $table->timestamp('confirmed_at')->nullable();        // audit: when user confirmed
            $table->timestamp('auto_closed_at')->nullable();      // audit: when auto-closed
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'status']);
            $table->index('status');
        });

        // Support messages
        Schema::create('support_messages', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('ticket_id');
            $table->unsignedBigInteger('sender_id');
            $table->boolean('is_admin_message')->default(false);
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->foreign('ticket_id')->references('id')->on('support_tickets')->cascadeOnDelete();
            $table->foreign('sender_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['ticket_id', 'is_admin_message', 'read_at']);
        });

        // Support message attachments
        Schema::create('support_attachments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('message_id');
            $table->string('original_name');
            $table->string('storage_key');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size');
            $table->timestamps();

            $table->foreign('message_id')->references('id')->on('support_messages')->cascadeOnDelete();
        });

        // Suggestion tickets
        Schema::create('suggestion_tickets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->unsignedBigInteger('user_id');
            $table->text('body');
            $table->string('status', 20)->default('new'); // new|accepted
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'status']);
        });

        // Suggestion attachments
        Schema::create('suggestion_attachments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('suggestion_id');
            $table->string('original_name');
            $table->string('storage_key');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size');
            $table->timestamps();

            $table->foreign('suggestion_id')->references('id')->on('suggestion_tickets')->cascadeOnDelete();
        });

        // Admin internal comments on suggestions (not visible to users)
        Schema::create('suggestion_admin_comments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('suggestion_id');
            $table->text('body');
            $table->timestamps();

            $table->foreign('suggestion_id')->references('id')->on('suggestion_tickets')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suggestion_admin_comments');
        Schema::dropIfExists('suggestion_attachments');
        Schema::dropIfExists('suggestion_tickets');
        Schema::dropIfExists('support_attachments');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
    }
};
