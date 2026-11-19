<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\RunOfShow\Card\RunOfShowCard;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** The app's runOfShowCards.test.ts pins the same value, so this device's card and the server's replace each other. */
final class RunOfShowCardKeyTest extends TestCase
{
    #[Test]
    public function aTracksKeyIsTheOneTheAppPutsItsOwnCardUnder(): void
    {
        self::assertSame('run-of-show:c3ac8bbec6b290de930b917fff0924f724e38f4a', RunOfShowCard::key('e1', '2027-03-06', 'Ballroom'));
    }
}
