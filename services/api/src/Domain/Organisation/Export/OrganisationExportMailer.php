<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Export;

use App\Domain\User\Mail\UserMailer;
use App\Entity\OrganisationExport;
use App\Enum\AccountMail;
use Psl\Str;

/** The Owner who asked hears that the archive is ready, with its one download and when that ends, in their own zone. */
final readonly class OrganisationExportMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    public function ready(OrganisationExport $export, ?string $asked = null): void
    {
        $user = $export->getAskedBy();
        $address = $user->getPrimaryEmailAddress()?->getAddress();
        $expiresAt = $export->expiresAt();

        if (null === $address || null === $expiresAt) {
            return;
        }

        $locale = $this->userMailer->localeFor($user, $asked);
        $named = ['{organisation}' => $export->getOrganisation()->getName()];
        $link = Str\format('%s/app/settings/data-and-control/export?download=%s', Str\trim_right($this->webOrigin, '/'), $export->getId()->toRfc4122());

        $this->userMailer->send(AccountMail::OrganisationExport, $address, $locale, 'organisationExport.subject', [
            $this->userMailer->line('organisationExport.body', $locale, [
                ...$named,
                '{when}' => $this->userMailer->moment($export->getAskedAt(), $user, $locale),
                '{deadline}' => $this->userMailer->deadline($expiresAt, $user, $locale),
            ]),
            $this->userMailer->line('organisationExport.download', $locale, ['{link}' => $link]),
            '--',
            $this->userMailer->line('organisationExport.footer', $locale, $named),
        ], $named);
    }
}
