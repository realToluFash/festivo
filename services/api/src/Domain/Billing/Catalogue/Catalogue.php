<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue;

use App\Domain\Billing\Catalogue\Model\PlanCatalogue;
use App\Domain\Billing\Catalogue\Model\UnitCosts;
use App\Entity\CatalogueVersion;
use App\Entity\Subscription;
use App\Enum\CataloguePart;
use App\Repository\CatalogueVersionRepository;
use DateTimeImmutable;
use LogicException;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/** The one read of the plan catalogue (sc-3928), from `cache.catalogue`, never the database per request; a version never changes, so each parses once per process. */
final class Catalogue
{
    private const string KEY = 'catalogue.versions';

    /** @var array<string, PlanCatalogue> by version id */
    private array $plans = [];

    /** @var array<string, UnitCosts> by version id */
    private array $unitCosts = [];

    public function __construct(
        private readonly CatalogueVersionRepository $catalogueVersionRepository,
        private readonly CacheInterface $catalogueCache,
        private readonly ClockInterface $clock,
    ) {
    }

    public function inForce(): PlanCatalogue
    {
        return $this->plans($this->latest(CataloguePart::Plans, $this->clock->now())['id']);
    }

    /** The plan terms `$subscription` keeps until staff move it, whatever is in force. */
    public function soldTo(Subscription $subscription): PlanCatalogue
    {
        return $this->plans($subscription->getCatalogueVersion()->getId()->toRfc4122());
    }

    public function plansVersion(Uuid $versionId): PlanCatalogue
    {
        return $this->plans($versionId->toRfc4122());
    }

    public function unitCosts(?DateTimeImmutable $at = null): UnitCosts
    {
        return $this->costs($this->latest(CataloguePart::UnitCosts, $at ?? $this->clock->now())['id']);
    }

    /** As a reservation recorded it, so the send settles at the cost it was reserved at (sc-3929). */
    public function unitCostsVersion(Uuid $versionId): UnitCosts
    {
        return $this->costs($versionId->toRfc4122());
    }

    /** A published rise not yet in force, for the notice on Plan and billing (sc-3934). */
    public function upcomingUnitCosts(): ?UnitCosts
    {
        $now = $this->clock->now()->getTimestamp();
        $later = Vec\filter($this->versions(), static fn (array $version): bool => CataloguePart::UnitCosts->value === $version['part'] && $version['effectiveFrom'] > $now);

        $next = Iter\last($later);

        return null === $next ? null : $this->costs($next['id']);
    }

    public function forget(): void
    {
        $this->catalogueCache->delete(self::KEY);
    }

    /** @return array{id: string, part: string, name: string, effectiveFrom: int, terms: array<array-key, mixed>} */
    private function latest(CataloguePart $part, DateTimeImmutable $at): array
    {
        $versions = Vec\filter($this->versions(), static fn (array $version): bool => $part->value === $version['part']);
        $applying = Vec\filter($versions, static fn (array $version): bool => $version['effectiveFrom'] <= $at->getTimestamp());

        // The first version answers for any moment before it, so a date earlier than the catalogue still has terms.
        return Iter\last($applying) ?? Iter\first($versions) ?? throw new LogicException('The catalogue has no ' . $part->value . ' version.');
    }

    private function plans(string $id): PlanCatalogue
    {
        if (!Iter\contains_key($this->plans, $id)) {
            $version = $this->cached($id, CataloguePart::Plans);
            $this->plans[$id] = CatalogueParser::plans(Uuid::fromString($id), $version['name'], $version['terms']);
        }

        return $this->plans[$id];
    }

    private function costs(string $id): UnitCosts
    {
        if (!Iter\contains_key($this->unitCosts, $id)) {
            $version = $this->cached($id, CataloguePart::UnitCosts);
            $this->unitCosts[$id] = CatalogueParser::unitCosts(Uuid::fromString($id), $version['name'], new DateTimeImmutable('@' . $version['effectiveFrom']), $version['terms']);
        }

        return $this->unitCosts[$id];
    }

    /** @return array{id: string, part: string, name: string, effectiveFrom: int, terms: array<array-key, mixed>} */
    private function cached(string $id, CataloguePart $part): array
    {
        foreach ($this->versions() as $version) {
            if ($id === $version['id'] && $part->value === $version['part']) {
                return $version;
            }
        }

        throw new LogicException('No ' . $part->value . ' catalogue version has the id ' . $id . '.');
    }

    /** @return list<array{id: string, part: string, name: string, effectiveFrom: int, terms: array<array-key, mixed>}> oldest in force first */
    private function versions(): array
    {
        $cached = $this->catalogueCache->get(self::KEY, fn (ItemInterface $item): array => Vec\map(
            $this->catalogueVersionRepository->findAllInOrder(),
            static fn (CatalogueVersion $version): array => [
                'id' => $version->getId()->toRfc4122(),
                'part' => $version->getPart()->value,
                'name' => $version->getName(),
                'effectiveFrom' => $version->getEffectiveFrom()->getTimestamp(),
                'terms' => $version->getTerms(),
            ],
        ));

        return Type\vec(Type\shape([
            'id' => Type\string(),
            'part' => Type\string(),
            'name' => Type\string(),
            'effectiveFrom' => Type\int(),
            'terms' => Type\dict(Type\array_key(), Type\mixed()),
        ]))->coerce($cached);
    }
}
