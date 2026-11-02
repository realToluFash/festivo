<?php

declare(strict_types=1);

namespace App\Domain\Organisation\RequestLink;

use App\Audit\Auditor;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use Psl\SecureRandom;
use SensitiveParameter;

/** Settings > General > Requests to join (sc-562): on, off and replaced. A link switched off never works again. Flushing is the caller's. */
final readonly class RequestLinkEditor
{
    /** 128 bits, written as 32 hex characters. */
    private const int TOKEN_BYTES = 16;

    public function __construct(
        private Auditor $auditor,
    ) {
    }

    /** Already on keeps its link: only Replace link stops one that was shared. */
    public function turnOn(Organisation $organisation, User $by): void
    {
        if (null !== $organisation->getRequestLinkToken()) {
            return;
        }

        $this->write($organisation, $by, 'request_link.turned_on', self::token());
    }

    public function turnOff(Organisation $organisation, User $by): void
    {
        if (null === $organisation->getRequestLinkToken()) {
            return;
        }

        $this->write($organisation, $by, 'request_link.turned_off', null);
    }

    public function replace(Organisation $organisation, User $by): void
    {
        $this->write($organisation, $by, null === $organisation->getRequestLinkToken() ? 'request_link.turned_on' : 'request_link.replaced', self::token());
    }

    /** The audit says that the link changed, never what it is: the trail is read by more people than the setting is. */
    private function write(Organisation $organisation, User $by, string $action, #[SensitiveParameter] ?string $token): void
    {
        $was = null !== $organisation->getRequestLinkToken();
        $organisation->setRequestLinkToken($token);
        $this->auditor->record($action, 'Organisation', $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'requestLink' => [$was ? 'on' : 'off', null === $token ? 'off' : 'on'],
        ]);
    }

    private static function token(): string
    {
        return \bin2hex(SecureRandom\bytes(self::TOKEN_BYTES));
    }
}
