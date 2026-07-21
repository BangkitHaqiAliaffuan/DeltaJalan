<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->decimal('pci_score', 5, 2)->nullable()->after('ai_analysis_count');
            $table->timestamp('pci_calculated_at')->nullable()->after('pci_score');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['pci_score', 'pci_calculated_at']);
        });
    }
};
