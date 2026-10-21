<?php

namespace App\Support;

final class VerifiedFirebaseUser
{
    public function __construct(
        public readonly string $uid,
        public readonly string $email,
        public readonly string $name,
        public readonly bool $emailVerified,
        public readonly string $provider,
    ) {}
}
