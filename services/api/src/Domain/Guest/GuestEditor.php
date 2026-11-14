<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Audit\Auditor;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Guest\Model\NewGuest;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** The audit names the fields changed and holds none of their values: no name or contact may outlive the purge (sc-1468). */
final readonly class GuestEditor
{
    public const string UPDATED = 'guest.updated';

    public function __construct(
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private GuestNeedsRecord $guestNeedsRecord,
        private GuestRules $guestRules,
    ) {
    }

    /** @param list<?string> $companionIds beside `$new->companions`: the companion each place keeps, null for one added; one left out is removed */
    public function edit(Guest $guest, ?string $ifMatch, NewGuest $new, array $companionIds, User $by, bool $allowDuplicate): Guest
    {
        if (null === $ifMatch || '*' === Str\trim($ifMatch)) {
            throw new ApiException(ErrorCode::PreconditionRequired, 'guest.version_required');
        }

        $event = $guest->getEvent();
        $changed = $this->entityManager->wrapInTransaction(function () use ($guest, $event, $ifMatch, $new, $companionIds, $by, $allowDuplicate): bool {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $this->entityManager->refresh($guest);

            if (!EntityTag::matches($ifMatch, EntityTag::of($guest->getVersion()))) {
                throw new ApiException(ErrorCode::PreconditionFailed, 'guest.changed_since');
            }

            $companions = $this->guestRepository->findCompanionsOf($guest);
            $kept = $this->kept($companions, $companionIds);
            $fields = self::changed($guest, $companions, $new, $companionIds);
            $needsBefore = $this->guestNeedsRecord->of([$guest, ...$companions]);
            $needsChanged = self::needsChanged($needsBefore, $guest, $new, $companionIds);

            if ([] === $fields && !$needsChanged) {
                return false;
            }

            $renamed = $new->nameKey !== $guest->getNameKey();

            if ($renamed && !$allowDuplicate && null !== $this->guestRepository->findOneNamed($event, $new->nameKey, $guest)) {
                throw new ApiException(ErrorCode::GuestAlreadyListed, 'guest.already_listed', parameters: ['{name}' => $new->fullName]);
            }

            $guest->setFullName($new->fullName, $new->nameKey);
            $guest->setEmail($new->email);
            $guest->setMobile($new->mobile);
            $guest->setLanguage($new->language);
            $guest->raiseVersion();

            foreach ($companions as $companion) {
                if (!Iter\contains_key($kept, $companion->getId()->toRfc4122())) {
                    $this->entityManager->remove($companion);
                }
            }

            if (null !== $new->needs) {
                $this->guestNeedsRecord->write($guest, $new->needs, $by);
            }

            foreach ($new->companions as $index => $name) {
                $id = $companionIds[$index] ?? null;
                $nameKey = null === $name ? null : NameNormaliser::key($name);
                $needs = $new->companionNeeds[$index] ?? null;

                if (null === $id) {
                    $companion = Guest::companionOf($guest, $name, $nameKey, $index + 1, $by);
                    $this->entityManager->persist($companion);
                    $this->guestNeedsRecord->write($companion, $needs ?? GuestNeeds::none(), $by);
                    continue;
                }

                $companion = $kept[$id];
                $companion->setFullName($name, $nameKey);
                $companion->setPosition($index + 1);

                if (null !== $needs) {
                    $this->guestNeedsRecord->write($companion, $needs, $by);
                }
            }

            if ([] !== $fields) {
                $this->auditor->record(
                    self::UPDATED,
                    'Guest',
                    $guest->getId(),
                    Actor::User,
                    $by->getId(),
                    $by->getName(),
                    Dict\from_keys($fields, static fn (string $_): array => [null, null]),
                );
            }

            $this->entityManager->flush();

            return true;
        });

        if ($changed) {
            $this->guestListPublisher->publish($event);
        }

        return $guest;
    }

    /**
     * @param list<Guest>   $companions
     * @param list<?string> $ids
     *
     * @return array<string, Guest>
     */
    private function kept(array $companions, array $ids): array
    {
        $theirs = Dict\from_entries(Vec\map($companions, static fn (Guest $companion): array => [$companion->getId()->toRfc4122(), $companion]));
        $kept = [];
        $violations = [];

        foreach ($ids as $index => $id) {
            if (null === $id) {
                continue;
            }

            if (!Iter\contains_key($theirs, $id) || Iter\contains_key($kept, $id)) {
                $violations[] = $this->guestRules->violation("companions[{$index}].id", 'validation.guest_companion_unknown');
                continue;
            }

            $kept[$id] = $theirs[$id];
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return $kept;
    }

    /**
     * @param array<string, GuestNeeds> $before by the person's id
     * @param list<?string>             $ids
     */
    private static function needsChanged(array $before, Guest $guest, NewGuest $new, array $ids): bool
    {
        $differs = static fn (?string $id, ?GuestNeeds $needs): bool => null === $id
            ? null !== $needs && !$needs->equals(GuestNeeds::none())
            : null !== $needs && !($before[$id] ?? GuestNeeds::none())->equals($needs);

        return $differs($guest->getId()->toRfc4122(), $new->needs)
            || Iter\any(Vec\keys($new->companions), static fn (int $index): bool => $differs($ids[$index] ?? null, $new->companionNeeds[$index] ?? null));
    }

    /**
     * @param list<Guest>   $companions
     * @param list<?string> $ids
     *
     * @return list<string>
     */
    private static function changed(Guest $guest, array $companions, NewGuest $new, array $ids): array
    {
        $before = Vec\map($companions, static fn (Guest $companion): array => [$companion->getId()->toRfc4122(), $companion->getFullName()]);
        $after = Vec\map(Vec\keys($new->companions), static fn (int $index): array => [$ids[$index] ?? null, $new->companions[$index]]);

        return Vec\keys(Dict\filter([
            'fullName' => $guest->getFullName() !== $new->fullName,
            'email' => $guest->getEmail() !== $new->email,
            'mobile' => $guest->getMobile() !== $new->mobile,
            'language' => $guest->getLanguage() !== $new->language,
            'companions' => $before !== $after,
        ]));
    }
}
