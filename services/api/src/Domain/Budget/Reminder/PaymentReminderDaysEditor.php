<?php

declare(strict_types=1);

namespace App\Domain\Budget\Reminder;

use App\Audit\Auditor;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use Doctrine\ORM\EntityManagerInterface;

/** Changing how many days before a payment its reminder goes (sc-95): recorded with who did it, and every reminder not sent yet moved to its new day. */
final readonly class PaymentReminderDaysEditor
{
    public const string CHANGED = 'organisation.payment_reminders_changed';

    public const string SUBJECT = 'Organisation';

    public function __construct(
        private PaymentReminders $paymentReminders,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** The same number again records nothing and moves nothing. */
    public function change(Organisation $organisation, User $by, int $days): void
    {
        $before = $organisation->getPaymentReminderDays();

        if ($days === $before) {
            return;
        }

        $this->entityManager->wrapInTransaction(function () use ($organisation, $by, $before, $days): void {
            $organisation->setPaymentReminderDays($days);
            $this->paymentReminders->followAll($organisation);
            $this->auditor->record(self::CHANGED, self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
                'paymentReminderDays' => [$before, $days],
            ]);
            $this->entityManager->flush();
        });
    }
}
