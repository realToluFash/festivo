<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\TwoFactor\Passkey\Passkeys;
use App\Entity\Passkey;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Repository\PasskeyRepository;
use App\Repository\TwoFactorFactorRepository;

/** Two-factor is on while a member holds a factor: the authenticator app, or one or more passkeys. */
final readonly class SecondFactors
{
    public function __construct(
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private PasskeyRepository $passkeyRepository,
        private Passkeys $passkeys,
    ) {
    }

    public function isOn(User $user): bool
    {
        return null !== $this->app($user) || $this->passkeyRepository->countFor($user) > 0;
    }

    public function app(User $user): ?TwoFactorFactor
    {
        return $this->twoFactorFactorRepository->findActiveFor($user);
    }

    /** @return list<Passkey> newest first */
    public function passkeys(User $user): array
    {
        return $this->passkeyRepository->findFor($user);
    }

    /** @return array{app: bool, passkeys: bool} which kinds the member holds, for the words that name them */
    public function kinds(User $user): array
    {
        return ['app' => null !== $this->app($user), 'passkeys' => $this->passkeyRepository->countFor($user) > 0];
    }

    /** @return array{app: bool, passkeys: bool} which kinds a step can ask for: a passkey only where this environment offers passkeys */
    public function askable(User $user): array
    {
        $kinds = $this->kinds($user);

        return ['app' => $kinds['app'], 'passkeys' => $kinds['passkeys'] && $this->passkeys->offered()];
    }
}
