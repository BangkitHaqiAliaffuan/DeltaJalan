<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Bulanan Rekapitulasi Kerusakan Jalan</title>
  <style>
    @page { margin: 1.8cm 1.5cm 1.5cm 1.5cm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
    }

    .kop {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 0.6cm;
      margin-bottom: 0.8cm;
    }
    .kop .logo {
      width: 70px;
      height: 70px;
      margin-bottom: 4px;
    }
    .kop h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .kop h2 {
      font-size: 12pt;
      font-weight: bold;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .kop p {
      font-size: 9pt;
      margin: 0;
    }
    .kop .garis-bawah {
      border-bottom: 1px solid #000;
      margin-top: 4px;
    }

    .judul {
      text-align: center;
      margin-bottom: 0.6cm;
    }
    .judul h3 {
      font-size: 13pt;
      font-weight: bold;
      margin: 0 0 4px 0;
      text-decoration: underline;
    }
    .judul p {
      font-size: 11pt;
      margin: 0;
      font-weight: bold;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0.5cm;
      font-size: 10pt;
    }
    table th {
      background-color: #e0e0e0;
      font-weight: bold;
      text-align: center;
      border: 1px solid #000;
      padding: 5px 4px;
    }
    table td {
      border: 1px solid #000;
      padding: 4px 4px;
      vertical-align: top;
    }
    table td.angka {
      text-align: center;
    }
    table td.kanan {
      text-align: right;
    }

    .ringkasan-label {
      font-weight: bold;
    }
    .total-row td {
      font-weight: bold;
      background-color: #f0f0f0;
    }

    .pengesahan {
      margin-top: 1cm;
      text-align: center;
    }
    .pengesahan .kiri {
      float: left;
      width: 45%;
      text-align: center;
    }
    .pengesahan .kanan {
      float: right;
      width: 45%;
      text-align: center;
    }
    .pengesahan .clear {
      clear: both;
    }
    .pengesahan .jabatan {
      margin-bottom: 2.5cm;
    }
    .pengesahan .nama {
      font-weight: bold;
      text-decoration: underline;
    }
    .pengesahan .nip {
      font-size: 10pt;
    }

    .footer-cetak {
      text-align: right;
      font-size: 9pt;
      margin-top: 0.3cm;
      font-style: italic;
    }

    .section-title {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 4px;
      margin-top: 0.3cm;
    }

    .keterangan {
      font-size: 9pt;
      margin-top: 0.3cm;
    }
  </style>
</head>
<body>

  {{-- KOP SURAT --}}
  <div class="kop">
    <h1>Pemerintah Kabupaten Sidoarjo</h1>
    <h2>Dinas Pekerjaan Umum Bina Marga</h2>
    <p>Jalan Raya Bandara Juanda No. 1, Sedati, Sidoarjo 61253</p>
    <p>Telp. (031) 8912345 | Email: pubmsda@sidoarjokab.go.id</p>
    <p>Website: https://pubmsda.sidoarjokab.go.id</p>
    <div class="garis-bawah"></div>
  </div>

  {{-- JUDUL --}}
  <div class="judul">
    <h3>Laporan Bulanan Rekapitulasi Kerusakan Jalan</h3>
    <p>Bulan: {{ $bulanTahun }}</p>
  </div>

  {{-- SECTION 1: RINGKASAN STATUS --}}
  <div class="section-title">A. Ringkasan Status Laporan</div>
  <table>
    <thead>
      <tr>
        <th style="width: 60%;">Status</th>
        <th style="width: 20%;">Jumlah</th>
        <th style="width: 20%;">Persentase</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($ringkasanStatus as $item)
        <tr>
          <td>{{ $item['label'] }}</td>
          <td class="angka">{{ $item['jumlah'] }}</td>
          <td class="angka">{{ $item['persen'] }}</td>
        </tr>
      @endforeach
      <tr class="total-row">
        <td>Total</td>
        <td class="angka">{{ $totalLaporan }}</td>
        <td class="angka">100%</td>
      </tr>
    </tbody>
  </table>

  {{-- SECTION 2: TRUST SCORE --}}
  <div class="section-title">B. Tingkat Kredibilitas Laporan</div>
  <table>
    <thead>
      <tr>
        <th style="width: 60%;">Kategori</th>
        <th style="width: 20%;">Jumlah</th>
        <th style="width: 20%;">Persentase</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($trustBreakdown as $item)
        <tr>
          <td>{{ $item['label'] }}</td>
          <td class="angka">{{ $item['jumlah'] }}</td>
          <td class="angka">{{ $item['persen'] }}</td>
        </tr>
      @endforeach
      <tr class="total-row">
        <td>Total</td>
        <td class="angka">{{ $totalLaporan }}</td>
        <td class="angka">100%</td>
      </tr>
    </tbody>
  </table>

  {{-- SECTION 3: PER-UPR --}}
  <div class="section-title">C. Rekapitulasi per Unit Pelaksana Rutin (UPR)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 25%;">UPR / Satgas</th>
        <th style="width: 10%;">Total</th>
        <th style="width: 12%;">Sedang Diperbaiki</th>
        <th style="width: 10%;">Selesai</th>
        <th style="width: 18%;">Total Panjang (m)</th>
        <th style="width: 20%;">Total Luas (m&sup2;)</th>
      </tr>
    </thead>
    <tbody>
      @forelse ($uprBreakdown as $i => $item)
        <tr>
          <td class="angka">{{ $i + 1 }}</td>
          <td>{{ $item['upr_name'] }}</td>
          <td class="angka">{{ $item['total'] }}</td>
          <td class="angka">{{ $item['sedang_diperbaiki'] }}</td>
          <td class="angka">{{ $item['selesai'] }}</td>
          <td class="kanan">{{ number_format($item['total_panjang_m'], 1, ',', '.') }}</td>
          <td class="kanan">{{ number_format($item['total_luas_m2'], 1, ',', '.') }}</td>
        </tr>
      @empty
        <tr><td colspan="7" class="angka">Tidak ada data</td></tr>
      @endforelse
      <tr class="total-row">
        <td colspan="2">Total</td>
        <td class="angka">{{ collect($uprBreakdown)->sum('total') }}</td>
        <td class="angka">{{ collect($uprBreakdown)->sum('sedang_diperbaiki') }}</td>
        <td class="angka">{{ collect($uprBreakdown)->sum('selesai') }}</td>
        <td class="kanan">{{ number_format(collect($uprBreakdown)->sum('total_panjang_m'), 1, ',', '.') }}</td>
        <td class="kanan">{{ number_format(collect($uprBreakdown)->sum('total_luas_m2'), 1, ',', '.') }}</td>
      </tr>
    </tbody>
  </table>

  {{-- SECTION 4: PER SEVERITY --}}
  <div class="section-title">D. Tingkat Keparahan Kerusakan</div>
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 55%;">Tingkat Kerusakan</th>
        <th style="width: 20%;">Jumlah</th>
        <th style="width: 20%;">Persentase</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($severityBreakdown as $i => $item)
        <tr>
          <td class="angka">{{ $i + 1 }}</td>
          <td>{{ $item['label'] }}</td>
          <td class="angka">{{ $item['jumlah'] }}</td>
          <td class="angka">{{ $item['persen'] }}</td>
        </tr>
      @endforeach
      <tr class="total-row">
        <td colspan="2">Total</td>
        <td class="angka">{{ collect($severityBreakdown)->sum('jumlah') }}</td>
        <td class="angka">100%</td>
      </tr>
    </tbody>
  </table>

  {{-- SECTION 5: PER KECAMATAN --}}
  <div class="section-title">E. Sebaran per Kecamatan</div>
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 55%;">Kecamatan</th>
        <th style="width: 20%;">Jumlah</th>
        <th style="width: 20%;">Persentase</th>
      </tr>
    </thead>
    <tbody>
      @forelse ($districtBreakdown as $i => $item)
        <tr>
          <td class="angka">{{ $i + 1 }}</td>
          <td>{{ $item['kecamatan'] }}</td>
          <td class="angka">{{ $item['jumlah'] }}</td>
          <td class="angka">{{ $item['persen'] }}</td>
        </tr>
      @empty
        <tr><td colspan="4" class="angka">Tidak ada data</td></tr>
      @endforelse
      <tr class="total-row">
        <td colspan="2">Total</td>
        <td class="angka">{{ collect($districtBreakdown)->sum('jumlah') }}</td>
        <td class="angka">100%</td>
      </tr>
    </tbody>
  </table>

  {{-- PENGESAHAN --}}
  <div class="pengesahan">
    <div class="kiri">
      <p class="jabatan">Mengetahui,<br>Kepala Dinas PU Bina Marga</p>
      <p class="nama">_________________________</p>
      <p class="nip">NIP. _________________</p>
    </div>
    <div class="kanan">
      <p>Sidoarjo, {{ $tanggalCetak }}</p>
      <p class="jabatan">a.n. Kepala Dinas PU Bina Marga<br>Sekretaris,</p>
      <p class="nama">_________________________</p>
      <p class="nip">NIP. _________________</p>
    </div>
    <div class="clear"></div>
  </div>

  <div class="footer-cetak">
    Dicetak pada: {{ $tanggalCetak }} | Sistem Informasi JalanKita - Dinas PU Bina Marga Kabupaten Sidoarjo
  </div>

</body>
</html>
