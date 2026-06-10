<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->renameColumn('sla_deadline_review', 'deadline_review');
            $table->renameColumn('sla_deadline_resolution', 'deadline_resolusi');
            $table->renameColumn('sla_breach_review', 'terlambat_review');
            $table->renameColumn('sla_breach_resolution', 'terlambat_resolusi');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->renameColumn('deadline_review', 'sla_deadline_review');
            $table->renameColumn('deadline_resolusi', 'sla_deadline_resolution');
            $table->renameColumn('terlambat_review', 'sla_breach_review');
            $table->renameColumn('terlambat_resolusi', 'sla_breach_resolution');
        });
    }
};
