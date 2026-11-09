<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Verifikasi Pendaftaran DeltaJalan</title>
</head>
<body style="margin:0; padding:0; background-color:#F5F7FA; font-family:Arial, Helvetica, sans-serif; color:#1F2937;">
  <!--
    Email transaksional: seluruh gaya ditulis inline karena banyak klien email
    (Gmail, Outlook) membuang <style> di <head>. Tanpa aset eksternal.

    Kode OTP ditampilkan sebagai teks, bukan gambar — sebagian klien memblokir
    gambar secara default, dan kode harus tetap terbaca.
  -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7FA; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid #D0DAE8; border-radius:8px;">
          <!-- Kop -->
          <tr>
            <td style="padding:24px 32px; border-bottom:1px solid #E5EAF2;">
              <div style="font-size:18px; font-weight:bold; color:#1E4E8C;">DeltaJalan</div>
              <div style="font-size:12px; color:#6B7280; margin-top:2px;">Dinas PU Bina Marga &amp; SDA &mdash; Kab. Sidoarjo</div>
            </td>
          </tr>

          <!-- Isi -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 12px 0; font-size:14px; line-height:1.5;">
                Halo {{ $recipientName !== '' ? $recipientName : 'Warga' }},
              </p>

              <p style="margin:0 0 20px 0; font-size:14px; line-height:1.5; color:#374151;">
                Gunakan kode berikut untuk menyelesaikan pendaftaran akun DeltaJalan Anda.
                Kode ini bersifat rahasia &mdash; jangan bagikan kepada siapa pun.
              </p>

              <!-- Kode -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#F0F5FC; border:1px solid #C7D9F0; border-radius:8px; padding:20px 12px;">
                    <div style="font-size:34px; font-weight:bold; letter-spacing:8px; color:#1E4E8C; font-family:'Courier New', Courier, monospace;">
                      {{ $code }}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0; font-size:13px; line-height:1.5; color:#6B7280;">
                Kode ini berlaku selama <strong>{{ $ttlMinutes }} menit</strong> sejak email ini dikirim.
              </p>
            </td>
          </tr>

          <!-- Catatan -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <div style="border-top:1px solid #E5EAF2; padding-top:16px; font-size:12px; line-height:1.5; color:#6B7280;">
                Bila Anda tidak merasa mendaftar akun DeltaJalan, abaikan email ini.
                Tanpa kode di atas, tidak ada akun yang dibuat dengan alamat email Anda.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px 32px; background-color:#FAFBFD; border-top:1px solid #E5EAF2; border-radius:0 0 8px 8px;">
              <div style="font-size:11px; color:#9CA3AF; line-height:1.5;">
                Email otomatis dari sistem DeltaJalan &mdash; mohon tidak dibalas.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>