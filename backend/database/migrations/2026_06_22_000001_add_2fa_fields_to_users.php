<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('lockpass_user_id')->nullable()->unique()->after('is_superuser');
            $table->boolean('two_factor_enabled')->default(false)->after('lockpass_user_id');
            $table->unsignedInteger('devices_count')->default(0)->after('two_factor_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['lockpass_user_id', 'two_factor_enabled', 'devices_count']);
        });
    }
};
