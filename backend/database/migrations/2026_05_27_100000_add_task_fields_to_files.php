<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->boolean('is_task')->default(false)->after('is_editable');
            $table->string('task_status', 30)->nullable()->after('is_task');
            $table->foreignId('task_assigned_user_id')->nullable()->after('task_status')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('task_start_date')->nullable()->after('task_assigned_user_id');
            $table->timestamp('task_due_date')->nullable()->after('task_start_date');
            $table->index(['owner_id', 'is_task'], 'files_owner_is_task_index');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropForeign(['task_assigned_user_id']);
            $table->dropIndex('files_owner_is_task_index');
            $table->dropColumn(['is_task', 'task_status', 'task_assigned_user_id', 'task_start_date', 'task_due_date']);
        });
    }
};
