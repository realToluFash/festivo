<?php

declare(strict_types=1);

namespace App\Domain\Organisation\AuditLog;

use App\Domain\User\Mail\UserMailer;
use App\Entity\AuditExport;
use App\Enum\AccountMail;
use Psl\Str;

/** `audit_export_ready`: only the person who exported hears, with a link that works for 24 hours and only while they are signed in (sc-611). */
final readonly class AuditExportMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    public function ready(AuditExport $export): void
    {
        $user = $export->getAskedBy();
        $address = $user->getPrimaryEmailAddress()?->getAddress();
        $expiresAt = $export->expiresAt();

        if (null === $address || null === $expiresAt) {
            return;
        }

        $locale = $this->userMailer->localeFor($user, $export->getLocale());
        $named = ['{organisation}' => $export->getOrganisation()->getName()];
        $link = Str\format('%s/app/settings/data-and-control/audit-log?download=%s', Str\trim_right($this->webOrigin, '/'), $export->getId()->toRfc4122());

        $this->userMailer->send(AccountMail::AuditExportReady, $address, $locale, 'auditExportReady.subject', [
            $this->userMailer->line('auditExportReady.body', $locale, [
                ...$named,
                '{when}' => $this->userMailer->deadline($export->getAskedAt(), $user, $locale),
                '{deadline}' => $this->userMailer->deadline($expiresAt, $user, $locale),
            ]),
            $this->userMailer->line('auditExportReady.download', $locale, ['{link}' => $link]),
            '--',
            $this->userMailer->line('auditExportReady.footer', $locale, $named),
        ], $named);
    }
}
