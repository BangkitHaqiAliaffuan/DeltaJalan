<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Petugas yang benar-benar mengerjakan tugas inspeksi.
 *
 * ── Masalah yang diperbaiki ───────────────────────────────────────────────
 * Supervisor perlu melihat SIAPA yang sedang mengukur sebuah laporan.
 * Sebelumnya nama itu hanya bisa ditebak dari `inspection_sessions.started_by`,
 * padahal kolom tersebut diisi SUPERVISOR yang membuat sesi patroli — bukan
 * petugas yang mengukur. Akibatnya label "Sedang Diinspeksi" bisa menampilkan
 * nama orang yang salah.
 *
 * `inspection_results.inspector_id` memang menyimpan petugas yang mengirim
 * hasil, tetapi baru terisi SETELAH submit. Untuk tahap `assigned` dan
 * `started` belum ada data apa pun, sehingga nama petugas tidak bisa
 * ditampilkan sama sekali.
 *
 * ── Kenapa di tabel ini ───────────────────────────────────────────────────
 * Satu sesi patroli bisa berisi banyak assignment dari tim yang sama, dan
 * tiap assignment bisa dikerjakan petugas berbeda. Pemetaan petugas ada di
 * tingkat assignment, bukan sesi.
 *
 * ── Nullable ──────────────────────────────────────────────────────────────
 * Assignment hasil auto-queue belum punya petugas sampai seseorang menekan
 * "Mulai". Baris lama juga tidak punya data ini, jadi tidak boleh NOT NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('survey_task_reports', function (Blueprint $table) {
            // `users.id` bertipe bigint (bukan UUID), sama seperti
            // `inspection_results.inspector_id`. Memakai foreignUuid di sini
            // akan menggagalkan migrasi karena tipe kolom tidak cocok.
            $table->unsignedBigInteger('inspector_id')->nullable()->after('status');
            $table->foreign('inspector_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('survey_task_reports', function (Blueprint $table) {
            $table->dropForeign(['inspector_id']);
            $table->dropColumn('inspector_id');
        });
    }
};
