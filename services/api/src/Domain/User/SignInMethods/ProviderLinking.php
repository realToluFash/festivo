<?php

declare(strict_types=1);

namespace App\Domain\User\SignInMethods;

use App\Audit\Auditor;
use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\User\Provider\ProviderClaims;
use App\Domain\User\TokenIssuer;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\ProviderIdentityRepository;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Uid\Uuid;
use Throwable;

/** Settings > Security, Ways to sign in: Google or Apple bound on purpose, or removed, but never the last way in (sc-510). */
final readonly class ProviderLinking
{
    public function __construct(
        private ProviderIdentityRepository $providerIdentityRepository,
        private RecentProof $recentProof,
        private TokenIssuer $tokenIssuer,
        private Auditor $auditor,
        private SignInMethodMailer $signInMethodMailer,
        private AfterResponse $afterResponse,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private SignInRules $signInRules,
    ) {
    }

    /**
     * Any address the provider vouches for, matching or not: a work Google account on a personal sign-up is the point.
     *
     * @param Uuid|null $caller the chain the access token carries (CallerSession), which carries on as signed in with the provider under Google or Apple only
     */
    public function link(
        User $user,
        IdentityProvider $provider,
        ProviderClaims $claims,
        #[SensitiveParameter]
        ?string $proof,
        ?Uuid $caller = null,
        ?Request $request = null,
    ): ProviderIdentity {
        $this->recentProof->require($user, $proof);
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $held = $this->providerIdentityRepository->findOneBySubject($provider, $claims->subject);

            // The same account linked again changes nothing, so nothing is recorded or emailed.
            if (null !== $held && $held->getUser()->getId()->equals($user->getId())) {
                $this->carryOn($user, $caller, $provider);
                $connection->commit();

                return $held;
            }

            if (null !== $held) {
                throw self::taken($provider);
            }

            if (null !== $this->linkedTo($user, $provider)) {
                throw new ApiException(ErrorCode::Conflict, 'provider.unlink_first');
            }

            $identity = new ProviderIdentity($user, $provider, $claims->subject, $claims->verifiedEmail());
            $this->entityManager->persist($identity);
            $this->record($user, 'provider.linked', [null, $provider->value]);
            $this->entityManager->flush();
            $this->carryOn($user, $caller, $provider);
            $connection->commit();
        } catch (UniqueConstraintViolationException $e) {
            $connection->rollBack();

            throw self::taken($provider, $e);
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }

        $this->tell($user, $provider, $identity->getEmail(), $request, linked: true);

        return $identity;
    }

    /**
     * Never the last way in: with no password and no other provider, it stays (sc-113's rule for the last address).
     *
     * @param Uuid|null $caller the chain the access token carries (CallerSession)
     *
     * @return array{signedOut: int, thisDevice: bool} the sessions that sign-ins through it started, now ended
     */
    public function unlink(
        User $user,
        IdentityProvider $provider,
        #[SensitiveParameter]
        ?string $proof,
        ?Uuid $caller = null,
        ?Request $request = null,
    ): array {
        $this->recentProof->require($user, $proof);
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $all = $this->providerIdentityRepository->findBy(['user' => $user]);
            [$removed, $kept] = Vec\partition($all, static fn (ProviderIdentity $identity): bool => $identity->getProvider() === $provider);

            if ([] === $removed) {
                throw ApiException::notFound('provider.not_linked');
            }

            if (null === $user->getPassword() && [] === $kept) {
                throw new ApiException(ErrorCode::LastSignInMethod, 'provider.last_method');
            }

            $requiring = [] === $kept ? $this->signInRules->requiringProvider($user) : null;

            if (null !== $requiring) {
                throw new ApiException(
                    ErrorCode::ProviderKeptByRule,
                    'provider.link_other_first',
                    [],
                    null,
                    [],
                    ['organisation' => $requiring->getName(), 'provider' => $provider->value],
                );
            }

            foreach ($removed as $identity) {
                $this->entityManager->remove($identity);
            }

            $this->record($user, 'provider.unlinked', [$provider->value, null]);
            $this->entityManager->flush();
            $ended = $this->tokenIssuer->revokeSignedInWith($user, $provider);
            $connection->commit();
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }

        $this->tell($user, $provider, Iter\first($removed)?->getEmail(), $request, linked: false);

        // The session the caller holds, never one it names (sessions.md); no chain cannot be told it stays in.
        return [
            'signedOut' => Iter\count($ended),
            'thisDevice' => null === $caller || Iter\any($ended, static fn (Uuid $chain): bool => $chain->equals($caller)),
        ];
    }

    private function carryOn(User $user, ?Uuid $caller, IdentityProvider $provider): void
    {
        if (null !== $caller && null !== $this->signInRules->refusingPassword($user)) {
            $this->tokenIssuer->markSignedInWith($user, $caller, $provider);
        }
    }

    private function linkedTo(User $user, IdentityProvider $provider): ?ProviderIdentity
    {
        return $this->providerIdentityRepository->findOneBy(['user' => $user, 'provider' => $provider]);
    }

    /** @param array{0: ?string, 1: ?string} $change the provider before and after, as the Auditor stores every change */
    private function record(User $user, string $action, array $change): void
    {
        $this->auditor->record($action, 'Account', $user->getId(), Actor::User, $user->getId(), $user->getName(), ['provider' => $change]);
    }

    private function tell(User $user, IdentityProvider $provider, ?string $vouchedFor, ?Request $request, bool $linked): void
    {
        $at = $this->clock->now();
        $userAgent = $request?->headers->get('User-Agent');
        $ipAddress = $request?->getClientIp();
        $asked = $request?->getLocale();

        $this->afterResponse->defer($linked
            ? fn () => $this->signInMethodMailer->sendLinked($user, $provider, $vouchedFor, $at, $userAgent, $ipAddress, $asked)
            : fn () => $this->signInMethodMailer->sendUnlinked($user, $provider, $vouchedFor, $at, $userAgent, $ipAddress, $asked));
    }

    private static function taken(IdentityProvider $provider, ?Throwable $previous = null): ApiException
    {
        return new ApiException(ErrorCode::ProviderTaken, 'provider.taken', [], $previous, [], ['provider' => $provider->value]);
    }
}
