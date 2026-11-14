<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\SupportedLocales;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Parity across every server catalogue, not just the error one.
 *
 * A key present in English and missing elsewhere falls back and renders fine,
 * which is the right behaviour for the reader and the reason nobody notices. It
 * has to be a failing test or it is nothing.
 */
final class ServerCatalogueParityTest extends TestCase
{
    #[Test]
    public function everyDomainExistsInEveryLocale(): void
    {
        foreach ($this->domains() as $domain) {
            foreach (SupportedLocales::ALL as $locale) {
                self::assertFileExists(
                    $this->path($domain, $locale),
                    "Domain '{$domain}' has no catalogue for '{$locale}'",
                );
            }
        }
    }

    #[Test]
    public function everyDomainHasTheSameKeysInEveryLocale(): void
    {
        foreach ($this->domains() as $domain) {
            $reference = \array_keys($this->load($domain, SupportedLocales::DEFAULT));
            \sort($reference);

            foreach (SupportedLocales::ALL as $locale) {
                $keys = \array_keys($this->load($domain, $locale));
                \sort($keys);

                self::assertSame(
                    $reference,
                    $keys,
                    "Key set differs in {$domain}.{$locale}: missing "
                    . \implode(', ', \array_diff($reference, $keys))
                    . ' | extra ' . \implode(', ', \array_diff($keys, $reference)),
                );
            }
        }
    }

    /**
     * A message whose slots differ between locales breaks at render time in one
     * language only — the one nobody on the team reads.
     */
    #[Test]
    public function aMessageHasTheSamePlaceholdersInEveryLocale(): void
    {
        foreach ($this->domains() as $domain) {
            $english = $this->load($domain, SupportedLocales::DEFAULT);

            foreach (SupportedLocales::ALL as $locale) {
                foreach ($this->load($domain, $locale) as $key => $message) {
                    self::assertSame(
                        $this->placeholders($english[$key] ?? ''),
                        $this->placeholders($message),
                        "Placeholders differ in {$domain}.{$locale}.{$key}",
                    );
                }
            }
        }
    }

    #[Test]
    public function noMessageIsEmpty(): void
    {
        foreach ($this->domains() as $domain) {
            foreach (SupportedLocales::ALL as $locale) {
                foreach ($this->load($domain, $locale) as $key => $message) {
                    self::assertNotSame('', \trim($message), "{$domain}.{$locale}.{$key} is empty");
                }
            }
        }
    }

    /** @return list<string> */
    private function domains(): array
    {
        $domains = [];
        foreach (\glob($this->dir() . '/*.' . SupportedLocales::DEFAULT . '.json') ?: [] as $path) {
            $domains[] = \basename($path, '.' . SupportedLocales::DEFAULT . '.json');
        }

        self::assertNotEmpty($domains, 'No catalogues found at all');

        return $domains;
    }

    /** @return list<string> */
    private function placeholders(string $message): array
    {
        \preg_match_all('/\{\s*([a-zA-Z0-9_]+)\s*[,}]/', $message, $matches);
        $found = \array_unique($matches[1]);
        \sort($found);

        return \array_values($found);
    }

    /** @return array<string, string> */
    private function load(string $domain, string $locale): array
    {
        return \json_decode(
            (string) \file_get_contents($this->path($domain, $locale)),
            true,
            512,
            \JSON_THROW_ON_ERROR,
        );
    }

    private function path(string $domain, string $locale): string
    {
        return $this->dir() . "/{$domain}.{$locale}.json";
    }

    private function dir(): string
    {
        return \dirname(__DIR__, 2) . '/translations';
    }
}
