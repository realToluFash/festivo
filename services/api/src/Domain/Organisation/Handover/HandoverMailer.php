<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Domain\User\Mail\UserMailer;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\AccountMail;
use App\Locale\ListJoiner;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** Who now leads a departing member's events hears which (sc-614): the person chosen, or every owner when the leaver chose nobody. None says the departing person is no longer a member. */
final readonly class HandoverMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private ListJoiner $listJoiner,
    ) {
    }

    /** @param list<Event> $events */
    public function sendReceived(Organisation $organisation, User $from, User $to, array $events): void
    {
        $locale = $this->userMailer->localeFor($to);
        $this->send($organisation, $to, $locale, $this->userMailer->line('handover.received', $locale, [
            'from' => $from->getName(),
            'organisation' => $organisation->getName(),
            'count' => Iter\count($events),
        ]), $events);
    }

    /**
     * @param list<User>  $others the other owners, who lead them too
     * @param list<Event> $events
     */
    public function sendOwnersTook(Organisation $organisation, User $from, User $owner, array $others, array $events): void
    {
        $locale = $this->userMailer->localeFor($owner);
        $this->send($organisation, $owner, $locale, $this->userMailer->line('handover.wentToOwner', $locale, [
            'from' => $from->getName(),
            'organisation' => $organisation->getName(),
            'count' => Iter\count($events),
            'otherOwners' => Iter\count($others),
            'others' => $this->listJoiner->join(Vec\map($others, static fn (User $other): string => $other->getName()), 'and', $locale),
        ]), $events);
    }

    /** @param list<Event> $events */
    private function send(Organisation $organisation, User $reader, string $locale, string $opening, array $events): void
    {
        $address = $reader->getPrimaryEmailAddress()?->getAddress();

        if (null === $address) {
            return;
        }

        $named = ['{organisation}' => $organisation->getName()];
        $this->userMailer->send(AccountMail::Handover, $address, $locale, 'handover.subject', [
            $opening,
            Str\join(Vec\map($events, fn (Event $event): string => $this->userMailer->line('handover.item', $locale, ['{title}' => $event->getName()])), "\n"),
            '--',
            $this->userMailer->line('handover.footer', $locale, $named),
        ], $named);
    }
}
