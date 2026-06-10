<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->timestamp('sla_deadline_review')->nullable()->after('priority');
            $table->timestamp('sla_deadline_resolution')->nullable()->after('sla_deadline_review');
            $table->boolean('sla_breach_review')->default(false)->after('sla_deadline_resolution');
            $table->boolean('sla_breach_resolution')->default(false)->after('sla_breach_review');
            $table->index('sla_deadline_review');
            $table->index('sla_deadline_resolution');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['sla_deadline_review', 'sla_deadline_resolution', 'sla_breach_review', 'sla_breach_resolution']);
        });
    }
};
