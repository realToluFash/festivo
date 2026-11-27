<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\Audience\GuestConditions;
use App\Domain\Messaging\Audience\SavedAudienceEditor;
use App\Entity\Event;
use App\Entity\GuestGroup;
use App\Entity\SavedAudience;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\GuestGroupRepository;
use App\Repository\SavedAudienceRepository;
use Collator;
use Doctrine\DBAL\Connection;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Who gets it (sc-3957): the live count and See who for a set of conditions, and the event's saved audiences. */
final readonly class AudiencesController
{
    public function __construct(
        private EventRepository $eventRepository,
        private GuestGroupRepository $guestGroupRepository,
        private SavedAudienceRepository $savedAudienceRepository,
        private SavedAudienceEditor $savedAudienceEditor,
        private GuestConditions $guestConditions,
        private Connection $connection,
    ) {
    }

    /** Who matches now, A to Z, each with the ways Soirely can tell them; with no condition, nobody, so it is refused. */
    #[Route('/api/events/{eventId}/messages/audience', name: 'guest_audience_match', methods: ['POST'])]
    #[InEvent(Permission::MessagesManage)]
    public function match(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $conditions = $this->conditions($request, $event);
        [$matching, $parameters] = GuestConditions::where($conditions);
        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT g.id, g.full_name, g.email, g.mobile FROM guests g
                WHERE g.event_id = :event
                  AND g.host_id IS NULL
                  AND g.removed_at IS NULL
                  AND
                SQL . ' ' . $matching,
            [...$parameters, 'event' => $event->getId()->toRfc4122()],
        );
        $collator = new Collator('root');
        $guests = Vec\sort(
            Vec\map($rows, static fn (array $row): array => [
                'id' => Type\string()->coerce($row['id']),
                'name' => Type\nullable(Type\string())->coerce($row['full_name']) ?? '',
                'email' => '' !== (Type\nullable(Type\string())->coerce($row['email']) ?? ''),
                'mobile' => '' !== (Type\nullable(Type\string())->coerce($row['mobile']) ?? ''),
            ]),
            static fn (array $one, array $other): int => (int) $collator->compare($one['name'], $other['name']),
        );

        return new JsonResponse(['count' => Iter\count($guests), 'conditions' => $this->guestConditions->shown($event, $conditions), 'guests' => $guests]);
    }

    #[Route('/api/events/{eventId}/messages/audiences', name: 'saved_audiences_list', methods: ['GET'])]
    #[InEvent(Permission::MessagesManage)]
    public function list(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $collator = new Collator('root');
        $collator->setStrength(Collator::PRIMARY);
        $audiences = Vec\sort($this->savedAudienceRepository->findOnEvent($event), static fn (SavedAudience $one, SavedAudience $other): int => (int) $collator->compare($one->getName(), $other->getName()));

        return new JsonResponse([
            'audiences' => Vec\map($audiences, $this->shown(...)),
            'groups' => Vec\map($this->guestGroupRepository->findOnEvent($event), static fn (GuestGroup $group): array => ['id' => $group->getId()->toRfc4122(), 'name' => $group->getName()]),
        ]);
    }

    #[Route('/api/events/{eventId}/messages/audiences', name: 'saved_audiences_save', methods: ['POST'])]
    #[InEvent(Permission::MessagesManage)]
    public function save(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $name = Input::body($request, Type\shape(['name' => Type\string()], true))['name'];
        $audience = $this->savedAudienceEditor->save($event, $name, $this->conditions($request, $event, false));

        return new JsonResponse(['audience' => $this->shown($audience)], Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}/messages/audiences/{audienceId}', name: 'saved_audiences_rename', methods: ['PATCH'])]
    #[InEvent(Permission::MessagesManage)]
    public function rename(Request $request, #[InThisEvent('audienceId')] SavedAudience $audience): JsonResponse
    {
        $name = Input::body($request, Type\shape(['name' => Type\string()]))['name'];

        return new JsonResponse(['audience' => $this->shown($this->savedAudienceEditor->rename($audience, $name))]);
    }

    #[Route('/api/events/{eventId}/messages/audiences/{audienceId}', name: 'saved_audiences_delete', methods: ['DELETE'])]
    #[InEvent(Permission::MessagesManage)]
    public function delete(#[InThisEvent('audienceId')] SavedAudience $audience): Response
    {
        $this->savedAudienceEditor->delete($audience);

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /** @return array<string, mixed> */
    private function shown(SavedAudience $audience): array
    {
        return [
            'id' => $audience->getId()->toRfc4122(),
            'name' => $audience->getName(),
            'conditions' => $this->guestConditions->shown($audience->getEvent(), $audience->getConditions()),
        ];
    }

    /** @return list<array{type: string, groupId?: ?string}> */
    private function conditions(Request $request, Event $event, bool $required = true): array
    {
        $raw = Input::body($request, Type\shape(['conditions' => Type\mixed()], true))['conditions'];
        $conditions = $this->guestConditions->read($event, $raw);

        if ($required && [] === $conditions) {
            throw ApiException::validation([['propertyPath' => 'conditions', 'message' => 'validation.guest_message_conditions_required', 'code' => 'conditions_required']]);
        }

        return $conditions;
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }
}
