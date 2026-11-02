<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Audit\Auditor;
use App\Domain\User\SignInMethods\RecentProof;
use App\Entity\User;
use App\Enum\Actor;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use SensitiveParameter;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Uid\Uuid;

/** A lost phone: every session but this device's ends at once, after proving it is you (sc-115). */
final readonly class SignOutEverywhereElse
{
    public function __construct(
        private RecentProof $recentProof,
        private TokenIssuer $tokenIssuer,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private RateLimiterFactoryInterface $signOutElsewhereAccountLimiter,
    ) {
    }

    /**
     * Without this account's `$keep`, the caller's own session ends too. `$caller` is the chain the access token
     * carries; no chain means the caller cannot be told it stays in.
     *
     * @return array{signedOut: int, thisDevice: bool}
     */
    public function signOut(User $user, #[SensitiveParameter] ?string $proof, ?Uuid $keep, ?Uuid $caller): array
    {
        // The proof first: whoever holds an unlocked phone must not be able to spend the owner's budget.
        $this->recentProof->require($user, $proof);

        $limit = $this->signOutElsewhereAccountLimiter->create($user->getId()->toRfc4122())->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.tries', $limit->getRetryAfter());
        }

        $ended = $this->entityManager->wrapInTransaction(function () use ($user, $keep): array {
            $ended = $this->tokenIssuer->revokeAllExcept($user, $keep);
            $this->auditor->record('sessions.signed_out_elsewhere', 'Account', $user->getId(), Actor::User, $user->getId(), $user->getName(), [
                'signedOut' => [null, Iter\count($ended)],
            ]);

            return $ended;
        });

        return [
            'signedOut' => Iter\count($ended),
            'thisDevice' => null === $caller || Iter\any($ended, static fn (Uuid $chain): bool => $chain->equals($caller)),
        ];
    }
}
