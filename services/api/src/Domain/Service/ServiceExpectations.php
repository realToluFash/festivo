<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Service\Model\Expected;
use App\Entity\Event;
use App\Entity\ServiceItem;
use App\Entity\ServicePlate;
use App\Entity\ServiceTray;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\ItemState;
use App\Http\Exception\ApiException;
use App\Repository\ServicePlateRepository;
use App\Repository\ServiceTrayRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** A write whose plates or item are no longer as its tap saw them is refused with a 409 naming each one as it is now, even where the step would be allowed from there (sc-4028). */
final readonly class ServiceExpectations
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ServicePlateRepository $servicePlateRepository,
        private ServiceTrayRepository $serviceTrayRepository,
        private UserRepository $userRepository,
    ) {
    }

    /** @param list<ServicePlate> $plates the plates the step acts on as they stand; on a tray's step, every plate on it */
    public function plates(Event $event, Expected $expected, array $plates, ?ServiceTray $tray = null): void
    {
        $saw = $expected->plates ?? throw self::missing();
        $now = Dict\from_entries(Vec\map($plates, static fn (ServicePlate $plate): array => [$plate->getId()->toRfc4122(), $plate]));

        foreach (Vec\keys($saw) as $id) {
            if (!isset($now[$id]) && null !== ($plate = $this->servicePlateRepository->findOneInEvent($event, $id))) {
                $now[$id] = $plate;
            }
        }

        $changed = [];

        foreach ($now as $id => $plate) {
            $stage = $saw[$id] ?? null;
            $onTray = null === $tray ? null !== $plate->getTray() : $plate->getTray() === $tray;

            if ($stage !== $plate->getStage() || (null !== $tray && !$onTray)) {
                $changed[] = [
                    'plateId' => $id,
                    'guestId' => $plate->getGuest()->getId()->toRfc4122(),
                    'table' => $plate->getTableKey(),
                    'stage' => $plate->getStage()->value,
                    'onTray' => $onTray,
                    'by' => $this->lastBy($plate),
                ];
            }
        }

        if ([] !== $changed) {
            throw self::changed($changed);
        }
    }

    public function item(Expected $expected, ?ServiceItem $item, string $itemKey): void
    {
        $saw = $expected->item ?? throw self::missing();
        $state = $item?->getState() ?? ItemState::Ready;

        if ($saw !== $state) {
            throw self::changed([['item' => $itemKey, 'state' => $state->value, 'by' => $item?->getChangedBy()?->getName()]]);
        }
    }

    /** An undo sees the plates, the tray's plates or the item its step left behind. */
    public function undoing(Event $event, string $subject, Expected $expected): void
    {
        $tray = $this->serviceTrayRepository->findOneInEvent($event, $subject);

        if (null !== $tray) {
            $this->plates($event, $expected, $this->servicePlateRepository->findOnTray($tray), $tray);

            return;
        }

        $item = Uuid::isValid($subject) ? $this->entityManager->find(ServiceItem::class, Uuid::fromString($subject)) : null;

        if ($item instanceof ServiceItem && $item->getCourse()->getEvent() === $event) {
            $this->item($expected, $item, $item->getItemKey());

            return;
        }

        $plate = $this->servicePlateRepository->findOneInEvent($event, $subject);
        $this->plates($event, $expected, null === $plate ? [] : [$plate]);
    }

    private function lastBy(ServicePlate $plate): ?string
    {
        $steps = $plate->getSteps();
        $last = Iter\last($steps);

        if (null === $last) {
            return null;
        }

        $user = $this->userRepository->find($last['by']);

        return $user instanceof User ? $user->getName() : null;
    }

    /** @param list<array<string, mixed>> $changed */
    private static function changed(array $changed): ApiException
    {
        return new ApiException(ErrorCode::ServiceChanged, 'service.changed', members: ['changed' => $changed]);
    }

    private static function missing(): ApiException
    {
        return new ApiException(ErrorCode::ExpectedRequired, 'service.expected_required');
    }
}
