<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_likes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('file_id', 26);
            $table->unsignedBigInteger('user_id');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('file_id')->references('id')->on('files')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['file_id', 'user_id']);
            $table->index('file_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_likes');
    }
};
