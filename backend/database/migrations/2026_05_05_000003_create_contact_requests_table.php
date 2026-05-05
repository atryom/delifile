<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('target_user_id')->constrained('users')->cascadeOnDelete();
            // contact record on the requester's side (may be null until accepted)
            $table->ulid('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->timestamps();

            $table->index(['target_user_id', 'status']);
            $table->unique(['requester_id', 'target_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_requests');
    }
};
