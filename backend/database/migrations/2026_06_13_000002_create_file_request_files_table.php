<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_request_files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('file_request_id', 26);
            $table->string('file_id', 26)->nullable();
            $table->string('sender_name', 255)->nullable();
            $table->string('sender_email', 255)->nullable();
            $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->timestamps();

            $table->foreign('file_request_id')->references('id')->on('file_requests')->cascadeOnDelete();
            $table->foreign('file_id')->references('id')->on('files')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_request_files');
    }
};
