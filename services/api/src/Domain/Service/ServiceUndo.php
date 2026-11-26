<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Entity\Event;
use App\Entity\ServiceItem;
use App\Entity\ServicePlate;
use App\Entity\ServiceStep;
use App\Entity\ServiceTray;
use App\Entity\User;
use App\Repository\ServiceItemRepository;
use App\Repository\ServicePlateRepository;
use App\Repository\ServiceTrayRepository;
use App\Repository\UserRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/**
 * @phpstan-import-type Before from ServiceStep
 *
 * @phpstan-import-type Made from ServiceStep
 */
final readonly class ServiceUndo
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ServicePlateRepository $servicePlateRepository,
        private ServiceTrayRepository $serviceTrayRepository,
        private ServiceItemRepository $serviceItemRepository,
        private UserRepository $userRepository,
    ) {
    }

    /**
     * @param Before $before
     * @param Made   $made
     */
    public function recorded(Event $event, string $kind, array $before, array $made, User $by, DateTimeImmutable $now): void
    {
        $subjects = Vec\unique([
            ...Vec\keys($before['plates']), ...Vec\keys($before['trays']), ...Vec\keys($before['items']),
            ...$made['plates'], ...$made['trays'], ...$made['items'],
        ]);
        $this->entityManager->persist(new ServiceStep($event, $kind, Vec\map($subjects, static fn (int|string $id): string => (string) $id), $before, $made, $by, $now));
    }

    public function restore(ServiceStep $step): void
    {
        $before = $step->getBefore();
        $made = $step->getMade();

        foreach ($before['plates'] as $id => $snapshot) {
            $plate = $this->servicePlateRepository->find(Uuid::fromString($id));
            /** @var array{stage: string, tray: ?string, marks: array<string, string>, choice: ?string, toFollow: list<string>, steps: list<array{stage: string, at: string, by: string}>, owedReason: ?string, owedAt: ?string, sentBack: list<array{reason: string, at: string, by: string, stage: string, steps: list<array{stage: string, at: string, by: string}>}>} $snapshot */
            $plate?->restore($snapshot, null === $snapshot['tray'] ? null : $this->serviceTrayRepository->find(Uuid::fromString($snapshot['tray'])));
        }

        foreach ($before['trays'] as $id => $snapshot) {
            /** @var list<array{step: string, at: string, by: string}> $snapshot */
            $this->serviceTrayRepository->find(Uuid::fromString($id))?->restore($snapshot);
        }

        foreach ($before['items'] as $id => $snapshot) {
            /** @var array{state: string, readyIn: ?int, changedAt: ?string, changedBy: ?string} $snapshot */
            $changedBy = null === $snapshot['changedBy'] ? null : $this->userRepository->find(Uuid::fromString($snapshot['changedBy']));
            $this->serviceItemRepository->find(Uuid::fromString($id))?->restore($snapshot, $changedBy);
        }

        foreach ($made['plates'] as $id) {
            $plate = $this->servicePlateRepository->find(Uuid::fromString($id));

            if (null !== $plate) {
                $this->entityManager->remove($plate);
            }
        }

        $this->entityManager->flush();

        foreach ([...Vec\map($made['trays'], fn (string $id): ?object => $this->serviceTrayRepository->find(Uuid::fromString($id))), ...Vec\map($made['items'], fn (string $id): ?object => $this->serviceItemRepository->find(Uuid::fromString($id)))] as $entity) {
            if (null !== $entity) {
                $this->entityManager->remove($entity);
            }
        }
    }

    /**
     * @param list<ServicePlate> $plates
     * @param list<ServiceTray>  $trays
     * @param list<ServiceItem>  $items
     *
     * @return Before
     */
    public static function before(array $plates = [], array $trays = [], array $items = []): array
    {
        return [
            'plates' => Dict\from_entries(Vec\map($plates, static fn (ServicePlate $plate): array => [$plate->getId()->toRfc4122(), $plate->snapshot()])),
            'trays' => Dict\from_entries(Vec\map($trays, static fn (ServiceTray $tray): array => [$tray->getId()->toRfc4122(), $tray->snapshot()])),
            'items' => Dict\from_entries(Vec\map($items, static fn (ServiceItem $item): array => [$item->getId()->toRfc4122(), $item->snapshot()])),
        ];
    }

    /** @return Before */
    public static function nothing(): array
    {
        return ['plates' => [], 'trays' => [], 'items' => []];
    }

    /** @return Made */
    public static function none(): array
    {
        return ['plates' => [], 'trays' => [], 'items' => []];
    }
}
