<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // 'two_factor_enabled' — 2FA via LockPass push/totp (blocks login until confirmed)
            // 'alternative'        — LockPass tab on login page (no password required)
            // null                 — LockPass not used for authentication
            $table->string('lockpass_auth_mode')->nullable()->after('two_factor_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('lockpass_auth_mode');
        });
    }
};
