<?php

declare(strict_types=1);

namespace App\Domain\Guest\Link;

use App\Domain\Event\Cover\CoverPhotoProcessor;
use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Guest\Reply\GuestAnswers;
use App\Domain\Messaging\GuestReplies\GuestReplyWording;
use App\Entity\Guest;
use App\Enum\GuestPagePhase;
use App\Locale\GuestLanguage;
use App\Repository\EventCoverRepository;
use Psl\Html;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A link that opens no page answers today's head, byte for byte, so it never tells whether it was real (sc-89272). */
final readonly class LinkCard
{
    public const string NOTHING = '<title>Soirely</title>';

    private const array MESHES = ['wed', 'ireti', 'party', 'draft'];

    public function __construct(
        private string $webOrigin,
        private InvitationLinks $invitationLinks,
        private GuestAnswers $guestAnswers,
        private EventCoverRepository $eventCoverRepository,
        private EventCoverEditor $eventCoverEditor,
        private GuestReplyWording $guestReplyWording,
        private TranslatorInterface $translator,
    ) {
    }

    public function head(#[SensitiveParameter] string $token): string
    {
        $guest = $this->invitationLinks->guestFor($token);

        return null === $guest || $guest->isRemoved() ? self::NOTHING : $this->of($guest);
    }

    private function of(Guest $guest): string
    {
        $event = $guest->getEvent();
        $name = self::escaped($event->getName());
        $tags = ['<title>' . $name . '</title>', self::meta('og:title', $name)];

        if (!Iter\contains([GuestPagePhase::Live, GuestPagePhase::Paused], $this->guestAnswers->phase($guest))) {
            return Str\join($tags, '');
        }

        if ([] !== $event->getHosts()) {
            $language = GuestLanguage::forMessage($guest);
            $hosts = $this->guestReplyWording->names(Vec\values($event->getHosts()), $language);
            $tags[] = self::meta('og:description', self::escaped($this->translator->trans('guest_link_card.line', ['hosts' => $hosts], 'messages', $language)));
        }

        $cover = $this->eventCoverRepository->findOneForEvent($event);
        $image = null === $cover
            ? Str\format('%s/link-cards/%s.jpg', Str\trim_right($this->webOrigin, '/'), self::meshFor($event->getId()->toRfc4122()))
            : $this->eventCoverEditor->cardUrl($cover);
        $tags[] = self::meta('og:image', self::escaped($image));
        $tags[] = self::meta('og:image:type', 'image/jpeg');
        $tags[] = self::meta('og:image:width', (string) CoverPhotoProcessor::CARD_WIDTH);
        $tags[] = self::meta('og:image:height', (string) CoverPhotoProcessor::CARD_HEIGHT);

        $description = $cover?->getDescription();
        if (null !== $description) {
            $tags[] = self::meta('og:image:alt', self::escaped($description));
        }

        return Str\join($tags, '');
    }

    /** apps/web's meshFor, so the card and the page draw the same colour for the same event. */
    public static function meshFor(string $id): string
    {
        $sum = 7;
        foreach (Str\Byte\chunk($id) as $character) {
            $sum = ($sum * 31 + Str\Byte\ord($character)) % 4_294_967_296;
        }

        return self::MESHES[$sum % 4];
    }

    private static function meta(string $property, string $escapedContent): string
    {
        return Str\format('<meta property="%s" content="%s">', $property, $escapedContent);
    }

    private static function escaped(string $text): string
    {
        return Html\encode_special_characters($text);
    }
}
