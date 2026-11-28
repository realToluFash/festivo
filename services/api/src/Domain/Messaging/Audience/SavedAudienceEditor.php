<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Audience;

use App\Entity\Event;
use App\Entity\SavedAudience;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use App\Repository\SavedAudienceRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;

/** An event's saved audiences (sc-3957), under the event's lock so two hosts cannot both save the twentieth or one name twice; a name has a group name's rules (sc-3775). */
final readonly class SavedAudienceEditor
{
    public function __construct(
        private SavedAudienceRepository $savedAudienceRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** @param list<array{type: string, groupId?: ?string}> $conditions */
    public function save(Event $event, string $typed, array $conditions): SavedAudience
    {
        if ([] === $conditions) {
            throw ApiException::validation([self::violation('conditions', 'validation.guest_message_conditions_required', 'conditions_required')]);
        }

        return $this->entityManager->wrapInTransaction(function () use ($event, $typed, $conditions): SavedAudience {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $name = self::checked($typed);
            $this->refuseTaken($event, $name, null);

            if (Iter\count($this->savedAudienceRepository->findOnEvent($event)) >= SavedAudience::MOST_PER_EVENT) {
                throw new ApiException(ErrorCode::AudiencesFull, 'saved_audience.full', parameters: ['{most}' => SavedAudience::MOST_PER_EVENT]);
            }

            $audience = new SavedAudience($event, $name, NameNormaliser::labelKey($name), $conditions);
            $this->entityManager->persist($audience);
            $this->entityManager->flush();

            return $audience;
        });
    }

    /** A name is used only when another saved audience has it, so changing only its case or accents is saved. */
    public function rename(SavedAudience $audience, string $typed): SavedAudience
    {
        $event = $audience->getEvent();

        return $this->entityManager->wrapInTransaction(function () use ($audience, $event, $typed): SavedAudience {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $name = self::checked($typed);
            $this->refuseTaken($event, $name, $audience);
            $audience->rename($name, NameNormaliser::labelKey($name));
            $this->entityManager->flush();

            return $audience;
        });
    }

    /** No message changes: each holds its own copy of the conditions. */
    public function delete(SavedAudience $audience): void
    {
        $this->entityManager->remove($audience);
        $this->entityManager->flush();
    }

    private static function checked(string $typed): string
    {
        $name = NameNormaliser::name($typed);

        if ('' === $name) {
            throw ApiException::validation([self::violation('name', 'validation.saved_audience_name_required', 'audience_name_required')]);
        }

        if (VisibleText::tooLong($name, SavedAudience::NAME_MAXIMUM)) {
            throw ApiException::validation([self::violation('name', 'validation.saved_audience_name_too_long', 'audience_name_too_long')]);
        }

        return $name;
    }

    private function refuseTaken(Event $event, string $name, ?SavedAudience $renaming): void
    {
        $found = $this->savedAudienceRepository->findOneNamed($event, NameNormaliser::labelKey($name));

        if (null !== $found && $found !== $renaming) {
            throw new ApiException(ErrorCode::AudienceNameTaken, 'saved_audience.name_taken', parameters: ['{name}' => $found->getName()]);
        }
    }

    /** @return array{propertyPath: string, message: string, code: string, parameters: array<string, int|string>} */
    private static function violation(string $path, string $key, string $code): array
    {
        return ['propertyPath' => $path, 'message' => $key, 'code' => $code, 'parameters' => ['{max}' => SavedAudience::NAME_MAXIMUM]];
    }
}
