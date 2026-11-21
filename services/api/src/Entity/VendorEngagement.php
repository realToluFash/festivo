<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A vendor engaged for an event (sc-87): one per vendor on an event, carrying its quotes, current and earlier, and its schedule of payments. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'vendor_engagements')]
#[ORM\Index(name: 'idx_vendor_engagement_vendor', columns: ['vendor_id'])]
#[ORM\UniqueConstraint(name: 'uniq_vendor_engagement', columns: ['event_id', 'vendor_id'])]
class VendorEngagement
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: Vendor::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Vendor $vendor;

    public function __construct(Event $event, Vendor $vendor)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->vendor = $vendor;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getVendor(): Vendor
    {
        return $this->vendor;
    }
}
