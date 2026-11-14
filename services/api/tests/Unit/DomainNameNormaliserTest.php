<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Organisation\DomainJoining\DomainNameNormaliser;
use App\Domain\Organisation\DomainJoining\PublicMailDomains;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class DomainNameNormaliserTest extends TestCase
{
    #[Test]
    public function aTypedDomainIsTrimmedAndLowercased(): void
    {
        self::assertSame('ire.events', DomainNameNormaliser::normalise('  IRE.Events '));
    }

    #[Test]
    #[DataProvider('hostnames')]
    public function aHostnameNeedsADotAndNoSpaces(string $domain, bool $accepted): void
    {
        self::assertSame($accepted, DomainNameNormaliser::isHostname($domain));
    }

    /** @return iterable<string, array{string, bool}> */
    public static function hostnames(): iterable
    {
        yield 'two labels' => ['ire.events', true];
        yield 'a subdomain' => ['mail.ire.co.uk', true];
        yield 'an inner hyphen' => ['ire-catering.com', true];
        yield 'no dot' => ['ireevents', false];
        yield 'a space' => ['ire events.com', false];
        yield 'a leading hyphen' => ['-ire.events', false];
        yield 'an at sign' => ['folake@ire.events', false];
        yield 'a numeric ending' => ['ire.123', false];
    }

    #[Test]
    public function theDomainOfAnAddressIsWhatFollowsItsLastAt(): void
    {
        self::assertSame('ire.events', DomainNameNormaliser::domainOf('Folake@IRE.events'));
        self::assertNull(DomainNameNormaliser::domainOf('folake'));
        self::assertNull(DomainNameNormaliser::domainOf('folake@'));
    }

    #[Test]
    public function publicMailDomainsCoverEveryMarketAndNotACompany(): void
    {
        foreach (['gmail.com', 'outlook.com', 'yahoo.es', 'orange.fr', 'sapo.pt', 'uol.com.br'] as $public) {
            self::assertTrue(PublicMailDomains::includes($public), $public);
        }

        self::assertFalse(PublicMailDomains::includes('ire.events'));
    }
}
