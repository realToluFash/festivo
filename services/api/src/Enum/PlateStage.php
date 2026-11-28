<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Iter;

/** Where a plate is on its way to a guest (sc-4005), set only by a tray's steps. Mirrors packages/domain's PLATE_STAGES. */
enum PlateStage: string
{
    case ToServe = 'toServe';
    case Dishing = 'dishing';
    case Checked = 'checked';
    case OnItsWay = 'onItsWay';
    case Served = 'served';

    /** @return list<self> the stages a step may take a plate from */
    public static function before(PlateStep $step): array
    {
        return match ($step) {
            PlateStep::Start => [self::ToServe],
            PlateStep::Check => [self::Dishing],
            PlateStep::TakeOff => [self::Dishing, self::Checked],
            PlateStep::TakeToTable => [self::Checked],
            PlateStep::Serve => [self::OnItsWay],
            PlateStep::SendBack => [self::OnItsWay, self::Served],
        };
    }

    public static function after(PlateStep $step): self
    {
        return match ($step) {
            PlateStep::Start => self::Dishing,
            PlateStep::Check => self::Checked,
            PlateStep::TakeOff, PlateStep::SendBack => self::ToServe,
            PlateStep::TakeToTable => self::OnItsWay,
            PlateStep::Serve => self::Served,
        };
    }

    public function allows(PlateStep $step): bool
    {
        return Iter\contains(self::before($step), $this);
    }
}
