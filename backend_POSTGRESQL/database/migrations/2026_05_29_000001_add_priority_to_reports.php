<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP TYPE IF EXISTS priority_enum CASCADE');
        DB::statement("CREATE TYPE priority_enum AS ENUM ('Rendah', 'Sedang', 'Tinggi')");

        DB::statement("
            ALTER TABLE reports
            ADD COLUMN priority priority_enum NOT NULL DEFAULT 'Sedang'
        ");
    }

    public function down(): void
    {
        Schema::table('reports', function ($table) {
            $table->dropColumn('priority');
        });

        DB::statement('DROP TYPE IF EXISTS priority_enum');
    }
};
