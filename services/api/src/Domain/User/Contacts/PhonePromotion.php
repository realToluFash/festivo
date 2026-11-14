<?php

declare(strict_types=1);

namespace App\Domain\User\Contacts;

use App\Audit\Auditor;
use App\Entity\PhoneNumber;
use App\Enum\Actor;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/** The one way a linked number becomes primary, whichever screen asked for it. */
final readonly class PhonePromotion
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    public function promote(PhoneNumber $phone): void
    {
        $this->underLock($phone, static fn (?PhoneNumber $before): bool => true);
    }

    /** sc-2244: the first number proved takes primary from none, or from an unverified one, which stays linked. */
    public function promoteIfNoneVerified(PhoneNumber $phone): void
    {
        $this->underLock($phone, static fn (?PhoneNumber $before): bool => true !== $before?->isVerified() && $phone->isVerified());
    }

    /** @param callable(?PhoneNumber): bool $wanted judged on rows read again under the lock: a promotion that committed meanwhile moved the flag */
    private function underLock(PhoneNumber $phone, callable $wanted): void
    {
        $user = $phone->getUser();

        $this->entityManager->wrapInTransaction(function () use ($user, $phone, $wanted): void {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);

            foreach ($user->getPhoneNumbers() as $held) {
                $this->entityManager->refresh($held);
            }

            $before = $user->getPrimaryPhoneNumber();

            if (!$wanted($before)) {
                return;
            }

            $before?->setPrimary(false);
            $this->entityManager->flush();
            $phone->setPrimary(true);
            $this->auditor->record('phone.primary', 'Account', $user->getId(), Actor::User, $user->getId(), $user->getName(), ['primary' => [$before?->getNumber(), $phone->getNumber()]]);
            $this->entityManager->flush();
        });
    }
}
