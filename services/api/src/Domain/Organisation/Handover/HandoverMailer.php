<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Domain\Organisation\Handover\Model\Responsibility;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\User;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** The summary of what moved (sc-614): to the person who has it now, and to the Owners when nobody was chosen. */
final readonly class HandoverMailer
{
    public function __construct(
        private UserMailer $userMailer,
    ) {
    }

    /**
     * `$asked` is the language of the request that made the handover, when the recipient made it themselves.
     *
     * @param list<Responsibility> $work
     */
    public function sendReceived(Organisation $organisation, User $from, User $to, array $work, ?string $asked = null): void
    {
        $this->send($organisation, $to, $asked, 'handover.received', $from, $to, $work);
    }

    /** @param list<Responsibility> $work */
    public function sendToOwner(Organisation $organisation, User $from, User $to, User $owner, array $work): void
    {
        $this->send($organisation, $owner, null, 'handover.wentToOwner', $from, $to, $work);
    }

    /** @param list<Responsibility> $work */
    private function send(Organisation $organisation, User $reader, ?string $asked, string $key, User $from, User $to, array $work): void
    {
        $address = $reader->getPrimaryEmailAddress()?->getAddress();

        if (null === $address) {
            return;
        }

        $locale = $this->userMailer->localeFor($reader, $asked);
        $named = ['{organisation}' => $organisation->getName(), '{from}' => $from->getName()];
        $this->userMailer->send($address, $locale, 'handover.subject', [
            $this->userMailer->line($key, $locale, ['organisation' => $organisation->getName(), 'from' => $from->getName(), 'to' => $to->getName(), 'count' => Iter\count($work)]),
            Str\join(Vec\map($work, fn (Responsibility $responsibility): string => $this->userMailer->line('handover.item', $locale, [
                '{title}' => $responsibility->title,
                '{kind}' => $this->userMailer->line('handover.kind.' . $responsibility->field->kind, $locale),
            ])), "\n"),
            '--',
            $this->userMailer->line('handover.footer', $locale, $named),
        ], $named);
    }
}
