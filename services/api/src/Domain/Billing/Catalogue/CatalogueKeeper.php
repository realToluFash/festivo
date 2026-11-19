<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue;

use App\Audit\Auditor;
use App\Domain\Billing\Catalogue\Exception\CatalogueRefused;
use App\Domain\Billing\Model\ChangedBy;
use App\Domain\Billing\SubscriptionChanger;
use App\Entity\CatalogueVersion;
use App\Enum\Actor;
use App\Enum\CataloguePart;
use App\Repository\CatalogueVersionRepository;
use App\Repository\SubscriptionRepository;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** Every staff action on the catalogue, each audited (sc-3928). Plan terms apply to new subscriptions at once and to existing ones only when staff move them; a rise in any unit cost applies after the notice, a fall at once. */
final readonly class CatalogueKeeper
{
    public const string PUBLISHED = 'catalogue.published';
    public const string WITHDRAWN = 'catalogue.withdrawn';
    public const string MOVED = 'catalogue.subscribers_moved';
    public const string SUBJECT = 'CatalogueVersion';
    public const string RISE_NOTICE = '+14 days';
    public const int NAME_MAXIMUM = 40;

    public function __construct(
        private EntityManagerInterface $entityManager,
        private CatalogueVersionRepository $catalogueVersionRepository,
        private Catalogue $catalogue,
        private SubscriptionRepository $subscriptionRepository,
        private SubscriptionChanger $subscriptionChanger,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    /** @param array<array-key, mixed> $terms */
    public function publish(CataloguePart $part, string $name, array $terms, string $note, string $agent): CatalogueVersion
    {
        [$name, $note, $agent] = [Str\trim($name), Str\trim($note), Str\trim($agent)];

        self::signed($agent, $note);

        if ('' === $name || Str\length($name) > self::NAME_MAXIMUM) {
            throw new CatalogueRefused(Str\format('Name the version in 1 to %d characters.', self::NAME_MAXIMUM));
        }

        if (null !== $this->catalogueVersionRepository->findOneByName($part, $name)) {
            throw new CatalogueRefused(Str\format('A %s version is already called %s.', $part->value, $name));
        }

        CatalogueParser::check($part, $terms);

        $now = $this->clock->now();
        $pending = CataloguePart::UnitCosts === $part ? $this->catalogueVersionRepository->findPendingUnitCosts($now) : null;

        if (null !== $pending) {
            throw new CatalogueRefused(Str\format('Unit costs %s are pending and apply from %s. Withdraw them first, then publish one version holding every change.', $pending->getName(), $pending->getEffectiveFrom()->format('j M Y')));
        }

        $effectiveFrom = CataloguePart::UnitCosts === $part && $this->rises($terms) ? $now->modify(self::RISE_NOTICE) : $now;
        $version = new CatalogueVersion($part, $name, $terms, $note, $agent, $now, $effectiveFrom);

        $this->entityManager->wrapInTransaction(function () use ($version, $part, $name, $note, $agent, $effectiveFrom): void {
            $this->entityManager->persist($version);
            $this->auditor->record(self::PUBLISHED, self::SUBJECT, $version->getId(), Actor::Agent, null, $agent, [
                'part' => [null, $part->value],
                'name' => [null, $name],
                'note' => [null, $note],
                'effectiveFrom' => [null, $effectiveFrom->format(DateTimeInterface::ATOM)],
            ]);
        });

        $this->catalogue->forget();

        return $version;
    }

    /** Only a version nothing uses: plan terms no subscription is on, while another plans version remains, or unit costs not yet in force. */
    public function withdraw(CatalogueVersion $version, string $reason, string $agent): void
    {
        [$reason, $agent] = [Str\trim($reason), Str\trim($agent)];

        self::signed($agent, $reason);

        $inUse = match ($version->getPart()) {
            CataloguePart::Plans => $this->subscriptionRepository->countOn($version) > 0
                || 1 === $this->catalogueVersionRepository->countOf(CataloguePart::Plans),
            CataloguePart::UnitCosts => $version->getEffectiveFrom() <= $this->clock->now(),
        };

        if ($inUse) {
            throw new CatalogueRefused(Str\format('%s is in use, so it cannot be withdrawn. Publish a new version instead.', $version->getName()));
        }

        $this->entityManager->wrapInTransaction(function () use ($version, $reason, $agent): void {
            $this->auditor->record(self::WITHDRAWN, self::SUBJECT, $version->getId(), Actor::Agent, null, $agent, [
                'part' => [$version->getPart()->value, null],
                'name' => [$version->getName(), null],
                'reason' => [null, $reason],
            ]);
            $this->entityManager->remove($version);
        });

        $this->catalogue->forget();
    }

    /** @return int how many moved: every subscription not on `$to`, or only those on `$from` */
    public function moveSubscribers(CatalogueVersion $to, ?CatalogueVersion $from, string $reason, string $agent): int
    {
        [$reason, $agent] = [Str\trim($reason), Str\trim($agent)];

        self::signed($agent, $reason);

        if (CataloguePart::Plans !== $to->getPart() || (null !== $from && CataloguePart::Plans !== $from->getPart())) {
            throw new CatalogueRefused('Subscriptions are moved between plans versions; unit costs apply to everyone already.');
        }

        $moving = $this->subscriptionRepository->findToMove($to, $from);

        $this->subscriptionChanger->moveToCatalogueVersion($moving, $to, ChangedBy::staff($agent, $reason), function () use ($to, $from, $moving, $reason, $agent): void {
            $this->auditor->record(self::MOVED, self::SUBJECT, $to->getId(), Actor::Agent, null, $agent, [
                'from' => [null, $from?->getName()],
                'to' => [null, $to->getName()],
                'moved' => [null, Iter\count($moving)],
                'reason' => [null, $reason],
            ]);
        });

        return Iter\count($moving);
    }

    private static function signed(string $agent, string $why): void
    {
        if ('' === $agent) {
            throw new CatalogueRefused('Name the member of staff doing this.');
        }

        if ('' === $why) {
            throw new CatalogueRefused('Say why, as the audit trail records it.');
        }
    }

    private function rises(mixed $terms): bool
    {
        $inForce = $this->catalogue->unitCosts();

        return CatalogueParser::unitCosts(Uuid::v7(), 'new', $this->clock->now(), $terms)->risesFrom($inForce);
    }
}
