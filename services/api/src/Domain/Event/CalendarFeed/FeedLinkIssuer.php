<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed;

use App\Entity\CalendarFeed;
use App\Entity\Organisation;
use App\Entity\User;
use App\Http\LinkTokens;
use App\Repository\CalendarFeedRepository;
use Doctrine\DBAL\Connection;
use LogicException;
use Symfony\Component\Uid\Uuid;

/**
 * A person's calendar link (sc-3626), its token made by LinkTokens.
 */
final readonly class FeedLinkIssuer
{
    public const string PATH = '/api/calendar-feeds/';

    public const string SUFFIX = '.ics';

    private const string PURPOSE = 'calendar-feed';

    public function __construct(
        private LinkTokens $linkTokens,
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

        $seed = LinkTokens::seed();
        $this->connection->executeStatement(<<<'SQL'
            INSERT INTO calendar_feeds (id, user_id, organisation_id, seed, token_hash, created_at, updated_at)
            VALUES (:id, :user, :organisation, :seed, :hash, NOW(), NOW())
            ON CONFLICT (user_id, organisation_id) DO NOTHING
            SQL, [
            'id' => Uuid::v7()->toRfc4122(),
            'user' => $user->getId()->toRfc4122(),
            'organisation' => $organisation->getId()->toRfc4122(),
            'seed' => $seed,
            'hash' => LinkTokens::hash($this->token($seed)),
        ]);

        return $this->calendarFeedRepository->findOneFor($user, $organisation) ?? throw new LogicException('The calendar link was neither found nor made.');
    }

    /** The old token stops matching at the flush. */
    public function reset(CalendarFeed $feed): void
    {
        $seed = LinkTokens::seed();
        $feed->reissue($seed, LinkTokens::hash($this->token($seed)));
    }

    public function pathOf(CalendarFeed $feed): string
    {
        return self::PATH . $this->token($feed->getSeed()) . self::SUFFIX;
    }

    private function token(string $seed): string
    {
        return $this->linkTokens->token(self::PURPOSE, $seed);
    }
}
