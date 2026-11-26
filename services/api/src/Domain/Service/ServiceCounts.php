<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Entity\ServicePlate;
use App\Enum\ItemState;
use App\Enum\PlateStage;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

final class ServiceCounts
{
    /**
     * @param list<ServicePlate>       $orders
     * @param array<string, ItemState> $states
     * @return array{stages: array<string, int>, held: int}
     */
    public static function of(array $orders, array $states): array
    {
        $stages = Dict\from_entries(Vec\map(PlateStage::cases(), static fn (PlateStage $stage): array => [$stage->value, 0]));

        foreach ($orders as $order) {
            ++$stages[$order->getStage()->value];
        }

        return ['stages' => $stages, 'held' => Iter\count(Vec\filter($orders, static fn (ServicePlate $order): bool => ServiceRules::isHeld($order, $states)))];
    }

    /** @param list<ServicePlate> $orders */
    public static function waitingSince(array $orders): ?string
    {
        $since = Vec\map(
            Vec\filter($orders, static fn (ServicePlate $order): bool => PlateStage::Served !== $order->getStage()),
            static fn (ServicePlate $order): string => $order->getSteps()[Iter\count($order->getSteps()) - 1]['at'],
        );

        return [] === $since ? null : Vec\sort($since)[0];
    }

    /**
     * @param list<array<string, mixed>> $tables
     * @return list<array{id: ?string, counts: array{stages: array<string, int>, held: int}}>
     */
    public static function bySection(array $tables): array
    {
        $sections = [];

        foreach ($tables as $table) {
            /** @var ?array{id: string, name: string} $section */
            $section = $table['section'];
            /** @var array{stages: array<string, int>, held: int} $counts */
            $counts = $table['counts'];
            $id = $section['id'] ?? '';
            $sections[$id] ??= ['id' => $section['id'] ?? null, 'counts' => ['stages' => Dict\map($counts['stages'], static fn (int $n): int => 0), 'held' => 0]];

            foreach ($counts['stages'] as $stage => $n) {
                $sections[$id]['counts']['stages'][$stage] += $n;
            }

            $sections[$id]['counts']['held'] += $counts['held'];
        }

        return Vec\values($sections);
    }
}
