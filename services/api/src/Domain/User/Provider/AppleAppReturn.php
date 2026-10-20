<?php

declare(strict_types=1);

namespace App\Domain\User\Provider;

use App\Domain\User\Model\ProviderSignInResult;
use App\Domain\User\TokenIssuer;
use App\Entity\AppleAppAttempt;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use App\Repository\AppleAppAttemptRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

/** Apple on Android returns only by form_post; the app gets a one-time handle, never the code or tokens. */
final readonly class AppleAppReturn
{
    private const int HANDLE_BYTES = 32;

    public function __construct(
        private AppleAppAttemptRepository $appleAppAttemptRepository,
        private ProviderSignIn $providerSignIn,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private string $appleReturnUri,
    ) {
    }

    /** The app says it is starting, with its state and the S256 challenge of its PKCE verifier. */
    public function start(#[SensitiveParameter] string $state, string $codeChallenge): void
    {
        if ('' === $state || null !== $this->appleAppAttemptRepository->findOneByStateHash(TokenIssuer::hash($state))) {
            throw new ApiException(ErrorCode::BadRequest, 'Start a new sign-in.');
        }

        $this->entityManager->persist(new AppleAppAttempt(TokenIssuer::hash($state), $codeChallenge, $this->clock->now()));
        $this->entityManager->flush();
    }

    /**
     * The App Link's query for a state the app started, spent or not; null only when no app started it.
     *
     * @return array{handle: string}|array{error: 'cancelled'|'expired'}|null
     */
    public function receive(#[SensitiveParameter] string $state, #[SensitiveParameter] ?string $code, ?string $appleUser): ?array
    {
        $attempt = $this->appleAppAttemptRepository->findOneByStateHash(TokenIssuer::hash($state));
        $now = $this->clock->now();

        if (null === $attempt) {
            return null;
        }

        // Posted twice, or too late: still the app's, so its code never goes on to a web URL.
        if (!$attempt->isAwaitingAppleAt($now)) {
            return ['error' => 'expired'];
        }

        // A cancel or a failure at Apple carries no code: the app is sent back with nothing to exchange.
        if (null === $code || '' === $code) {
            $attempt->markUsed($now);
            $this->entityManager->flush();

            return ['error' => 'cancelled'];
        }

        $handle = \bin2hex(SecureRandom\bytes(self::HANDLE_BYTES));
        $attempt->received($code, $appleUser, TokenIssuer::hash($handle), $now);
        $this->entityManager->flush();

        return ['handle' => $handle];
    }

    /** Once, within its minute, with the verifier whose challenge started it, and redeemed at the API's own return route. */
    public function exchange(
        #[SensitiveParameter]
        string $handle,
        #[SensitiveParameter]
        string $codeVerifier,
        #[SensitiveParameter]
        ?string $rawNonce,
        ?string $sentRedirectUri = null,
        ?Request $request = null,
    ): ProviderSignInResult {
        [$code, $appleUser] = $this->spend($handle, $codeVerifier, $sentRedirectUri);

        return $this->providerSignIn->signInWithCode(IdentityProvider::Apple, $code, $codeVerifier, $this->appleReturnUri, $rawNonce, $request, self::nameFrom($appleUser));
    }

    /**
     * The handle's code, spent, for a caller that redeems it itself: linking Apple from Security on Android.
     *
     * @return array{0: string, 1: ?string} the code, and Apple's `user` form field
     */
    public function spend(
        #[SensitiveParameter]
        string $handle,
        #[SensitiveParameter]
        string $codeVerifier,
        ?string $sentRedirectUri = null,
    ): array {
        if (null !== $sentRedirectUri && $sentRedirectUri !== $this->appleReturnUri) {
            throw new ApiException(ErrorCode::OAuthTokenInvalid, 'That sign-in could not be checked.');
        }

        $attempt = '' === $handle ? null : $this->appleAppAttemptRepository->findOneByHandleHash(TokenIssuer::hash($handle));
        $now = $this->clock->now();
        $code = $attempt?->getCode();

        if (null === $attempt || null === $code || !$attempt->isHandleOpenAt($now) || !\hash_equals($attempt->getCodeChallenge(), self::challengeOf($codeVerifier))) {
            throw new ApiException(ErrorCode::OAuthTokenInvalid, 'That sign-in could not be checked.');
        }

        $appleUser = $attempt->getAppleUser();
        $attempt->markUsed($now);
        $this->entityManager->flush();

        return [$code, $appleUser];
    }

    public function returnUri(): string
    {
        return $this->appleReturnUri;
    }

    /** RFC 7636 S256: base64url of the SHA-256 of the verifier, unpadded. */
    private static function challengeOf(#[SensitiveParameter] string $verifier): string
    {
        return Str\trim_right(Str\replace_every(\base64_encode(\hash('sha256', $verifier, true)), ['+' => '-', '/' => '_']), '=');
    }

    /** Apple sends the name once, as JSON beside the code, on the first authorisation only. */
    private static function nameFrom(?string $appleUser): ?string
    {
        if (null === $appleUser) {
            return null;
        }

        try {
            $name = Type\shape(['name' => Type\shape(['firstName' => Type\optional(Type\string()), 'lastName' => Type\optional(Type\string())], true)], true)
                ->coerce(Json\decode($appleUser))['name'];
        } catch (Json\Exception\DecodeException|Type\Exception\CoercionException) {
            return null;
        }

        $full = Str\trim(($name['firstName'] ?? '') . ' ' . ($name['lastName'] ?? ''));

        return '' === $full ? null : $full;
    }
}
