<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Penjaga kelas bug "Undefined array key" pada hasil validasi.
 *
 * ── Regresi yang dijaga ───────────────────────────────────────────────────
 * `ReportController::mulai()` membaca `$validated['estimasi_selesai_hari']`
 * tanpa fallback. Field itu `nullable`, dan klien Android (Moshi dengan
 * `serializeNulls = false`) **membuang** field bernilai null — jadi untuk
 * pilihan "selesai hari ini juga" key tersebut tidak ada di `$validated`
 * (`Illuminate\Validation\Validator::validated()` hanya menyalin key yang
 * benar-benar dikirim). PHP 8.3 memunculkan warning,
 * `HandleExceptions::handleError()` mengubahnya menjadi `ErrorException`,
 * dan pengguna menerima HTTP 500 — hanya untuk pilihan same-day, sementara
 * estimasi >1 hari berjalan normal.
 *
 * Aturan yang ditegakkan: akses `$hasil['kunci']` untuk field yang aturannya
 * `nullable` (tanpa `required`) WAJIB punya penjaga `??`, `isset(...)`,
 * `empty(...)`, atau `array_key_exists(...)`.
 *
 * Tes berjalan tanpa database — hanya membaca berkas di `app/`.
 */
class ValidatedKeyGuardTest extends TestCase
{
    /**
     * Pengecualian yang sudah ditelaah manual: key `nullable` tetapi aksesnya
     * dilindungi invarian alur kendali, bukan oleh `??`.
     *
     * @var array<string, string> 'berkas:kunci' => alasan
     */
    private const PENJAGA_KONTEKSTUAL = [
        'ReportController.php:photos' => 'hanya diakses di dalam cabang `$request->has(\'photos\')`, '
            .'dan rule `required_without:photos` memaksa dimensi hadir saat photos absen',
    ];

    /** @var list<string> */
    private array $pelanggaran = [];

    /** Berkas PHP di app/ (controller, service, middleware). */
    private function berkas(): array
    {
        $hasil = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(base_path('app'), \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $info) {
            if ($info->isFile() && $info->getExtension() === 'php') {
                $hasil[] = $info->getPathname();
            }
        }

        sort($hasil);

        return $hasil;
    }

    /**
     * Aturan validasi sebuah key pada blok validate TERDEKAT sebelum $posisi.
     *
     * @return string|null teks aturan, atau null bila key tidak dideklarasikan
     */
    private function aturanKey(string $teks, string $variabel, string $kunci, int $posisi): ?string
    {
        $pola = '/\$'.preg_quote($variabel, '/').'\s*=\s*\$request->validate\(\[/';
        if (! preg_match_all($pola, $teks, $cocok, PREG_OFFSET_CAPTURE)) {
            return null;
        }

        // Blok validate terdekat yang berada sebelum akses.
        $blok = null;
        foreach ($cocok[0] as [$teksCocok, $offsetCocok]) {
            $awal = $offsetCocok + strlen($teksCocok) - 1;
            if ($awal > $posisi) {
                break;
            }
            $kedalaman = 0;
            for ($i = $awal, $n = strlen($teks); $i < $n; $i++) {
                if ($teks[$i] === '[') {
                    $kedalaman++;
                } elseif ($teks[$i] === ']') {
                    $kedalaman--;
                    if ($kedalaman === 0) {
                        $blok = substr($teks, $awal, $i - $awal + 1);
                        break;
                    }
                }
            }
        }

        if ($blok === null) {
            return null;
        }

        $polaRule = "/'".preg_quote($kunci, '/')."'\s*=>\s*(\[[^\]]*\]|'[^']*'|\"[^\"]*\")/";
        if (! preg_match($polaRule, $blok, $m)) {
            return null;
        }

        return strtolower($m[1]);
    }

    private function periksaBerkas(string $path, string $teks): void
    {
        $namaBerkas = basename($path);
        $baris = explode("\n", $teks);

        foreach ($baris as $indeks => $isiBaris) {
            if (! preg_match_all('/\$(\w+)\[\s*[\'"]([a-z0-9_.]+)[\'"]\s*\]/i', $isiBaris, $akses, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
                continue;
            }

            foreach ($akses as $a) {
                $variabel = $a[1][0];
                $kunci = $a[2][0];
                if ($variabel === 'request' || $variabel === '_POST' || $variabel === 'GLOBALS') {
                    continue; // bukan hasil validasi
                }

                $offsetBaris = strlen(implode("\n", array_slice($baris, 0, $indeks)))
                    + ($indeks > 0 ? 1 : 0);
                $aturan = $this->aturanKey($teks, $variabel, $kunci, $offsetBaris + $a[0][1]);

                if ($aturan === null) {
                    continue;
                }
                if (! str_contains($aturan, 'nullable') || str_contains($aturan, 'required')) {
                    continue; // wajib hadir → aman
                }

                // Penjaga pada baris yang sama.
                $sisaBaris = substr($isiBaris, $a[0][1] + strlen($a[0][0]));
                if (str_contains($sisaBaris, '??')) {
                    continue;
                }
                $sebelum = substr($isiBaris, max(0, $a[0][1] - 24), min(24, $a[0][1]));
                if (preg_match('/(isset|empty|array_key_exists)\s*\(\s*$/', $sebelum)) {
                    continue;
                }

                // Ini penulisan (`$validated['x'] = ...`), bukan pembacaan.
                if (preg_match('/^\s*=[^=]/', $sisaBaris)) {
                    continue;
                }

                // Penjaga di baris yang sama membungkus akses: `isset($validated['x'])`.
                $aksesPenuh = '$'.$variabel."['".$kunci."']";
                if (preg_match('/(isset|empty|array_key_exists)\s*\(\s*'.preg_quote($aksesPenuh, '/').'\s*\)/', $isiBaris)) {
                    continue;
                }

                // Penjaga kontekstual: beberapa baris di atas membungkus key ini
                // dengan isset()/empty()/has() atau sudah diberi nilai default.
                $jendela = implode("\n", array_slice($baris, max(0, $indeks - 10), min(10, $indeks)));
                $polaJendela = '/(isset|empty|array_key_exists)\s*\(\s*'.preg_quote($aksesPenuh, '/')
                    .'|'.preg_quote($aksesPenuh, '/').'\s*\?\?'
                    .'|\$request->(has|filled)\(\s*[\'"]'.preg_quote($kunci, '/').'[\'"]'
                    .'|'.preg_quote($aksesPenuh, '/').'\s*=/';
                if (preg_match($polaJendela, $jendela)) {
                    continue;
                }

                if (isset(self::PENJAGA_KONTEKSTUAL[$namaBerkas.':'.$kunci])) {
                    continue;
                }

                $this->pelanggaran[] = $namaBerkas.':'.($indeks + 1)
                    .' → $'.$variabel."['".$kunci."']";
            }
        }
    }

    public function test_tidak_ada_akses_field_nullable_tanpa_penjaga(): void
    {
        $this->pelanggaran = [];

        foreach ($this->berkas() as $path) {
            $this->periksaBerkas($path, file_get_contents($path));
        }

        $pesan = "Akses \$validated[...] tanpa penjaga (??/isset/empty) untuk field nullable.\n"
            ."Klien boleh membuang field bernilai null sehingga key-nya tidak ada → HTTP 500.\n\n"
            .implode("\n", $this->pelanggaran);

        $this->assertSame([], $this->pelanggaran, $pesan);
    }

    /** Pastikan detektor benar-benar menangkap pola berbahaya. */
    public function test_penjaga_mendeteksi_pola_berbahaya(): void
    {
        $contoh = <<<'PHP'
        <?php
        $validated = $request->validate([
            'catatan' => 'nullable|string|max:500',
            'estimasi_selesai_hari' => 'nullable|integer|min:1|max:90',
            'wajib' => 'required|string',
        ]);
        $a = $validated['estimasi_selesai_hari'];
        $b = $validated['catatan'] ?? null;
        $c = ! empty($validated['catatan']) ? 1 : 2;
        $d = $validated['wajib'];
        PHP;

        $this->pelanggaran = [];
        $this->periksaBerkas(base_path('app').'/Contoh.php', $contoh);

        $this->assertCount(1, $this->pelanggaran, 'hanya `estimasi_selesai_hari` yang tanpa penjaga');
        $this->assertStringContainsString('estimasi_selesai_hari', $this->pelanggaran[0]);
    }
}
