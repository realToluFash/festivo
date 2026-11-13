<?php

declare(strict_types=1);

namespace App\Domain\Event\Cover;

use App\Audit\Auditor;
use App\Domain\Event\Cover\Exception\CoverPhotoRefused;
use App\Entity\Event;
use App\Entity\EventCover;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventAction;
use App\Enum\EventPhase;
use App\Enum\UploadPurpose;
use App\Http\Exception\ApiException;
use App\Repository\EventCoverRepository;
use App\Storage\Model\SignedUpload;
use App\Storage\ObjectStore;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Encoding\Base64;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Sets and removes an event's cover photo (sc-3590). The original upload is read once, re-encoded, and deleted. */
final readonly class EventCoverEditor
{
    public const string CHANGED = 'event.cover_changed';
    public const string REMOVED = 'event.cover_removed';

    public function __construct(
        private ObjectStore $objectStore,
        private CoverPhotoProcessor $coverPhotoProcessor,
        private EventCoverRepository $eventCoverRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** Refuses, before anything is uploaded, a type or a size the cover does not take; the dimensions are checked once it has arrived. */
    public function signUpload(Organisation $organisation, string $contentType, int $size, string $filename): SignedUpload
    {
        if (!UploadPurpose::EventCover->allows($contentType)) {
            throw $this->refusal(CoverPhotoRefused::type());
        }

        if ($size > UploadPurpose::EventCover->maxBytes()) {
            throw $this->refusal(CoverPhotoRefused::size());
        }

        return $this->objectStore->signUpload(UploadPurpose::EventCover, $contentType, $filename, $organisation->getId()->toRfc4122());
    }

    /** A new photo when `uploadKey` names one, otherwise the saved photo with a new position and description. */
    public function set(Event $event, User $by, ?string $uploadKey, int $position, ?string $description): EventCover
    {
        $this->allowEdit($event);
        $description = self::description($description);
        $violations = [];

        if ($position < 0 || $position > 100) {
            $violations[] = $this->violation('position', 'validation.cover_position_invalid');
        }

        if (null !== $description && Str\length($description) > EventCover::DESCRIPTION_MAXIMUM) {
            $violations[] = $this->violation('description', 'validation.cover_description_too_long', ['{count}' => (string) EventCover::DESCRIPTION_MAXIMUM]);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        $cover = $this->eventCoverRepository->findOneForEvent($event);
        $before = self::recorded($cover);
        $replaced = $cover?->getPhotoKey();

        if (null !== $uploadKey) {
            $photoKey = $this->publish($event, $uploadKey);
            $cover ??= new EventCover($event, $photoKey, $position, $description);
            $cover->setPhotoKey($photoKey);
            $this->entityManager->persist($cover);
        } else {
            $replaced = null;
        }

        if (null === $cover) {
            throw ApiException::validation([$this->violation('uploadKey', 'validation.cover_photo_required')]);
        }

        $cover->setPosition($position);
        $cover->setDescription($description);

        $changes = Auditor::diff($before, self::recorded($cover));

        if ([] !== $changes) {
            $this->auditor->record(self::CHANGED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
        }

        $this->entityManager->flush();

        if (null !== $replaced) {
            $this->unpublish($replaced);
        }

        return $cover;
    }

    /** The event's type's default is back; the stored photo is deleted. Nothing to remove is not an error. */
    public function remove(Event $event, User $by): void
    {
        $this->allowEdit($event);
        $cover = $this->eventCoverRepository->findOneForEvent($event);

        if (null === $cover) {
            return;
        }

        $this->auditor->record(self::REMOVED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::recorded($cover), self::recorded(null)));
        $this->entityManager->remove($cover);
        $this->entityManager->flush();

        $this->unpublish($cover->getPhotoKey());
    }

    /** Under a key of the copy's own, so a later change to either cover, or a purge of either event, never reaches the other (sc-3593). */
    public function copy(Event $from, Event $to): ?EventCover
    {
        $cover = $this->eventCoverRepository->findOneForEvent($from);

        if (null === $cover) {
            return null;
        }

        $photoKey = self::photoKey($to);

        foreach (Vec\keys(CoverPhotoProcessor::SIZES) as $size) {
            $this->objectStore->copyPublished(self::sizeKey($cover->getPhotoKey(), $size), self::sizeKey($photoKey, $size));
        }

        $copy = new EventCover($to, $photoKey, $cover->getPosition(), $cover->getDescription());
        $this->entityManager->persist($copy);

        return $copy;
    }

    /** A photo chosen and then cancelled, so the original, with its metadata, is not kept. */
    public function discard(Organisation $organisation, string $uploadKey): void
    {
        if (!$this->ours($organisation, $uploadKey)) {
            throw ApiException::validation([$this->violation('uploadKey', 'validation.cover_upload_missing')]);
        }

        $this->objectStore->deleteUpload(UploadPurpose::EventCover, $uploadKey);
    }

    /** Answered rather than stored, so there is no copy of the photo to keep private, delete or expire (sc-13861). */
    public function preview(Organisation $organisation, string $uploadKey): string
    {
        $webp = $this->readUpload($organisation, $uploadKey, $this->coverPhotoProcessor->preview(...));

        return 'data:image/webp;base64,' . Base64\encode($webp);
    }

    public function unpublish(string $photoKey): void
    {
        foreach (Vec\keys(CoverPhotoProcessor::SIZES) as $size) {
            $this->objectStore->unpublish(self::sizeKey($photoKey, $size));
        }
    }

    public static function sizeKey(string $photoKey, string $size): string
    {
        return Str\format('%s/%s.webp', $photoKey, $size);
    }

    private function publish(Event $event, string $uploadKey): string
    {
        $sizes = $this->readUpload($event->getOrganisation(), $uploadKey, $this->coverPhotoProcessor->process(...));
        $photoKey = self::photoKey($event);

        foreach ($sizes as $size => $webp) {
            $this->objectStore->publish(self::sizeKey($photoKey, $size), $webp, 'image/webp');
        }

        $this->objectStore->deleteUpload(UploadPurpose::EventCover, $uploadKey);

        return $photoKey;
    }

    private static function photoKey(Event $event): string
    {
        return Str\format('event_cover/%s/%s', $event->getId()->toRfc4122(), Uuid::v7()->toRfc4122());
    }

    /**
     * @template T
     *
     * @param callable(string): T $read
     *
     * @return T
     */
    private function readUpload(Organisation $organisation, string $uploadKey, callable $read): mixed
    {
        $size = $this->ours($organisation, $uploadKey) ? $this->objectStore->uploadSize(UploadPurpose::EventCover, $uploadKey) : null;

        if (null === $size) {
            throw ApiException::validation([$this->violation('uploadKey', 'validation.cover_upload_missing')]);
        }

        try {
            if ($size > UploadPurpose::EventCover->maxBytes()) {
                throw CoverPhotoRefused::size();
            }

            return $read($this->objectStore->readUpload(UploadPurpose::EventCover, $uploadKey));
        } catch (CoverPhotoRefused $refused) {
            $this->objectStore->deleteUpload(UploadPurpose::EventCover, $uploadKey);

            throw $this->refusal($refused);
        }
    }

    /** The cover is an `edit` field, refused as a rename is in a phase that allows no `edit`. */
    private function allowEdit(Event $event): void
    {
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now());

        if (!$phase->allows(EventAction::Edit)) {
            throw new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans('event.state_invalid'), members: ['phase' => $phase->value]);
        }
    }

    private function ours(Organisation $organisation, string $uploadKey): bool
    {
        return Regex\matches($uploadKey, '#^' . UploadPurpose::EventCover->value . '/' . $organisation->getId()->toRfc4122() . '/\d{4}/\d{2}/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$#');
    }

    private function refusal(CoverPhotoRefused $refused): ApiException
    {
        $key = match ($refused->reason) {
            'type' => 'validation.cover_type',
            'size' => 'validation.cover_size',
            'dimensions' => 'validation.cover_dimensions',
        };

        return ApiException::validation([$this->violation('file', $key)]);
    }

    private static function description(?string $description): ?string
    {
        $description = null === $description ? '' : Str\trim($description);

        return '' === $description ? null : $description;
    }

    /** @return array{photo: ?string, position: ?int, description: ?string} */
    public static function recorded(?EventCover $cover): array
    {
        return [
            'photo' => $cover?->getPhotoKey(),
            'position' => $cover?->getPosition(),
            'description' => $cover?->getDescription(),
        ];
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
