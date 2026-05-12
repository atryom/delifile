<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('files')->whereNotNull('expires_at')->update(['expires_at' => null]);
    }

    public function down(): void
    {
        // Irreversible
    }
};
