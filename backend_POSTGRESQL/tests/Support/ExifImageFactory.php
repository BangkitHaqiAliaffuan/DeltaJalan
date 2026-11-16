<?php

namespace Tests\Support;

/**
 * Pembuat JPEG kecil ber-EXIF untuk pengujian.
 *
 * Dipakai agar test batas umur foto tidak bergantung pada berkas fixture
 * (yang tanggalnya tetap dan bisa jadi kedaluwarsa sendiri).
 */
final class ExifImageFactory
{
    /**
     * JPEG 1x1 piksel dengan `DateTimeOriginal` sesuai parameter.
     *
     * @param  string  $dateTime  format EXIF: "Y:m:d H:i:s"
     */
    public static function make(string $dateTime): string
    {
        // JPEG 1x1 piksel minimal (baseline, grayscale).
        $jpeg = base64_decode(
            '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
            .'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
            .'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
        );

        $dt = $dateTime."\0";

        $tiff = "MM\x00\x2a".pack('N', 8);

        // IFD0: satu entri → penunjuk ExifIFD.
        $ifd0Offset = 8;
        $exifIfdOffset = $ifd0Offset + 2 + (1 * 12) + 4;
        $ifd0 = pack('n', 1);
        $ifd0 .= pack('nnN', 0x8769, 4, 1).pack('N', $exifIfdOffset);
        $ifd0 .= pack('N', 0);

        // ExifIFD: satu entri → DateTimeOriginal (ASCII, 20 byte).
        $dtOffset = $exifIfdOffset + 2 + (1 * 12) + 4;
        $exifIfd = pack('n', 1);
        $exifIfd .= pack('nnN', 0x9003, 2, 20).pack('N', $dtOffset);
        $exifIfd .= pack('N', 0);

        $tiff .= $ifd0.$exifIfd.$dt;

        $app1Data = "Exif\x00\x00".$tiff;
        $app1 = "\xFF\xE1".pack('n', strlen($app1Data) + 2).$app1Data;

        // Sisipkan blok APP1 tepat setelah SOI (2 byte pertama).
        return substr($jpeg, 0, 2).$app1.substr($jpeg, 2);
    }
}
