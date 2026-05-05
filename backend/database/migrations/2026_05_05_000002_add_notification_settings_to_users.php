<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('notifications_enabled')->default(true)->after('plan');
            $table->boolean('notify_new_files')->default(true)->after('notifications_enabled');
            $table->boolean('notify_contacts_added')->default(true)->after('notify_new_files');
            $table->boolean('allow_contacts_without_confirmation')->default(true)->after('notify_contacts_added');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'notifications_enabled',
                'notify_new_files',
                'notify_contacts_added',
                'allow_contacts_without_confirmation',
            ]);
        });
    }
};
