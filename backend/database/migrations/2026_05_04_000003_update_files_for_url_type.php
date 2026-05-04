<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->string('content_kind', 20)->default('binary_file')->after('checksum');
            $table->string('link_url', 2048)->nullable()->after('content_kind');
            $table->string('link_title', 500)->nullable()->after('link_url');
            $table->text('link_description')->nullable()->after('link_title');
            $table->string('link_image_url', 2048)->nullable()->after('link_description');
            $table->string('link_site_name', 255)->nullable()->after('link_image_url');
            $table->timestamp('link_fetched_at')->nullable()->after('link_site_name');

            // Allow storage_key to be nullable for url_file objects
            $table->string('storage_key', 500)->nullable()->change();
            // Allow size to be 0 for url_file
            $table->unsignedBigInteger('size')->default(0)->change();
            // Allow mime_type to be nullable
            $table->string('mime_type', 100)->nullable()->change();

            $table->index('content_kind');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropIndex(['content_kind']);
            $table->dropColumn([
                'content_kind',
                'link_url',
                'link_title',
                'link_description',
                'link_image_url',
                'link_site_name',
                'link_fetched_at',
            ]);
            $table->string('storage_key', 500)->nullable(false)->change();
            $table->unsignedBigInteger('size')->default(null)->change();
            $table->string('mime_type', 100)->nullable(false)->change();
        });
    }
};