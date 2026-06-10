<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('local_folder_comment_settings');
    }

    public function down(): void
    {
        Schema::create('local_folder_comment_settings', function (Blueprint $table) {
            $table->string('local_folder_id', 26)->primary();
            $table->string('comment_policy')->default('disabled');
            $table->boolean('comments_enabled')->default(false);
            $table->string('updated_by')->nullable();
            $table->timestamps();
            $table->foreign('local_folder_id')->references('id')->on('folders')->onDelete('cascade');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
        });
    }
};
