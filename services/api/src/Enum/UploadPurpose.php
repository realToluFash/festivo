<?php

declare(strict_types=1);

namespace App\Enum;

enum UploadPurpose: string
{
    case EventCover = 'event_cover';
    case GuestImport = 'guest_import';
    case SupportAttachment = 'support_attachment';
    case OrganisationLogo = 'organisation_logo';

    /** @return list<string> */
    public function allowedTypes(): array
    {
        return match ($this) {
            self::EventCover, self::OrganisationLogo => [
                'image/jpeg',
                'image/png',
                'image/webp',
            ],
            self::GuestImport => [
                'text/csv',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
            self::SupportAttachment => [
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf',
                'text/plain',
            ],
        };
    }

    public function maxBytes(): int
    {
        return match ($this) {
            self::OrganisationLogo => 2 * 1024 * 1024,
            self::EventCover => 10 * 1024 * 1024,
            self::GuestImport => 15 * 1024 * 1024,
            self::SupportAttachment => 25 * 1024 * 1024,
        };
    }

    public function isPublic(): bool
    {
        return match ($this) {
            self::EventCover, self::OrganisationLogo => true,
            self::GuestImport, self::SupportAttachment => false,
        };
    }

    public function allows(string $contentType): bool
    {
        return \in_array(\strtolower(\trim($contentType)), $this->allowedTypes(), true);
    }
}
