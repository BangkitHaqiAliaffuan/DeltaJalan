<?php

namespace App\Services;

use App\Contracts\FirebaseTokenVerifier;
use App\Support\VerifiedFirebaseUser;
use Kreait\Firebase\Contract\Auth;
use Kreait\Firebase\Factory;

class KreaitFirebaseTokenVerifier implements FirebaseTokenVerifier
{
    private ?Auth $auth = null;

    public function verify(string $idToken): VerifiedFirebaseUser
    {
        $verified = $this->auth()->verifyIdToken($idToken);
        $claims = $verified->claims();

        $firebase = $claims->get('firebase');
        if (is_object($firebase)) {
            $firebase = (array) $firebase;
        }

        $email = strtolower(trim((string) ($claims->get('email') ?? '')));
        $emailVerified = filter_var(
            $claims->get('email_verified'),
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        ) ?? false;

        return new VerifiedFirebaseUser(
            uid: (string) ($claims->get('sub') ?? ''),
            email: $email,
            name: trim((string) ($claims->get('name') ?? '')),
            emailVerified: $emailVerified,
            provider: is_array($firebase) ? (string) ($firebase['sign_in_provider'] ?? '') : '',
        );
    }

    private function auth(): Auth
    {
        if ($this->auth === null) {
            $credPath = config('firebase.credentials');

            if (! $credPath || ! file_exists($credPath)) {
                throw new \RuntimeException('Firebase service account not found at: '.($credPath ?? 'null'));
            }

            $this->auth = (new Factory)
                ->withServiceAccount($credPath)
                ->createAuth();
        }

        return $this->auth;
    }
}
