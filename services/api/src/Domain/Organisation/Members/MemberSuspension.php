<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Domain\Organisation\Roles\RoleAssignment;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Membership;
use App\Entity\User;
use DateTimeImmutable;
use DateTimeInterface;

/** A suspension of either kind, by hand or by a domain (sc-564, sc-3575), as it is audited and as a reader sees it. */
final readonly class MemberSuspension
{
    public const string SUSPENDED = 'membership.suspended';
    public const string RESTORED = 'membership.restored';

    public function __construct(
        private UserMailer $userMailer,
        private RoleAssignment $roleAssignment,
    ) {
    }

    /**
     * Why, since when, and the one removal instant, each written in the reader's own zone as the screens show it.
     *
     * @return array{reason: string, domain: ?string, since: array{at: string, written: string}, removesAt: array{at: string, written: string}|null, onlyOwner: bool}|null
     */
    public function describe(Membership $membership, User $reader): ?array
    {
        $suspension = $membership->getSuspension();
        $since = $membership->getSuspendedAt();
        $removesAt = $membership->getRemovesAt();

        if (null === $suspension || null === $since) {
            return null;
        }

        $locale = $this->userMailer->localeFor($reader);
        $written = fn (DateTimeImmutable $at): array => [
            'at' => $at->format(DateTimeInterface::ATOM),
            'written' => $this->userMailer->deadline($at, $reader, $locale),
        ];

        return [
            'reason' => $suspension->value,
            'domain' => $membership->getDomain(),
            'since' => $written($since),
            'removesAt' => null === $removesAt ? null : $written($removesAt),
            'onlyOwner' => $this->roleAssignment->isLastOwner($membership),
        ];
    }
}
