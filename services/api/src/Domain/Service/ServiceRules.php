<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Guest\Model\GuestNeeds;
use App\Entity\ServicePlate;
use App\Enum\HeldChoice;
use App\Enum\ItemState;
use App\Enum\NeedKind;
use App\Enum\PlateStage;
use Psl\Iter;
use Psl\Vec;

/** The rules every write and the read share (sc-4005); packages/domain's isHeld is the same rule for a client. */
final class ServiceRules
{
    public const int PLATES_PER_TRIP = 3;

    public const int UNDO_SECONDS = 120;

    /**
     * @param array<string, ItemState> $states the course's items by key; one not there is Ready
     *
     * @return list<string> the keys of the plate's items that are Preparing
     */
    public static function preparing(ServicePlate $plate, array $states): array
    {
        return Vec\map(
            Vec\filter($plate->getItems(), static fn (array $item): bool => ItemState::Preparing === ($states[$item['key']] ?? ItemState::Ready)),
            static fn (array $item): string => $item['key'],
        );
    }

    /** @param array<string, ItemState> $states */
    public static function isHeld(ServicePlate $plate, array $states): bool
    {
        if (!$plate->isOrder() || $plate->isOwed() || PlateStage::ToServe !== $plate->getStage()) {
            return false;
        }

        $preparing = self::preparing($plate, $states);

        if ([] === $preparing) {
            return false;
        }

        return !(HeldChoice::WhatsReadyNow === $plate->getChoice() && Iter\count($preparing) < Iter\count($plate->getItems()));
    }

    /** @param array<string, ItemState> $states */
    public static function isWaiting(ServicePlate $plate, array $states): bool
    {
        if (PlateStage::ToServe !== $plate->getStage() || null !== $plate->getTray()) {
            return false;
        }

        return $plate->isOwed() ? [] === self::preparing($plate, $states) : !self::isHeld($plate, $states);
    }

    /** A guest with an allergen or a diet, codes or Other text: All served leaves them to be ticked by name. */
    public static function isFlagged(GuestNeeds $needs): bool
    {
        return Iter\any([NeedKind::Allergen, NeedKind::Diet], static fn (NeedKind $kind): bool => [] !== $needs->codesOf($kind) || null !== $needs->otherOf($kind));
    }

    /** @return array{allergens: list<string>, allergenOther: ?string, diet: list<string>, dietOther: ?string} never the access needs or the private note */
    public static function flags(GuestNeeds $needs): array
    {
        return [
            'allergens' => $needs->codesOf(NeedKind::Allergen),
            'allergenOther' => $needs->otherOf(NeedKind::Allergen),
            'diet' => $needs->codesOf(NeedKind::Diet),
            'dietOther' => $needs->otherOf(NeedKind::Diet),
        ];
    }
}
