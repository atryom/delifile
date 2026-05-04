<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_pending_shares', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('contact_id');
            $table->ulid('file_id');
            $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            // Cascade: when contact is deleted, pending shares are removed automatically
            $table->foreign('contact_id')->references('id')->on('contacts')->cascadeOnDelete();
            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();

            $table->unique(['contact_id', 'file_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_pending_shares');
    }
};
