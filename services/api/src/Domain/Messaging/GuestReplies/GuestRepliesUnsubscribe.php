<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use Psl\Encoding\Base64;
use Psl\Str;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;
use Throwable;

/**
 * The summary's unsubscribe link (sc-4331): a signed token naming the member and the one setting it switches, Guest replies email. It never expires, so the mail app's Unsubscribe works from a summary of any age; only its signature makes it real.
 */
final readonly class GuestRepliesUnsubscribe
{
    public const string PATH = '/api/unsubscribe/guest-replies/';

    /** The page the footer link opens, holding the token after the `#`, which no server and no referrer ever sees. */
    public const string PAGE = '/unsubscribe/guest-replies#';

    public const string PATTERN = '[A-Za-z0-9_-]{44}';

    private const string PURPOSE = 'unsubscribe:guest_replies:';

    public function __construct(
        #[SensitiveParameter]
        #[Autowire('%kernel.secret%')]
        private string $secret,
        #[Autowire(env: 'DEFAULT_URI')]
        private string $apiOrigin,
    ) {
    }

    public function url(Uuid $userId): string
    {
        return Str\trim_right($this->apiOrigin, '/') . self::PATH . $this->token($userId);
    }

    public function token(Uuid $userId): string
    {
        return self::encode($userId->toBinary()) . $this->signature($userId);
    }

    /** @return ?Uuid the member it names, or null for a token that was tampered with or never issued */
    public function memberOf(#[SensitiveParameter] string $token): ?Uuid
    {
        if (44 !== Str\Byte\length($token)) {
            return null;
        }

        try {
            $userId = Uuid::fromBinary(Base64\decode(Str\Byte\slice($token, 0, 22), Base64\Variant::UrlSafe, explicitPadding: false));
        } catch (Throwable) {
            return null;
        }

        return \hash_equals($this->signature($userId), Str\Byte\slice($token, 22)) ? $userId : null;
    }

    private function signature(Uuid $userId): string
    {
        return self::encode(Str\Byte\slice(\hash_hmac('sha256', self::PURPOSE . $userId->toRfc4122(), $this->secret, true), 0, 16));
    }

    private static function encode(string $bytes): string
    {
        return Base64\encode($bytes, Base64\Variant::UrlSafe, padding: false);
    }
}
