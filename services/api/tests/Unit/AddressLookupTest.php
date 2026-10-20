<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Address\AddressLookup;
use App\Address\Exception\AddressNotFound;
use App\Address\Exception\ProviderUnavailable;
use App\Tests\Double\CountingAddressProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Throwable;

/**
 * The behaviour around the provider, against a counting double.
 *
 * Every test here is about NOT calling the provider, because each call is
 * billable and an autocomplete field fires on keystrokes.
 */
final class AddressLookupTest extends TestCase
{
    /**
     * Typing "Lo" on the way to "London" would otherwise be two billable
     * lookups that could never have matched anything useful.
     */
    #[Test]
    public function aQueryTooShortToMatchIsNeverAsked(): void
    {
        $provider = $this->countingProvider();
        $lookup = $this->lookup($provider);

        self::assertSame([], $lookup->suggest('l'));
        self::assertSame([], $lookup->suggest('lo'));
        self::assertSame([], $lookup->suggest('  '));

        self::assertSame(0, $provider->suggestCalls);
    }

    #[Test]
    public function aLongEnoughQueryIsAskedOnceAndThenCached(): void
    {
        $provider = $this->countingProvider();
        $lookup = $this->lookup($provider);

        $lookup->suggest('london bridge');
        $lookup->suggest('london bridge');
        $lookup->suggest('london bridge');

        self::assertSame(1, $provider->suggestCalls);
    }

    #[Test]
    public function theCountryIsPartOfTheCacheKey(): void
    {
        $provider = $this->countingProvider();
        $lookup = $this->lookup($provider);

        $lookup->suggest('springfield', 'us');
        $lookup->suggest('springfield', 'gb');

        // Same words, different question. Sharing a cache entry would answer
        // one country's query with another's results.
        self::assertSame(2, $provider->suggestCalls);
    }

    /** A query is free text; a cache key may not contain what somebody types. */
    #[Test]
    public function aQueryContainingReservedCharactersDoesNotBreakTheCache(): void
    {
        $provider = $this->countingProvider();
        $lookup = $this->lookup($provider);

        $lookup->suggest('{curly} @at :colon /slash');
        $lookup->suggest('{curly} @at :colon /slash');

        self::assertSame(1, $provider->suggestCalls);
    }

    #[Test]
    public function resolvingIsCachedToo(): void
    {
        $provider = $this->countingProvider();
        $lookup = $this->lookup($provider);

        $lookup->resolve('node:1');
        $lookup->resolve('node:1');

        self::assertSame(1, $provider->resolveCalls);
    }

    /**
     * "We cannot ask" and "no such address" must stay distinguishable. The
     * first is never a reason to stop somebody saving a venue they typed out
     * themselves.
     */
    #[Test]
    public function anOutageIsNotReportedAsAMissingAddress(): void
    {
        $provider = $this->countingProvider(suggestThrows: new ProviderUnavailable('down'));

        $this->expectException(ProviderUnavailable::class);
        $this->lookup($provider)->suggest('london bridge');
    }

    #[Test]
    public function aMissingAddressIsNotReportedAsAnOutage(): void
    {
        $provider = $this->countingProvider(resolveThrows: new AddressNotFound('nope'));

        $this->expectException(AddressNotFound::class);
        $this->lookup($provider)->resolve('node:404');
    }

    /** A failure must not be cached, or one blip persists for an hour. */
    #[Test]
    public function aFailedLookupIsRetriedRatherThanRemembered(): void
    {
        $provider = $this->countingProvider(suggestThrows: new ProviderUnavailable('down'));
        $lookup = $this->lookup($provider);

        foreach (\range(1, 3) as $_) {
            try {
                $lookup->suggest('london bridge');
            } catch (ProviderUnavailable) {
                // expected
            }
        }

        self::assertSame(3, $provider->suggestCalls);
    }

    private function lookup(CountingAddressProvider $provider): AddressLookup
    {
        return new AddressLookup($provider, new ArrayAdapter());
    }

    private function countingProvider(
        ?Throwable $suggestThrows = null,
        ?Throwable $resolveThrows = null,
    ): CountingAddressProvider {
        return new CountingAddressProvider($suggestThrows, $resolveThrows);
    }
}
