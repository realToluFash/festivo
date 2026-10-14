<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\AI\Availability;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Two questions, and the four answers they produce.
 *
 * A single boolean would collapse "nobody configured a key" into "this
 * installation does not want the feature", and those need different responses
 * from whoever is reading the logs.
 */
final class AvailabilityTest extends TestCase
{
    #[Test]
    public function configuredAndSwitchedOnIsEnabled(): void
    {
        $availability = new Availability('anthropic', 'sk-ant-something', true);

        self::assertTrue($availability->isConfigured());
        self::assertTrue($availability->isEnabled());
        self::assertNull($availability->unavailableReason());
    }

    /**
     * Switched on with no key is a configuration that reports itself as working
     * and fails on the first request. It reports itself as unavailable instead.
     */
    #[Test]
    public function switchedOnWithNoKeyIsNotEnabledAndSaysWhy(): void
    {
        $availability = new Availability('anthropic', '   ', true);

        self::assertFalse($availability->isConfigured());
        self::assertFalse($availability->isEnabled());
        self::assertSame('no provider key is configured', $availability->unavailableReason());
    }

    #[Test]
    public function configuredButSwitchedOffSaysSoRatherThanBlamingTheKey(): void
    {
        $availability = new Availability('anthropic', 'sk-ant-something', false);

        self::assertTrue($availability->isConfigured());
        self::assertFalse($availability->isEnabled());
        self::assertSame(
            'the assistant is switched off for this installation',
            $availability->unavailableReason(),
        );
    }

    /** The stand-in needs no key. That is the entire point of it. */
    #[Test]
    public function theStandInIsConfiguredWithoutAKey(): void
    {
        $availability = new Availability(Availability::STAND_IN, '', true);

        self::assertTrue($availability->isConfigured());
        self::assertTrue($availability->isEnabled());
    }

    /** But it is still subject to the switch. Off means off. */
    #[Test]
    public function theStandInIsStillSubjectToTheSwitch(): void
    {
        self::assertFalse(new Availability(Availability::STAND_IN, '', false)->isEnabled());
    }
}
