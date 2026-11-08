<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\User;

/** Both sides of a transfer hear of it, each in their own language. */
final readonly class OwnershipTransferMailer
{
    public function __construct(
        private UserMailer $userMailer,
    ) {
    }

    /** `$asked` is the language the previous owner made it in: the send runs after the response, which has forgotten it. */
    public function sendTransferred(Organisation $organisation, User $from, User $to, ?string $asked = null): void
    {
        $named = ['{organisation}' => $organisation->getName()];

        foreach ([[$from, 'ownershipTransferred.youGaveIt', $asked], [$to, 'ownershipTransferred.youHaveIt', null]] as [$reader, $key, $language]) {
            $address = $reader->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($reader, $language);
            $this->userMailer->send($address, $locale, 'ownershipTransferred.subject', [
                $this->userMailer->line($key, $locale, [...$named, '{from}' => $from->getName(), '{to}' => $to->getName()]),
                '--',
                $this->userMailer->line('ownershipTransferred.footer', $locale, $named),
            ], $named);
        }
    }
}
