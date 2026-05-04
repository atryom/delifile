<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->after('id');
            $table->timestamp('email_verified_at')->nullable()->after('email');
            $table->string('email_verification_token', 64)->nullable()->after('email_verified_at');
            $table->timestamp('email_verification_sent_at')->nullable()->after('email_verification_token');
            $table->timestamp('email_verification_deadline_at')->nullable()->after('email_verification_sent_at');
            $table->string('account_status', 40)->default('active')->after('email_verification_deadline_at');

            // Make phone nullable
            $table->string('phone', 20)->nullable()->change();
        });

        // Add unique index on email (only for non-null values)
        Schema::table('users', function (Blueprint $table) {
            $table->unique('email');
        });

        // Update password_reset_tokens to be email-based
        Schema::dropIfExists('password_reset_tokens');
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn([
                'email',
                'email_verified_at',
                'email_verification_token',
                'email_verification_sent_at',
                'email_verification_deadline_at',
                'account_status',
            ]);
            $table->string('phone', 20)->nullable(false)->change();
        });

        Schema::dropIfExists('password_reset_tokens');
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('phone', 20)->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }
};
