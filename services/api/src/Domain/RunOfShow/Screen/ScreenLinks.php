<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Screen;

use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Entity\ScreenLink;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\ScheduleItemRepository;
use App\Repository\ScreenLinkRepository;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Encoding\Base64;
use Psl\Iter;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/**
 * The room screen's links (sc-3897), one for each place of the event's schedule. A token is the HMAC of a 256-bit random seed under the app secret, cut to 128 bits: shown again whenever Show on a screen opens, yet stored only as its SHA-256.
 */
final readonly class ScreenLinks
{
    private const int TOKEN_BYTES = 16;

    public function __construct(
        #[SensitiveParameter]
        private string $secret,
        private ScreenLinkRepository $screenLinkRepository,
        private ScheduleItemRepository $scheduleItemRepository,
        private EntityManagerInterface $entityManager,
        private Connection $connection,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    /**
     * Main first, then each place by its first item; a place's link is made on first ask, and two asks at once agree on one.
     *
     * @return list<ScreenLink>
     */
    public function of(Event $event): array
    {
        $places = $this->placesOf($event);
        $current = $this->screenLinkRepository->findCurrentOn($event);

        foreach ($places as $place) {
            if (!isset($current[$place])) {
                $this->insert($event, $place);
            }
        }

        if (Iter\count($current) < Iter\count($places)) {
            $current = $this->screenLinkRepository->findCurrentOn($event);
        }

        return Vec\filter_nulls(Vec\map($places, static fn (string $place): ?ScreenLink => $current[$place] ?? null));
    }

    /** The old token answers that it was replaced from the flush, and its screen is told to ask again at once. */
    public function replace(Event $event, string $place): void
    {
        if (!Iter\contains($this->placesOf($event), $place)) {
            throw ApiException::notFound('access.not_found');
        }

        $this->entityManager->wrapInTransaction(function () use ($event, $place): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $old = $this->screenLinkRepository->findCurrentOn($event)[$place] ?? null;

            if (null !== $old) {
                $old->setReplacedAt($this->clock->now());
                $this->entityManager->flush();
            }

            $seed = self::seed();
            $this->entityManager->persist(new ScreenLink($event, $place, $seed, self::hash($this->token($seed))));
        });

        $this->realtimePublisher->publish(RealtimeTopic::EventScreens, $event->getId()->toRfc4122(), []);
    }

    public function find(#[SensitiveParameter] string $token): ?ScreenLink
    {
        return '' === $token ? null : $this->screenLinkRepository->findOneByTokenHash(self::hash($token));
    }

    public function tokenOf(ScreenLink $link): string
    {
        return $this->token($link->getSeed());
    }

    /** @return list<string> */
    private function placesOf(Event $event): array
    {
        $items = Vec\sort($this->scheduleItemRepository->findOnEvent($event), static fn (ScheduleItem $a, ScheduleItem $b): int => $a->getStartsAt() <=> $b->getStartsAt());
        $named = Vec\filter(Vec\map($items, static fn (ScheduleItem $item): string => $item->getPlace() ?? ''), static fn (string $place): bool => '' !== $place);

        return ['', ...Vec\values(Dict\unique($named))];
    }

    private function insert(Event $event, string $place): void
    {
        $seed = self::seed();
        $this->connection->executeStatement(<<<'SQL'
            INSERT INTO screen_links (id, event_id, place, seed, token_hash, replaced_at, created_at, updated_at)
            VALUES (:id, :event, :place, :seed, :hash, NULL, NOW(), NOW())
            ON CONFLICT (event_id, place) WHERE replaced_at IS NULL DO NOTHING
            SQL, [
            'id' => Uuid::v7()->toRfc4122(),
            'event' => $event->getId()->toRfc4122(),
            'place' => $place,
            'seed' => $seed,
            'hash' => self::hash($this->token($seed)),
        ]);
    }

    private static function hash(#[SensitiveParameter] string $token): string
    {
        return \hash('sha256', $token);
    }

    private function token(string $seed): string
    {
        return Base64\encode(Str\Byte\slice(\hash_hmac('sha256', 'screen-link:' . $seed, $this->secret, true), 0, self::TOKEN_BYTES), Base64\Variant::UrlSafe, padding: false);
    }

    private static function seed(): string
    {
        return \bin2hex(SecureRandom\bytes(32));
    }
}
