<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Organisation\Handover\Model\Responsibility;
use App\Domain\Organisation\Handover\Model\ResponsibleField;
use App\Domain\Organisation\Interfaces\ResponsibilityLedgerInterface;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\User;
use Psl\Dict;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Somebody's work before any entity has a responsible-person field: ResponsibleFields is empty until one lands. */
final class ScriptedResponsibilityLedger implements ResponsibilityLedgerInterface
{
    /** @var array<string, array{organisation: string, user: string, responsibility: Responsibility}> */
    private array $held = [];

    public function give(Organisation $organisation, User $user, string $title): Responsibility
    {
        $responsibility = new Responsibility(new ResponsibleField(Event::class, 'lead', 'eventLead', 'name'), Uuid::v7(), $title);
        $this->held[$responsibility->id->toRfc4122()] = [
            'organisation' => $organisation->getId()->toRfc4122(),
            'user' => $user->getId()->toRfc4122(),
            'responsibility' => $responsibility,
        ];

        return $responsibility;
    }

    /** @return list<string> the titles of what the user holds */
    public function titlesHeldBy(Organisation $organisation, User $user): array
    {
        return Vec\map($this->heldBy($organisation, $user), static fn (Responsibility $responsibility): string => $responsibility->title);
    }

    public function heldBy(Organisation $organisation, User $user): array
    {
        return Vec\values(Dict\map(
            Dict\filter($this->held, static fn (array $entry): bool => $entry['organisation'] === $organisation->getId()->toRfc4122() && $entry['user'] === $user->getId()->toRfc4122()),
            static fn (array $entry): Responsibility => $entry['responsibility'],
        ));
    }

    public function move(Responsibility $responsibility, User $to): void
    {
        $this->held[$responsibility->id->toRfc4122()]['user'] = $to->getId()->toRfc4122();
    }
}
