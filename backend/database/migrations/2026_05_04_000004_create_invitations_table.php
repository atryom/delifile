<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('target_email', 255);
            $table->ulid('file_id')->nullable();
            $table->string('token', 64)->unique();
            $table->string('status', 20)->default('pending'); // pending|accepted|expired|cancelled
            $table->foreignId('accepted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('comment', 1000)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index('token');
            $table->index('target_email');
            $table->index('status');
            $table->index('sender_user_id');

            $table->foreign('file_id')->references('id')->on('files')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};