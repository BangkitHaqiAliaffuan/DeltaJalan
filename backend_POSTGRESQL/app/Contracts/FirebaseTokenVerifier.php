<?php

namespace App\Contracts;

use App\Support\VerifiedFirebaseUser;

interface FirebaseTokenVerifier
{
    /**
     * @throws \Kreait\Firebase\Exception\Auth\FailedToVerifyToken
     */
    public function verify(string $idToken): VerifiedFirebaseUser;
}
