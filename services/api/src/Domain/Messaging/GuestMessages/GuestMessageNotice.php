<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Entity\Guest;
use App\Entity\GuestMessage;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use App\Repository\GuestMessageRepository;
use App\Repository\GuestRepository;
use DateTimeImmutable;
use LogicException;
use Psl\Str;
use Psl\Type;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Soirely's notice that the hosts have written, with the guest's own link (sc-3942): never the Subject or the Message, which go only on the guest's page. */
final readonly class GuestMessageNotice implements NotificationTypeInterface
{
    public const string NAME = 'guests.host_message';

    public function __construct(
        private GuestMessageRepository $guestMessageRepository,
        private GuestRepository $guestRepository,
        private TranslatorInterface $translator,
        private GuestEmailUnsubscribe $guestEmailUnsubscribe,
        #[Autowire(env: 'CORS_WEB_ORIGIN')]
        private string $webOrigin,
    ) {
    }

    public function name(): string
    {
        return self::NAME;
    }

    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Guest;
    }

    public function category(): NotificationCategory
    {
        return NotificationCategory::Messages;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Normal;
    }

    public function channels(): array
    {
        return [NotificationChannel::Email];
    }

    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::HostMessage;
    }

    public function canBeSwitchedOff(): bool
    {
        return false;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null;
    }

    public function carriesCode(): bool
    {
        return false;
    }

    public function supersedesEarlier(): bool
    {
        return false;
    }

    /** Which addresses a guest's message skips is decided per organisation and per guest when it is queued (GuestReach), not by the account-wide list. */
    public function reachesSuppressed(): bool
    {
        return true;
    }

    public function collapseKey(array $payload): ?string
    {
        return null;
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return null !== $this->message($payload);
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $message = $this->message($payloads[0]) ?? throw new LogicException('A guest message rendered after it was deleted.');
        $event = $message->getEvent();
        $hosts = $event->getOrganisation()->getName();
        $guest = $this->guestRepository->findOneInEvent($event->getId(), $recipient->id);
        $token = $guest?->getLinkToken();
        $link = null === $token ? null : Str\trim_right($this->webOrigin, '/') . Guest::PAGE_PATH . $token;
        $locale = $recipient->locale;
        $subject = $this->trans('guest_message.notice.subject', ['event' => $event->getName(), 'hosts' => $hosts], $locale);

        $lines = [
            $this->trans('guest_message.notice.dear', ['greeting' => $recipient->name], $locale),
            '',
            $this->trans('guest_message.notice.body', ['hosts' => $hosts, 'event' => $event->getName()], $locale),
        ];

        if (null !== $link) {
            $lines[] = '';
            $lines[] = $this->trans('guest_message.notice.link', ['label' => $this->trans('guest_message.notice.read', [], $locale), 'url' => $link], $locale);
        }

        return new RenderedNotification(
            $subject,
            Str\join($lines, "\n"),
            unsubscribe: null === $guest ? null : $this->guestEmailUnsubscribe->url($guest),
            senderName: $this->trans('guest_message.notice.from', ['organisation' => $hosts], $locale),
        );
    }

    /** @param array<string, mixed> $payload */
    private function message(array $payload): ?GuestMessage
    {
        $id = Type\string()->coerce($payload['message'] ?? '');

        return Uuid::isValid($id) ? $this->guestMessageRepository->find($id) : null;
    }

    /** @param array<string, mixed> $parameters */
    private function trans(string $key, array $parameters, string $locale): string
    {
        return $this->translator->trans($key, $parameters, 'messages', $locale);
    }
}
