<?php

declare(strict_types=1);

namespace App\Integrations\Hibp;

use App\Domain\User\Interfaces\BreachedPasswordCheckerInterface;
use Psl\Str;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface as HttpException;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Have I Been Pwned's range API, which is queried without sending the password
 * or its full hash anywhere.
 *
 * The password is hashed with SHA-1 — their corpus is keyed that way, and this
 * is not a password hash, it is a lookup key — and only the first five
 * characters of the hash are sent. The response is every suffix sharing that
 * prefix, several hundred of them, and the match happens here. So the service
 * learns that somebody asked about one of 500-odd passwords and nothing more.
 */
final readonly class HibpBreachedPasswordChecker implements BreachedPasswordCheckerInterface
{
    private const PREFIX_LENGTH = 5;

    public function __construct(
        private HttpClientInterface $http,
        private LoggerInterface $logger,
        #[Autowire('%env(bool:PASSWORD_BREACH_CHECK_ENABLED)%')]
        private bool $enabled = true,
        private string $endpoint = 'https://api.pwnedpasswords.com/range/',
    ) {
    }

    public function isBreached(#[SensitiveParameter] string $password): bool
    {
        if (!$this->enabled) {
            return false;
        }

        $hash = Str\uppercase(\sha1($password));
        $prefix = Str\slice($hash, 0, self::PREFIX_LENGTH);
        $suffix = Str\slice($hash, self::PREFIX_LENGTH);

        try {
            $body = $this->http->request('GET', $this->endpoint . $prefix, [
                // Their documented opt-in: the response then contains padding
                // entries, so its length does not reveal how many real matches
                // the prefix has.
                'headers' => ['Add-Padding' => 'true', 'User-Agent' => 'Soirely (+https://soirely.com)'],
                'timeout' => 3,
            ])->getContent();
        } catch (HttpException $e) {
            // Fail open, loudly. See the interface.
            $this->logger->warning('Breach corpus unreachable; password accepted unchecked', [
                'exception' => $e,
            ]);

            return false;
        }

        foreach (Str\split($body, "\n") as $line) {
            [$candidate, $count] = \array_pad(Str\split(Str\trim($line), ':'), 2, '0');

            // A padding entry is a real suffix with a count of zero. Treating it
            // as a match would reject arbitrary passwords at random.
            if ($candidate === $suffix && '0' !== Str\trim($count)) {
                return true;
            }
        }

        return false;
    }
}
