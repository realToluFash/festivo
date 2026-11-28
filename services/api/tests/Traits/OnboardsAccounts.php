<?php

declare(strict_types=1);

namespace App\Tests\Traits;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Onboarding\AccountCompleteness;
use App\Entity\User;
use App\Enum\AccountOrigin;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Walks an account through the onboarding gate, for tests about what lies behind it.
 *
 * @phpstan-require-extends \App\Tests\ApiTestCase
 */
trait OnboardsAccounts
{
    /** Verified, the details screen saved, and a self-registered account given an organisation unless told not to. */
    protected static function onboard(User $user, bool $withOrganisation = true): void
    {
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        $user->markDetailsSaved();

        $needsOrganisation = $withOrganisation
            && AccountOrigin::SelfRegistered === $user->getOrigin()
            && !self::service(AccountCompleteness::class)->hasOrganisation($user);

        if ($needsOrganisation) {
            self::service(OrganisationFounder::class)->found($user, 'Test Events', 'NG', 'Africa/Lagos');
        }

        self::service(EntityManagerInterface::class)->flush();
    }
}
