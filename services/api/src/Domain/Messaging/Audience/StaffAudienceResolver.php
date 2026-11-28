<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Audience;

use App\Domain\Messaging\Interfaces\AudienceResolverInterface;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\User\Mail\AccountLanguage;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\NotificationAudienceKind;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Uid\Uuid;

/** A person on the staff is reached through the account they signed in to the app with (sc-4235), so a delivery's recipient is that account, which push finds devices by. One taken off the roster is named by that account alone. */
final readonly class StaffAudienceResolver implements AudienceResolverInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private AccountLanguage $accountLanguage,
    ) {
    }

    public function kind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Staff;
    }

    public function resolve(Audience $audience, ?Uuid $after, int $limit): array
    {
        $account = null === $after ? $this->removed($audience) ?? $this->entry($audience)?->getAccount() : null;

        return null === $account ? [] : [$account->getId()];
    }

    public function recipient(Audience $audience, Uuid $id): ?Recipient
    {
        $removed = $this->removed($audience);

        if (null !== $removed) {
            return $removed->getId()->equals($id) ? new Recipient(NotificationAudienceKind::Staff, $removed->getId(), $removed->getName(), $this->accountLanguage->of($removed), null) : null;
        }

        $entry = $this->entry($audience);
        $account = $entry?->getAccount();

        if (null === $entry || null === $account || !$account->getId()->equals($id)) {
            return null;
        }

        return new Recipient(NotificationAudienceKind::Staff, $account->getId(), $entry->getFullName(), $this->accountLanguage->of($account), null);
    }

    private function removed(Audience $audience): ?User
    {
        $account = $audience->conditions['account'] ?? null;

        return \is_string($account) ? $this->entityManager->find(User::class, $account) : null;
    }

    private function entry(Audience $audience): ?StaffMember
    {
        $id = $audience->only[0] ?? null;
        $eventId = $audience->eventId;

        if (null === $id || null === $eventId) {
            return null;
        }

        $entry = $this->entityManager->find(StaffMember::class, $id);

        return null !== $entry && $entry->getEvent()->getId()->equals($eventId) ? $entry : null;
    }
}
