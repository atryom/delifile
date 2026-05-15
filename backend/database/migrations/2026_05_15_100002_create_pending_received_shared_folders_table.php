<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_received_shared_folders', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('shared_folder_id')->constrained('shared_folders')->cascadeOnDelete();
            $table->unsignedBigInteger('recipient_user_id');
            $table->unsignedBigInteger('inviter_user_id');
            $table->string('access_type')->default('view');
            $table->timestamps();

            $table->foreign('recipient_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('inviter_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['shared_folder_id', 'recipient_user_id'], 'prsf_folder_recipient_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_received_shared_folders');
    }
};
