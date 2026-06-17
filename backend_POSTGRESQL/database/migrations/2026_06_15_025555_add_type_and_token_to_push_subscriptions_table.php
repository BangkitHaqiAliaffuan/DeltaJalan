<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('push_subscriptions', function (Blueprint $table) {
            $table->string('type', 20)->default('webpush')->after('user_id');
            $table->text('fcm_token')->nullable()->unique()->after('auth_key');
            $table->text('device_info')->nullable()->after('user_agent');
        });
    }

    public function down(): void
    {
        Schema::table('push_subscriptions', function (Blueprint $table) {
            $table->dropColumn(['type', 'fcm_token', 'device_info']);
        });
    }
};
