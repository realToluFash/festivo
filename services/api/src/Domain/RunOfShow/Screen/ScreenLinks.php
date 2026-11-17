<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Screen;

use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Entity\ScreenLink;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Http\LinkTokens;
use App\Realtime\RealtimePublisher;
use App\Repository\ScheduleItemRepository;
use App\Repository\ScreenLinkRepository;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/**
 * The room screen's links (sc-3897), one for each place of the event's schedule, each token made by LinkTokens and cut to 128 bits.
 */
final readonly class ScreenLinks
{
    private const string PURPOSE = 'screen-link';

    private const int TOKEN_BYTES = 16;

    public function __construct(
        private LinkTokens $linkTokens,
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

        $missing = Vec\filter($places, static fn (string $place): bool => !isset($current[$place]));

        foreach ($missing as $place) {
            $this->insert($event, $place);
        }

        if ([] !== $missing) {
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

            $seed = LinkTokens::seed();
            $this->entityManager->persist(new ScreenLink($event, $place, $seed, LinkTokens::hash($this->token($seed))));
        });

        $this->realtimePublisher->publish(RealtimeTopic::EventScreens, $event->getId()->toRfc4122(), []);
    }

    public function find(#[SensitiveParameter] string $token): ?ScreenLink
    {
        return '' === $token ? null : $this->screenLinkRepository->findOneByTokenHash(LinkTokens::hash($token));
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
        $seed = LinkTokens::seed();
        $this->connection->executeStatement(<<<'SQL'
            INSERT INTO screen_links (id, event_id, place, seed, token_hash, replaced_at, created_at, updated_at)
            VALUES (:id, :event, :place, :seed, :hash, NULL, NOW(), NOW())
            ON CONFLICT (event_id, place) WHERE replaced_at IS NULL DO NOTHING
            SQL, [
            'id' => Uuid::v7()->toRfc4122(),
            'event' => $event->getId()->toRfc4122(),
            'place' => $place,
            'seed' => $seed,
            'hash' => LinkTokens::hash($this->token($seed)),
        ]);
    }

    private function token(string $seed): string
    {
        return $this->linkTokens->token(self::PURPOSE, $seed, self::TOKEN_BYTES);
    }
}
