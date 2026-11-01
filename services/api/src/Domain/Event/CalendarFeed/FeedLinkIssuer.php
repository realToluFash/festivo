<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed;

use App\Entity\CalendarFeed;
use App\Entity\Organisation;
use App\Entity\User;
use App\Repository\CalendarFeedRepository;
use Doctrine\DBAL\Connection;
use LogicException;
use Psl\Encoding\Base64;
use Psl\SecureRandom;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/**
 * A person's calendar link (sc-3626). Its token is the HMAC of a 256-bit random seed under the app secret: shown again whenever the panel opens, yet stored only as its SHA-256, and a copy of the database alone cannot rebuild it.
 */
final readonly class FeedLinkIssuer
{
    public const string PATH = '/api/calendar-feeds/';

    public const string SUFFIX = '.ics';

    public function __construct(
        #[SensitiveParameter]
        private string $secret,
        private CalendarFeedRepository $calendarFeedRepository,
        private Connection $connection,
    ) {
    }

    /** Made on first ask; two asks at once agree on one link. */
    public function linkFor(User $user, Organisation $organisation): CalendarFeed
    {
        $existing = $this->calendarFeedRepository->findOneFor($user, $organisation);

        if (null !== $existing) {
            return $existing;
        }

        $seed = self::seed();
        $this->connection->executeStatement(<<<'SQL'
            INSERT INTO calendar_feeds (id, user_id, organisation_id, seed, token_hash, created_at, updated_at)
            VALUES (:id, :user, :organisation, :seed, :hash, NOW(), NOW())
            ON CONFLICT (user_id, organisation_id) DO NOTHING
            SQL, [
            'id' => Uuid::v7()->toRfc4122(),
            'user' => $user->getId()->toRfc4122(),
            'organisation' => $organisation->getId()->toRfc4122(),
            'seed' => $seed,
            'hash' => self::hash($this->token($seed)),
        ]);

        return $this->calendarFeedRepository->findOneFor($user, $organisation) ?? throw new LogicException('The calendar link was neither found nor made.');
    }

    /** The old token stops matching at the flush. */
    public function reset(CalendarFeed $feed): void
    {
        $seed = self::seed();
        $feed->setSeed($seed);
        $feed->setTokenHash(self::hash($this->token($seed)));
    }

    public function pathOf(CalendarFeed $feed): string
    {
        return self::PATH . $this->token($feed->getSeed()) . self::SUFFIX;
    }

    public static function hash(#[SensitiveParameter] string $token): string
    {
        return \hash('sha256', $token);
    }

    private function token(string $seed): string
    {
        return Base64\encode(\hash_hmac('sha256', 'calendar-feed:' . $seed, $this->secret, true), Base64\Variant::UrlSafe, padding: false);
    }

    private static function seed(): string
    {
        return \bin2hex(SecureRandom\bytes(32));
    }
}
