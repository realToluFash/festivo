<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode;

use App\Audit\Auditor;
use App\Domain\Event\People\EventPeople;
use App\Domain\Staff\Attendance\JoinCodeShift;
use App\Domain\User\Mail\UserMailer;
use App\Entity\DoorCode;
use App\Entity\DoorCodeRedemption;
use App\Entity\EventPerson;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\DoorCodeRedemptionRepository;
use App\Repository\DoorCodeRepository;
use App\Repository\EventPersonRepository;
use App\Repository\MembershipRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Hash;
use Psl\Iter;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Every refusal is the same one, so a live code cannot be found by elimination. */
final readonly class DoorCodeRedeemer
{
    public function __construct(
        private DoorCodeRepository $doorCodeRepository,
        private DoorCodeRedemptionRepository $doorCodeRedemptionRepository,
        private EventPersonRepository $eventPersonRepository,
        private MembershipRepository $membershipRepository,
        private DoorCodes $doorCodes,
        private JoinCodeShift $joinCodeShift,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private UserMailer $userMailer,
        private ClockInterface $clock,
        private RateLimiterFactoryInterface $doorCodeSourceLimiter,
        private RateLimiterFactoryInterface $doorCodeCodeLimiter,
    ) {
    }

    /** The code that would let this reader in: a live or full one (sc-4235: who is typing is known only once the phone code is right), or one they came in by and are still on the event through. */
    public function open(string $typed, ?User $reader, Request $request): DoorCode
    {
        $code = DoorCodeText::normalise($typed);
        $source = $this->doorCodeSourceLimiter->create($request->getClientIp() ?? 'unknown');
        $this->refuseWhenSpent($source);
        $byCode = null === $code ? null : $this->doorCodeCodeLimiter->create(Hash\hash($code, Hash\Algorithm::Sha256));

        if (null !== $byCode) {
            $this->refuseWhenSpent($byCode);
        }

        $doorCode = null === $code ? null : $this->doorCodeRepository->findOneByCode($code);

        if (null !== $doorCode && null !== $reader && null !== $this->doorCodeRedemptionRepository->findOneFor($doorCode, $reader)) {
            if (null !== $this->eventPersonRepository->findLiveOutside($doorCode->getEvent()->getId(), $reader, $this->clock->now())) {
                return $doorCode;
            }

            $doorCode = null;
        }

        if (null === $doorCode || !$this->opens($doorCode)) {
            $this->spendARefusal($code, $request);

            throw new ApiException(ErrorCode::DoorCodeInvalid, $this->translator->trans('door_codes.invalid'));
        }

        return $doorCode;
    }

    /** `member` refuses, `in` lands on You're in again, null joins. */
    public function standingOf(DoorCode $doorCode, ?User $reader): ?string
    {
        if (null === $reader) {
            return null;
        }

        return match (true) {
            null !== $this->membershipRepository->findActive($reader, $doorCode->getEvent()->getOrganisation()->getId()) => 'member',
            null !== $this->eventPersonRepository->findLiveOutside($doorCode->getEvent()->getId(), $reader, $this->clock->now()) => 'in',
            default => null,
        };
    }

    /** @return array{person: EventPerson, again: bool} signed in only (sc-4235): signed out, a door code is redeemed through `DoorCodeSignIn` */
    public function redeem(string $typed, ?User $reader, Request $request): array
    {
        if (null === $reader) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        }

        $doorCode = $this->open($typed, $reader, $request);
        $this->refuseAMember($doorCode, $reader);
        $already = $this->heldBy($doorCode, $reader);

        if (null !== $already) {
            return ['person' => $already, 'again' => true];
        }

        return ['person' => $this->admit($doorCode, $reader, $request), 'again' => false];
    }

    /** The account already on the event, by this code or another way in: it lands on You're in again, takes no use, and signs back in at a full code. */
    public function heldBy(DoorCode $doorCode, User $user): ?EventPerson
    {
        return $this->eventPersonRepository->findLiveOutside($doorCode->getEvent()->getId(), $user, $this->clock->now());
    }

    public function refuseAMember(DoorCode $doorCode, User $user): void
    {
        $organisation = $doorCode->getEvent()->getOrganisation();

        if ('member' === $this->standingOf($doorCode, $user)) {
            throw new ApiException(ErrorCode::AlreadyAMember, $this->translator->trans('door_codes.member', ['{organisation}' => $organisation->getName()]), members: ['organisation' => $organisation->getName()]);
        }
    }

    /** The one refusal, for a code that admits nobody new: what a number with no use of it meets at a full code. */
    public function refuseUnlessLive(DoorCode $doorCode, Request $request): void
    {
        if (!$this->live($doorCode)) {
            $this->spendARefusal($doorCode->getCode(), $request);

            throw new ApiException(ErrorCode::DoorCodeInvalid, $this->translator->trans('door_codes.invalid'));
        }
    }

    /** Takes one use, under the account's own name: a name typed at the door is never kept on an account (sc-4235). A code that names a shift also puts them on it and clocks them in (sc-234). */
    public function admit(DoorCode $doorCode, User $user, Request $request, bool $signedIn = true): EventPerson
    {
        return $this->entityManager->wrapInTransaction(function () use ($doorCode, $user, $request, $signedIn): EventPerson {
            $this->entityManager->refresh($doorCode, LockMode::PESSIMISTIC_WRITE);
            $this->refuseUnlessLive($doorCode, $request);

            $redemption = new DoorCodeRedemption($doorCode, $user, $user->getName());
            $person = EventPerson::outside($doorCode->getEvent(), $user, $doorCode->getRole(), $doorCode->getJobLabel(), $doorCode->getMadeBy());
            $person->setDoorCode($doorCode);
            $this->entityManager->persist($redemption);
            $this->entityManager->persist($person);
            $this->auditor->record('door_code.redeemed', 'EventPerson', $person->getId(), Actor::User, $user->getId(), $user->getName(), [
                ...EventPeople::whose($person),
                'code' => [null, $doorCode->getCode()],
                'role' => [null, $doorCode->getRole()->value],
                'signedIn' => [null, $signedIn],
            ]);
            $this->entityManager->flush();
            $shift = $doorCode->getShift();

            if (null !== $shift) {
                $this->joinCodeShift->place($shift, $user, $doorCode->getMadeBy() ?? $user);
                $this->entityManager->flush();
            }

            return $person;
        });
    }

    public function usedOf(DoorCode $doorCode): int
    {
        return $this->doorCodeRedemptionRepository->countFor($doorCode);
    }

    private function opens(DoorCode $doorCode): bool
    {
        $closes = $doorCode->getEvent()->getClosesAt();

        return Iter\contains([DoorCodeStatus::Working, DoorCodeStatus::Full], $this->doorCodes->statusOf($doorCode, $this->usedOf($doorCode)))
            && (null === $closes || $closes > $this->clock->now());
    }

    private function live(DoorCode $doorCode): bool
    {
        $closes = $doorCode->getEvent()->getClosesAt();

        return DoorCodeStatus::Working === $this->doorCodes->statusOf($doorCode, $this->usedOf($doorCode))
            && (null === $closes || $closes > $this->clock->now());
    }

    /** Only a refused try spends either limit, so a working code is never refused for being busy. */
    private function spendARefusal(?string $code, Request $request): void
    {
        $this->doorCodeSourceLimiter->create($request->getClientIp() ?? 'unknown')->consume();

        if (null !== $code) {
            $this->doorCodeCodeLimiter->create(Hash\hash($code, Hash\Algorithm::Sha256))->consume();
        }
    }

    private function refuseWhenSpent(LimiterInterface $source): void
    {
        $peek = $source->consume(0);

        if ($peek->getRemainingTokens() <= 0) {
            throw $this->tooMany($peek->getRetryAfter());
        }
    }

    public function tooMany(DateTimeImmutable $until): ApiException
    {
        return ApiException::tooManyAttemptsUntil(
            'door_codes.too_many',
            $until,
            fn (DateTimeImmutable $at): string => $this->userMailer->deadlineInUtc($at, $this->userMailer->answeredLocale()),
        );
    }
}
