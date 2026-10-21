<?php

namespace App\Support;

final class PhoneNumber
{
    public const VALIDATION_REGEX = '/^(?:\+62|62|0)8[1-9][0-9]{6,9}$/';

    /**
     * Normalisasi nomor Indonesia ke format 08xxxxxxxxxx.
     */
    public static function normalize(string $input): string
    {
        $phone = preg_replace('/[\s\-().]/', '', trim($input)) ?? '';

        if (str_starts_with($phone, '+62')) {
            return '0'.substr($phone, 3);
        }

        if (str_starts_with($phone, '62')) {
            return '0'.substr($phone, 2);
        }

        return $phone;
    }

    public static function isValid(string $input): bool
    {
        return (bool) preg_match(self::VALIDATION_REGEX, $input);
    }
}
