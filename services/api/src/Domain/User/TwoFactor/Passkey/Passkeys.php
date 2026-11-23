<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Passkey;

use App\Entity\Passkey;
use App\Entity\PasskeyChallenge;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasskeyStep;
use App\Http\Exception\ApiException;
use App\Repository\PasskeyChallengeRepository;
use App\Repository\PasskeyRepository;
use App\WebAuthn\Ceremonies;
use App\WebAuthn\CoseKey;
use App\WebAuthn\Exception\CeremonyRefused;
use App\WebAuthn\RelyingParty;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Encoding\Base64;
use Psl\SecureRandom;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/** The member's side of a passkey: the options a browser opens its sheet with, and the answer it sends back. */
final readonly class Passkeys
{
    public const int MOST = 10;
    public const int TIMEOUT_MS = PasskeyChallenge::LIFETIME_MINUTES * 60_000;
    private const int CHALLENGE_BYTES = 32;

    public function __construct(
        private RelyingParty $relyingParty,
        private Ceremonies $ceremonies,
        private PasskeyRepository $passkeyRepository,
        private PasskeyChallengeRepository $passkeyChallengeRepository,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    public function offered(): bool
    {
        return null !== $this->relyingParty->id;
    }

    /** @return array<string, mixed> */
    public function requestOptions(User $user, PasskeyStep $step): array
    {
        $rpId = $this->relyingPartyId();
        $passkeys = $this->passkeyRepository->findFor($user);

        if ([] === $passkeys) {
            throw new ApiException(ErrorCode::TwoFactorOff, 'two_factor.no_passkey');
        }

        return [
            'challenge' => $this->challenge($user, $step),
            'rpId' => $rpId,
            'allowCredentials' => $this->descriptors($passkeys),
            'userVerification' => 'required',
            'timeout' => self::TIMEOUT_MS,
        ];
    }

    /** @return array<string, mixed> */
    public function creationOptions(User $user, PasskeyStep $step): array
    {
        $rpId = $this->relyingPartyId();
        $passkeys = $this->passkeyRepository->findFor($user);

        if (\count($passkeys) >= self::MOST) {
            throw $this->limitReached();
        }

        $email = $user->getPrimaryEmailAddress()?->getAddress();

        return [
            'challenge' => $this->challenge($user, $step),
            'rp' => ['id' => $rpId, 'name' => 'Soirely'],
            'user' => [
                'id' => self::encode($user->getId()->toBinary()),
                'name' => $email ?? $user->getName(),
                'displayName' => $user->getName(),
            ],
            'pubKeyCredParams' => Vec\map(CoseKey::ALGORITHMS, static fn (int $alg): array => ['type' => 'public-key', 'alg' => $alg]),
            'authenticatorSelection' => ['residentKey' => 'required', 'requireResidentKey' => true, 'userVerification' => 'required'],
            'attestation' => 'none',
            'excludeCredentials' => $this->descriptors($passkeys),
            'timeout' => self::TIMEOUT_MS,
        ];
    }

    /**
     * @param array<string, mixed> $credential
     * @param list<PasskeyStep>    $steps
     *
     * @return array{0: Passkey, 1: PasskeyStep} the passkey, and the step its challenge was made for
     */
    public function register(User $user, array $credential, array $steps): array
    {
        try {
            $parts = $this->parts($credential, 'attestationObject');
            $challenge = $this->takeChallenge($user, $steps, $parts['clientDataJSON']);
            $made = $this->ceremonies->register($this->relyingParty, $parts['clientDataJSON'], $parts['attestationObject'], $challenge[0]);
        } catch (CeremonyRefused $refused) {
            $this->logger->info('A new passkey was refused: {reason}', ['reason' => $refused->getMessage()]);
            $this->entityManager->flush();

            throw new ApiException(ErrorCode::PasskeyRefused, 'passkey.did_not_work');
        }

        if ($this->passkeyRepository->countFor($user) >= self::MOST) {
            throw $this->limitReached();
        }

        if (null !== $this->passkeyRepository->findOneBy(['credentialId' => $made->id])) {
            throw new ApiException(ErrorCode::Conflict, 'passkey.already_added');
        }

        $passkey = new Passkey($user, $made->id, $made->publicKeyPem, $made->aaguid, $made->backedUp, $made->signCount, $this->clock->now());
        $this->entityManager->persist($passkey);

        return [$passkey, $challenge[1]];
    }

    /** @param array<string, mixed> $credential */
    public function passes(User $user, PasskeyStep $step, array $credential): bool
    {
        try {
            $parts = $this->parts($credential, 'authenticatorData', 'signature');
            [$challenge] = $this->takeChallenge($user, [$step], $parts['clientDataJSON']);
            $passkey = $this->passkeyRepository->findOneOf($user, Type\string()->coerce($credential['id'] ?? null))
                ?? throw new CeremonyRefused('not one of this member\'s passkeys');
            $checked = $this->ceremonies->assert(
                $this->relyingParty,
                $parts['clientDataJSON'],
                $parts['authenticatorData'],
                $parts['signature'],
                $challenge,
                $passkey->getPublicKey(),
                $passkey->getSignCount(),
            );
        } catch (CeremonyRefused|Type\Exception\CoercionException $refused) {
            $this->logger->info('A passkey was refused: {reason}', ['reason' => $refused->getMessage()]);

            return false;
        }

        $passkey->setSignCount($checked->signCount);
        $passkey->setBackedUp($checked->backedUp);
        $passkey->setLastUsedAt($this->clock->now());

        return true;
    }

    private function relyingPartyId(): string
    {
        return $this->relyingParty->id ?? throw new ApiException(ErrorCode::PasskeysNotOffered, 'passkey.not_offered');
    }

    private function challenge(User $user, PasskeyStep $step): string
    {
        $now = $this->clock->now();
        $this->entityManager
            ->createQuery('DELETE FROM ' . PasskeyChallenge::class . ' c WHERE c.user = :user AND c.expiresAt <= :now')
            ->setParameter('user', $user)
            ->setParameter('now', $now, Types::DATETIME_IMMUTABLE)
            ->execute();

        $bytes = SecureRandom\bytes(self::CHALLENGE_BYTES);
        $this->entityManager->persist(new PasskeyChallenge($user, $step, \hash('sha256', $bytes), $now));
        $this->entityManager->flush();

        return self::encode($bytes);
    }

    /**
     * @param list<PasskeyStep> $steps
     *
     * @return array{0: string, 1: PasskeyStep}
     */
    private function takeChallenge(User $user, array $steps, string $clientDataJson): array
    {
        $bytes = $this->ceremonies->challengeOf($clientDataJson);
        $held = $this->passkeyChallengeRepository->findOneByHash(\hash('sha256', $bytes));

        if (null === $held || !$held->getUser()->getId()->equals($user->getId())) {
            throw new CeremonyRefused('no such challenge for this member');
        }

        $this->entityManager->remove($held);

        if (!\in_array($held->getStep(), $steps, true) || $held->getExpiresAt() <= $this->clock->now()) {
            throw new CeremonyRefused('challenge made for another step, or lapsed');
        }

        return [$bytes, $held->getStep()];
    }

    /**
     * @param array<string, mixed> $credential
     *
     * @return array<string, string> each named part of the response, decoded
     */
    private function parts(array $credential, string ...$names): array
    {
        $response = $credential['response'] ?? null;
        $parts = [];

        foreach (['clientDataJSON', ...$names] as $name) {
            $value = \is_array($response) ? ($response[$name] ?? null) : null;

            try {
                $parts[$name] = Base64\decode(Type\string()->coerce($value), Base64\Variant::UrlSafe, explicitPadding: false);
            } catch (Throwable) {
                throw new CeremonyRefused($name . ' is missing or not base64url');
            }
        }

        return $parts;
    }

    /**
     * @param list<Passkey> $passkeys
     *
     * @return list<array{type: string, id: string}>
     */
    private function descriptors(array $passkeys): array
    {
        return Vec\map($passkeys, static fn (Passkey $passkey): array => ['type' => 'public-key', 'id' => $passkey->getCredentialId()]);
    }

    private function limitReached(): ApiException
    {
        return new ApiException(ErrorCode::PasskeyLimit, 'passkey.limit');
    }

    private static function encode(string $bytes): string
    {
        return Base64\encode($bytes, Base64\Variant::UrlSafe, padding: false);
    }
}
