<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('push_subscriptions', function () {
            DB::statement('ALTER TABLE push_subscriptions ALTER COLUMN endpoint DROP NOT NULL');
            DB::statement('ALTER TABLE push_subscriptions ALTER COLUMN p256dh_key DROP NOT NULL');
            DB::statement('ALTER TABLE push_subscriptions ALTER COLUMN auth_key DROP NOT NULL');
        });
    }

    public function down(): void
    {
        Schema::table('push_subscriptions', function () {
            DB::statement('ALTER TABLE push_subscriptions ALTER COLUMN endpoint SET NOT NULL');
            DB::statement('ALTER TABLE push_subscriptions ALTER COLUMN p256dh_key SET NOT NULL');
            DB::statement('ALTER TABLE push_subscriptions ALTER COLUMN auth_key SET NOT NULL');
        });
    }
};
