<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Entity\Guest;
use Psl\Encoding\Base64;
use Psl\Str;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;
use Throwable;

/**
 * A guest's email unsubscribe link (sc-3969): a signed token naming the guest, and through its signature their organisation and the channel, email. It never expires, so the link and the mail app's Unsubscribe work from an email of any age; only its signature makes it real.
 */
final readonly class GuestEmailUnsubscribe
{
    public const string PATH = '/api/unsubscribe/guest/';

    /** The page the link opens, holding the token after the `#`, which no server and no referrer ever sees. */
    public const string PAGE = '/your-messages#';

    /** Wider than a token, so a link a mail client cut short still opens the page, which says it does not work. */
    public const string PATTERN = '[^/]{1,256}';

    private const string PURPOSE = 'unsubscribe:guest:email:';

    public function __construct(
        #[SensitiveParameter]
        #[Autowire('%kernel.secret%')]
        private string $secret,
        #[Autowire(env: 'DEFAULT_URI')]
        private string $apiOrigin,
    ) {
    }

    public function url(Guest $guest): string
    {
        return Str\trim_right($this->apiOrigin, '/') . self::PATH . $this->token($guest->getId(), $guest->getEvent()->getOrganisation()->getId());
    }

    public function token(Uuid $guestId, Uuid $organisationId): string
    {
        return self::encode($guestId->toBinary()) . $this->signature($guestId, $organisationId);
    }

    /** @return ?Uuid the guest it names, or null for a token that was cut, tampered with or never issued */
    public function guestOf(#[SensitiveParameter] string $token): ?Uuid
    {
        if (44 !== Str\Byte\length($token)) {
            return null;
        }

        try {
            return Uuid::fromBinary(Base64\decode(Str\Byte\slice($token, 0, 22), Base64\Variant::UrlSafe, explicitPadding: false));
        } catch (Throwable) {
            return null;
        }
    }

    /** The signature holds the organisation, so a guest's token is good only for the organisation that sent it. */
    public function signs(#[SensitiveParameter] string $token, Guest $guest): bool
    {
        return 44 === Str\Byte\length($token)
            && \hash_equals($this->signature($guest->getId(), $guest->getEvent()->getOrganisation()->getId()), Str\Byte\slice($token, 22));
    }

    private function signature(Uuid $guestId, Uuid $organisationId): string
    {
        return self::encode(Str\Byte\slice(\hash_hmac('sha256', self::PURPOSE . $guestId->toRfc4122() . ':' . $organisationId->toRfc4122(), $this->secret, true), 0, 16));
    }

    private static function encode(string $bytes): string
    {
        return Base64\encode($bytes, Base64\Variant::UrlSafe, padding: false);
    }
}
