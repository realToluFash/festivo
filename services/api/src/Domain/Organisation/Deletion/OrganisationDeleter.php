<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Deletion;

use App\Audit\Auditor;
use App\Deletion\RestoreWindow;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An owner deletes the organisation for everybody at once (sc-68); support can restore it until the window closes. */
final readonly class OrganisationDeleter
{
    public const string DELETED = 'organisation.deleted';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private OwnerCheck $ownerCheck,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private AfterResponse $afterResponse,
        private OrganisationDeletionMailer $organisationDeletionMailer,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** The name is typed as shown: exact and case-sensitive once the spaces around it are gone. */
    public function delete(Organisation $organisation, User $by, string $typedName, ?string $asked = null): DateTimeImmutable
    {
        $this->ownerCheck->require($organisation, $by, 'organisation.owner_required');

        if (Str\trim($typedName) !== $organisation->getName()) {
            throw ApiException::validation([[
                'propertyPath' => 'name',
                'message' => $this->translator->trans('organisation.delete_name_mismatch', ['{name}' => $organisation->getName()]),
                'code' => 'organisation_name_mismatch',
            ]]);
        }

        $members = Vec\map($this->membershipRepository->findActiveIn($organisation), static fn (Membership $membership): User => $membership->getUser());
        $at = RestoreWindow::toTheSecond($this->clock->now());
        $organisation->setDeletedAt($at);
        $organisation->setDeletedBy($by->getId());
        $this->auditor->record(self::DELETED, 'Organisation', $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'deletedAt' => [null, $at->format(\DATE_ATOM)],
        ]);
        $this->entityManager->flush();

        $this->afterResponse->defer(fn () => $this->organisationDeletionMailer->sendDeleted($organisation, $by, $members, $at, $asked));

        return $at;
    }
}
