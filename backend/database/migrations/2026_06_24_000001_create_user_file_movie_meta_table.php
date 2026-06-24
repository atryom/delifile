<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_file_movie_meta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('file_id', 26);
            $table->boolean('watched')->default(false);
            $table->decimal('personal_rating', 4, 1)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'file_id']);
            $table->index('file_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_file_movie_meta');
    }
};
