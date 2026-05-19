<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pending_received_files', function (Blueprint $table) {
            $table->boolean('can_edit')->default(false)->after('sender_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('pending_received_files', function (Blueprint $table) {
            $table->dropColumn('can_edit');
        });
    }
};
