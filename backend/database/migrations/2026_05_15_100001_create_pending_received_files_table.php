<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_received_files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('file_id')->constrained('files')->cascadeOnDelete();
            $table->unsignedBigInteger('recipient_user_id');
            $table->unsignedBigInteger('sender_user_id');
            $table->timestamps();

            $table->foreign('recipient_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('sender_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['file_id', 'recipient_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_received_files');
    }
};
