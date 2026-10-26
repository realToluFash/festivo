<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\EventStatus;
use App\Enum\EventType;
use Closure;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Its start and end are wall-clock times in its own zone, not instants: docs/architecture/database.md. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'events')]
#[ORM\Index(name: 'idx_event_organisation_starts', columns: ['organisation_id', 'starts_at_utc'])]
#[ORM\Index(name: 'idx_event_organisation_closes', columns: ['organisation_id', 'closes_at'])]
class Event
{
    use Timestampable;

    public const int NAME_MAXIMUM = 120;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 120)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: EventType::class)]
    private EventType $type;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: EventStatus::class)]
    private EventStatus $status;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $startsAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $endsAt;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $timeZone;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $startsAtUtc;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $endsAtUtc;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $endedAt = null;

    #[ORM\Column(
        type: Types::DATETIME_IMMUTABLE,
        nullable: true,
        insertable: false,
        updatable: false,
        columnDefinition: 'TIMESTAMP(0) WITHOUT TIME ZONE GENERATED ALWAYS AS (COALESCE(ended_at, ends_at_utc)) STORED',
        generated: 'ALWAYS',
    )]
    private ?DateTimeImmutable $closesAt = null;

    #[ORM\Column(type: Types::STRING, length: 3)]
    private string $currency;

    #[ORM\Column(type: Types::STRING, length: 120, nullable: true)]
    private ?string $venueName = null;

    #[ORM\Column(type: Types::STRING, length: 300, nullable: true)]
    private ?string $venueAddress = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $venueLine1 = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $venueLine2 = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $venueCity = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $venueRegion = null;

    #[ORM\Column(type: Types::STRING, length: 32, nullable: true)]
    private ?string $venuePostalCode = null;

    #[ORM\Column(type: Types::STRING, length: 2, nullable: true)]
    private ?string $venueCountryCode = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $venueLatitude = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $venueLongitude = null;

    /** Moved by Doctrine on every update; the resource's ETag (sc-3587). */
    #[ORM\Version]
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 1])]
    private int $version = 1;

    public function __construct(Organisation $organisation, string $name, EventType $type, DateTimeImmutable $startsAt, DateTimeImmutable $endsAt, string $currency)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->name = $name;
        $this->type = $type;
        $this->status = EventStatus::Draft;
        $this->setTimes($startsAt, $endsAt);
        $this->currency = $currency;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getType(): EventType
    {
        return $this->type;
    }

    public function getStatus(): EventStatus
    {
        return $this->status;
    }

    /** In the event's zone, at the offset its rules give today. */
    public function getStartsAt(): DateTimeImmutable
    {
        return $this->zoned($this->startsAt, $this->startsAtUtc);
    }

    public function getEndsAt(): DateTimeImmutable
    {
        return $this->zoned($this->endsAt, $this->endsAtUtc);
    }

    public function getTimeZone(): string
    {
        return $this->timeZone;
    }

    /** When it was ended early, before its own end (sc-3585). */
    public function getEndedAt(): ?DateTimeImmutable
    {
        return $this->endedAt;
    }

    /** UTC, generated by the database: `ended_at`, else `ends_at_utc`. Null until the row is read back. */
    public function getClosesAt(): ?DateTimeImmutable
    {
        return $this->closesAt;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    /** The venue is written whole, by setVenue(); a column on its own means nothing (sc-3589). */
    public function getVenueName(): ?string
    {
        return $this->venueName;
    }

    public function getVenueAddress(): ?string
    {
        return $this->venueAddress;
    }

    public function getVenueLine1(): ?string
    {
        return $this->venueLine1;
    }

    public function getVenueLine2(): ?string
    {
        return $this->venueLine2;
    }

    public function getVenueCity(): ?string
    {
        return $this->venueCity;
    }

    public function getVenueRegion(): ?string
    {
        return $this->venueRegion;
    }

    public function getVenuePostalCode(): ?string
    {
        return $this->venuePostalCode;
    }

    public function getVenueCountryCode(): ?string
    {
        return $this->venueCountryCode;
    }

    public function getVenueLatitude(): ?float
    {
        return $this->venueLatitude;
    }

    public function getVenueLongitude(): ?float
    {
        return $this->venueLongitude;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function setType(EventType $type): void
    {
        $this->type = $type;
    }

    public function setCurrency(string $currency): void
    {
        $this->currency = $currency;
    }

    public function setVenue(
        ?string $name,
        ?string $address,
        ?string $line1 = null,
        ?string $line2 = null,
        ?string $city = null,
        ?string $region = null,
        ?string $postalCode = null,
        ?string $countryCode = null,
        ?float $latitude = null,
        ?float $longitude = null,
    ): void {
        $this->venueName = $name;
        $this->venueAddress = $address;
        $this->venueLine1 = $line1;
        $this->venueLine2 = $line2;
        $this->venueCity = $city;
        $this->venueRegion = $region;
        $this->venuePostalCode = $postalCode;
        $this->venueCountryCode = $countryCode;
        $this->venueLatitude = $latitude;
        $this->venueLongitude = $longitude;
    }

    /** Both in the start's zone. The UTC columns are derived here and in rederiveUtc(), and written nowhere else. */
    public function setTimes(DateTimeImmutable $startsAt, DateTimeImmutable $endsAt): void
    {
        $zone = $startsAt->getTimezone();
        $utc = new DateTimeZone('UTC');

        $this->timeZone = $zone->getName();
        $this->startsAt = self::wallClock($startsAt);
        $this->endsAt = self::wallClock($endsAt->setTimezone($zone));
        $this->startsAtUtc = $startsAt->setTimezone($utc);
        $this->endsAtUtc = $endsAt->setTimezone($utc);
    }

    /** @param Closure(DateTimeImmutable, DateTimeZone): DateTimeImmutable $resolve applied to the stored wall-clock times, which it leaves as the host entered them */
    public function rederiveUtc(Closure $resolve): bool
    {
        $zone = new DateTimeZone($this->timeZone);
        $utc = new DateTimeZone('UTC');
        $startsAtUtc = $resolve($this->startsAt, $zone)->setTimezone($utc);
        $endsAtUtc = $resolve($this->endsAt, $zone)->setTimezone($utc);

        if ($startsAtUtc->format('Y-m-d H:i:s') === $this->startsAtUtc->format('Y-m-d H:i:s') && $endsAtUtc->format('Y-m-d H:i:s') === $this->endsAtUtc->format('Y-m-d H:i:s')) {
            return false;
        }

        $this->startsAtUtc = $startsAtUtc;
        $this->endsAtUtc = $endsAtUtc;

        return true;
    }

    /** The saved instant while it still reads as the wall-clock time, which keeps a repeated hour's earlier offset; rebuilt once the zone's rules have moved. */
    private function zoned(DateTimeImmutable $wallClock, DateTimeImmutable $utc): DateTimeImmutable
    {
        $zone = new DateTimeZone($this->timeZone);
        $saved = new DateTimeImmutable($utc->format('Y-m-d H:i:s'), new DateTimeZone('UTC'))->setTimezone($zone);

        return $saved->format('Y-m-d H:i:s') === $wallClock->format('Y-m-d H:i:s')
            ? $saved
            : new DateTimeImmutable($wallClock->format('Y-m-d H:i:s'), $zone);
    }

    private static function wallClock(DateTimeImmutable $zoned): DateTimeImmutable
    {
        return new DateTimeImmutable($zoned->format('Y-m-d H:i:s'), new DateTimeZone('UTC'));
    }
}
