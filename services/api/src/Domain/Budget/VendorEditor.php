<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\VendorFields;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\Vendor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\VendorEngagementRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Adds, edits, archives and restores a vendor (sc-82). Archive is the only way out of the directory, and Restore puts it back as it was. */
final readonly class VendorEditor
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
        private VendorEngagementRepository $engagementRepository,
    ) {
    }

    public function add(Organisation $organisation, VendorFields $fields): Vendor
    {
        $vendor = new Vendor($organisation, $fields->name, $fields->category);
        $this->write($vendor, $fields);
        $this->entityManager->persist($vendor);
        $this->entityManager->flush();

        return $vendor;
    }

    /** An archived vendor is read only, so Restore puts it back as it was (pm, 18 Nov). */
    public function edit(Vendor $vendor, VendorFields $fields): void
    {
        if (null !== $vendor->getArchivedAt()) {
            throw new ApiException(ErrorCode::Conflict, $this->translator->trans('vendors.archived_read_only'));
        }

        $vendor->setName($fields->name);
        $vendor->setCategory($fields->category);
        $this->write($vendor, $fields);
        $this->entityManager->flush();
    }

    /** Archiving one already archived keeps the day it was first archived. Refused while any event still owes it a payment, naming each such event (sc-87). */
    public function archive(Vendor $vendor): void
    {
        $owing = $this->engagementRepository->eventsOwing($vendor);

        if ([] !== $owing) {
            throw new ApiException(ErrorCode::VendorOwed, $this->translator->trans('vendors.archive_refused', ['{vendor}' => $vendor->getName()]), members: [
                'events' => Vec\map($owing, static fn (Event $event): array => ['id' => $event->getId()->toRfc4122(), 'name' => $event->getName()]),
            ]);
        }

        if (null === $vendor->getArchivedAt()) {
            $vendor->setArchivedAt($this->clock->now());
            $this->entityManager->flush();
        }
    }

    public function restore(Vendor $vendor): void
    {
        $vendor->setArchivedAt(null);
        $this->entityManager->flush();
    }

    private function write(Vendor $vendor, VendorFields $fields): void
    {
        $vendor->setContactName($fields->contactName);
        $vendor->setEmailAddress($fields->emailAddress);
        $vendor->setPhone($fields->phoneNumber, $fields->phoneCountryCode);
        $vendor->setWebsite($fields->website);
        $vendor->setAddress($fields->address);
        $vendor->setNote($fields->note);
    }
}
