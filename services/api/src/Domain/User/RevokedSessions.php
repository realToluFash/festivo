<?php

declare(strict_types=1);

namespace App\Domain\User;

use Psl\Type;
use Psr\Log\LoggerInterface;
use Redis;
use RedisException;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;

/** Sessions ended within an access token's lifetime, so a token still in somebody's hand stops at once (sc-117). */
final readonly class RevokedSessions
{
    public const string UNREACHABLE = 'The revoked-session list is unreachable; ended sessions last until their access tokens expire';

    private const string KEY_PREFIX = 'revoked_session:';

    public function __construct(
        private Redis $redis,
        private LoggerInterface $logger,
        #[Autowire(param: 'lexik_jwt_authentication.token_ttl')]
        private int $accessTokenTtl,
    ) {
    }

    /** Each entry outlives every access token issued for its session, then goes by itself. */
    public function add(Uuid ...$sessions): void
    {
        try {
            foreach ($sessions as $session) {
                $this->redis->set(self::key($session), '1', ['ex' => $this->accessTokenTtl]);
            }
        } catch (RedisException $exception) {
            $this->unreachable($exception);
        }
    }

    /** Fails open: refusing everybody at once is worse than the fifteen minutes (sc-117, Decided 16 Oct). */
    public function includes(Uuid $session): bool
    {
        try {
            return Type\int()->coerce($this->redis->exists(self::key($session))) > 0;
        } catch (RedisException $exception) {
            $this->unreachable($exception);

            return false;
        }
    }

    private function unreachable(RedisException $exception): void
    {
        $this->logger->critical(self::UNREACHABLE, ['exception' => $exception]);
    }

    private static function key(Uuid $session): string
    {
        return self::KEY_PREFIX . $session->toRfc4122();
    }
}
