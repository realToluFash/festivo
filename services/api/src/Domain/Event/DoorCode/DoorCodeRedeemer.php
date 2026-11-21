<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode;

use App\Audit\Auditor;
use App\Domain\Event\People\EventPeople;
use App\Domain\User\AccountName;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Domain\User\TokenIssuer;
use App\Entity\DoorCode;
use App\Entity\DoorCodeRedemption;
use App\Entity\EventPerson;
use App\Entity\User;
use App\Enum\AccountOrigin;
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
use Psl\Str;
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
        private AccountName $accountName,
        private TokenIssuer $tokenIssuer,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
        private RateLimiterFactoryInterface $doorCodeSourceLimiter,
        private RateLimiterFactoryInterface $doorCodeCodeLimiter,
    ) {
    }

    /** The code that would let this reader in: a live one, or one they came in by and are still on the event through. */
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

        if (null === $doorCode || !$this->live($doorCode)) {
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

    /** @return array{user: User, person: EventPerson, tokens: ?IssuedTokens, again: bool} */
    public function redeem(string $typed, ?string $name, ?User $reader, Request $request): array
    {
        $doorCode = $this->open($typed, $reader, $request);
        $organisation = $doorCode->getEvent()->getOrganisation();

        if ('member' === $this->standingOf($doorCode, $reader)) {
            throw new ApiException(ErrorCode::AlreadyAMember, $this->translator->trans('door_codes.member', ['{organisation}' => $organisation->getName()]), members: ['organisation' => $organisation->getName()]);
        }

        $already = null === $reader ? null : $this->eventPersonRepository->findLiveOutside($doorCode->getEvent()->getId(), $reader, $this->clock->now());

        if (null !== $already && null !== $reader) {
            return ['user' => $reader, 'person' => $already, 'tokens' => null, 'again' => true];
        }

        $given = Str\trim($name ?? '');

        if (null === $reader) {
            $violations = $this->accountName->violations($given);

            if ([] !== $violations) {
                throw ApiException::validation($violations);
            }
        }

        return $this->entityManager->wrapInTransaction(function () use ($doorCode, $reader, $given, $request): array {
            $this->entityManager->refresh($doorCode, LockMode::PESSIMISTIC_WRITE);

            if (!$this->live($doorCode)) {
                $this->spendARefusal($doorCode->getCode(), $request);

                throw new ApiException(ErrorCode::DoorCodeInvalid, $this->translator->trans('door_codes.invalid'));
            }

            $user = $reader ?? $this->deviceAccount($given, $request);
            $redemption = new DoorCodeRedemption($doorCode, $user, $reader?->getName() ?? $given);
            $person = EventPerson::outside($doorCode->getEvent(), $user, $doorCode->getRole(), $doorCode->getJobLabel(), $doorCode->getMadeBy());
            $person->setDoorCode($doorCode);
            $this->entityManager->persist($redemption);
            $this->entityManager->persist($person);
            $this->auditor->record('door_code.redeemed', 'EventPerson', $person->getId(), Actor::User, $user->getId(), $user->getName(), [
                ...EventPeople::whose($person),
                'code' => [null, $doorCode->getCode()],
                'role' => [null, $doorCode->getRole()->value],
                'signedIn' => [null, null !== $reader],
            ]);
            $tokens = null === $reader ? $this->tokenIssuer->issueFor($user, $request) : null;
            $this->entityManager->flush();

            return ['user' => $user, 'person' => $person, 'tokens' => $tokens, 'again' => false];
        });
    }

    public function usedOf(DoorCode $doorCode): int
    {
        return $this->doorCodeRedemptionRepository->countFor($doorCode);
    }

    private function live(DoorCode $doorCode): bool
    {
        $closes = $doorCode->getEvent()->getClosesAt();

        return DoorCodeStatus::Working === $this->doorCodes->statusOf($doorCode, $this->usedOf($doorCode))
            && (null === $closes || $closes > $this->clock->now());
    }

    private function deviceAccount(string $name, Request $request): User
    {
        $user = new User($name, null, AccountOrigin::DoorCode);
        $user->markDetailsSaved();
        AccountLanguage::rememberIfNone($user, $request);
        AccountTimeZone::rememberIfNone($user, $request);
        $this->entityManager->persist($user);

        return $user;
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

    private function tooMany(DateTimeImmutable $until): ApiException
    {
        return ApiException::tooManyAttemptsUntil('door_codes.too_many', $until, static fn (DateTimeImmutable $at): string => $at->format(\DATE_ATOM));
    }
}
