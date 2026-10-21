<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use App\Domain\User\Mail\UserMailer;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\DomainSuspension;
use LogicException;
use Psl\Str;

/** `domain_suspended`: the organisation's owners and administrators, each told the removal instant in their own zone. */
final readonly class DomainSuspensionMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    /** @param list<User> $administrators */
    public function sendSuspended(Membership $membership, array $administrators): void
    {
        $removesAt = DomainSuspender::removesAt($membership) ?? throw new LogicException('Only a suspended membership is reported.');
        $organisation = $membership->getOrganisation();
        $named = [
            '{name}' => $membership->getUser()->getName(),
            '{organisation}' => $organisation->getName(),
            '{domain}' => $membership->getDomain() ?? '',
        ];
        $reason = match ($membership->getSuspension()) {
            DomainSuspension::DomainClosed => 'domainSuspended.domainClosed',
            DomainSuspension::DomainManagedElsewhere => 'domainSuspended.managedElsewhere',
            default => 'domainSuspended.addressGone',
        };
        $link = Str\trim_right($this->webOrigin, '/') . '/app/settings/members';

        foreach ($administrators as $administrator) {
            $address = $administrator->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($administrator);

            $this->userMailer->send($address, $locale, 'domainSuspended.subject', [
                $this->userMailer->line($reason, $locale, $named),
                $this->userMailer->line('domainSuspended.kept', $locale, $named),
                $this->userMailer->line('domainSuspended.deadline', $locale, ['{deadline}' => $this->userMailer->deadline($removesAt, $administrator, $locale)]),
                $this->userMailer->line('domainSuspended.review', $locale, [...$named, '{link}' => $link]),
                '--',
                $this->userMailer->line('domainSuspended.footer', $locale, $named),
            ], $named);
        }
    }
}
