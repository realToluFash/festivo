<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\VendorFields;
use App\Entity\Organisation;
use App\Entity\Vendor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Adds, edits, archives and restores a vendor (sc-82). Archive is the only way out of the directory, and Restore puts it back as it was. */
final readonly class VendorEditor
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
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

    /** Archiving one already archived keeps the day it was first archived. */
    public function archive(Vendor $vendor): void
    {
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
