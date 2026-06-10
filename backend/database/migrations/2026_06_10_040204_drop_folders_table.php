<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('folders');
    }

    public function down(): void
    {
        Schema::create('folders', function (Blueprint $table) {
            $table->string('id', 26)->primary();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('parent_id', 26)->nullable();
            $table->integer('sort_order')->nullable();
            $table->string('folder_type')->default('default');
            $table->timestamps();
            $table->foreign('parent_id')->references('id')->on('folders')->onDelete('cascade');
        });
    }
};
