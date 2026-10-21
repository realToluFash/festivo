<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Audit\Auditor;
use App\Domain\Organisation\Handover\Model\Responsibility;
use App\Domain\Organisation\Interfaces\ResponsibilityLedgerInterface;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A departing member's work goes to one person (sc-614), and never to nobody. Every handover is audited. */
final readonly class WorkHandover
{
    public const string HANDED_OVER = 'membership.work_handed_over';
    public const string RECEIVED = 'responsibility.handed_over';

    public function __construct(
        private ResponsibilityLedgerInterface $responsibilityLedger,
        private MembershipRepository $membershipRepository,
        private Auditor $auditor,
        private AfterResponse $afterResponse,
        private HandoverMailer $handoverMailer,
        private TranslatorInterface $translator,
    ) {
    }

    /** @return list<Responsibility> */
    public function heldBy(Membership $membership): array
    {
        return $this->responsibilityLedger->heldBy($membership->getOrganisation(), $membership->getUser());
    }

    /** Another active member of the organisation, named by their membership. */
    public function recipient(Membership $departing, ?string $membershipId): User
    {
        $chosen = null !== $membershipId && Uuid::isValid($membershipId)
            ? $this->membershipRepository->findOneBy(['id' => $membershipId, 'organisation' => $departing->getOrganisation()])
            : null;

        if (null === $chosen || !$chosen->isActive() || $chosen->getId()->equals($departing->getId())) {
            throw ApiException::validation([[
                'propertyPath' => 'handTo',
                'message' => $this->translator->trans('handover.choose_recipient'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        return $chosen->getUser();
    }

    /** @return list<User> the active Owners other than the person leaving, longest-standing first */
    public function owners(Membership $departing): array
    {
        return Vec\map(
            Vec\filter(
                $this->membershipRepository->findActiveIn($departing->getOrganisation()),
                static fn (Membership $membership): bool => $membership->getRole()->isOwner() && !$membership->getId()->equals($departing->getId()),
            ),
            static fn (Membership $membership): User => $membership->getUser(),
        );
    }

    /**
     * Not flushed: it lands with the membership's end. `$toOwners` when the leaver chose nobody, so every Owner hears of it.
     *
     * @param list<Responsibility> $work
     */
    public function hand(Membership $departing, array $work, User $to, User $by, bool $toOwners, ?string $asked): void
    {
        if ([] === $work) {
            return;
        }

        $from = $departing->getUser();
        $organisation = $departing->getOrganisation();
        $responsible = [$from->getId()->toRfc4122(), $to->getId()->toRfc4122()];

        foreach ($work as $responsibility) {
            $this->responsibilityLedger->move($responsibility, $to);
            $this->auditor->record(self::RECEIVED, self::subject($responsibility), $responsibility->id, Actor::User, $by->getId(), $by->getName(), [
                $responsibility->field->property => $responsible,
            ]);
        }

        $this->auditor->record(self::HANDED_OVER, 'Membership', $departing->getId(), Actor::User, $by->getId(), $by->getName(), [
            'responsible' => $responsible,
            'items' => [null, Vec\map($work, static fn (Responsibility $responsibility): array => [
                'kind' => $responsibility->field->kind,
                'subjectType' => self::subject($responsibility),
                'subjectId' => $responsibility->id->toRfc4122(),
                'title' => $responsibility->title,
            ])],
        ]);

        $owners = $toOwners ? $this->owners($departing) : [];
        $this->afterResponse->defer(function () use ($organisation, $from, $to, $work, $owners, $asked, $by): void {
            $this->handoverMailer->sendReceived($organisation, $from, $to, $work, $by->getId()->equals($to->getId()) ? $asked : null);

            foreach ($owners as $owner) {
                if (!$owner->getId()->equals($to->getId())) {
                    $this->handoverMailer->sendToOwner($organisation, $from, $to, $owner, $work);
                }
            }
        });
    }

    private static function subject(Responsibility $responsibility): string
    {
        return Str\after_last($responsibility->field->entity, '\\') ?? $responsibility->field->entity;
    }
}
