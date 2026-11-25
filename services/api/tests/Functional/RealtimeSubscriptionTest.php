<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Realtime\SubscriberTokenIssuer;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lcobucci\JWT\Validation\Constraint\SignedWith;
use Lcobucci\JWT\Validation\Validator;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Env;
use Psl\Json;
use Psl\Type;

/** The hub hands a member's private updates only to a token naming that member's topic, and only the member is given one (sc-3980). */
final class RealtimeSubscriptionTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
    }

    #[Test]
    public function aMemberIsGivenTheirOwnNotificationsTopicAndNoOneElses(): void
    {
        $ada = $this->registered('ada@example.com');
        $this->registered('tomi@example.com');

        $token = $this->subscribe($ada);

        self::assertSame(
            ['subscribe' => ['users/' . $ada->getId()->toRfc4122() . '/notifications']],
            $token->claims()->get('mercure'),
        );
    }

    #[Test]
    public function theTokenIsSignedWithTheSubscriberKeySoItCannotPublish(): void
    {
        $token = $this->subscribe($this->registered('ada@example.com'));
        $validator = new Validator();

        self::assertTrue($validator->validate($token, new SignedWith(new Sha256(), InMemory::plainText(self::key('MERCURE_SUBSCRIBER_KEY')))));
        self::assertFalse($validator->validate($token, new SignedWith(new Sha256(), InMemory::plainText(self::key('MERCURE_PUBLISHER_KEY')))));
    }

    #[Test]
    public function theTokenLastsAsLongAsTheResponseSays(): void
    {
        $token = $this->subscribe($this->registered('ada@example.com'));
        $body = $this->body();

        $expiresAt = $token->claims()->get('exp');
        self::assertInstanceOf(DateTimeImmutable::class, $expiresAt);
        self::assertSame($expiresAt->format(\DATE_ATOM), $body['expiresAt']);
        self::assertSame(SubscriberTokenIssuer::LIFETIME_SECONDS, $expiresAt->getTimestamp() - Type\instance_of(DateTimeImmutable::class)->coerce($token->claims()->get('iat'))->getTimestamp());
    }

    #[Test]
    public function somebodySignedOutIsGivenNothing(): void
    {
        $this->client->request('POST', '/api/realtime/subscriptions', server: ['CONTENT_TYPE' => 'application/json']);

        self::assertResponseStatusCodeSame(401);
        self::assertArrayNotHasKey('token', $this->body());
    }

    private function subscribe(User $as): UnencryptedToken
    {
        $this->client->request('POST', '/api/realtime/subscriptions', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($as),
        ]);
        self::assertResponseIsSuccessful();

        return Type\instance_of(UnencryptedToken::class)->coerce(new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($this->body()['token'])));
    }

    /** @return array<string, mixed> */
    private function body(): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
    }

    private function registered(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Someone', self::PASSWORD)->user;
        self::onboard($user);

        return $user;
    }

    /**
     * @param non-empty-string $name
     *
     * @return non-empty-string
     */
    private static function key(string $name): string
    {
        return Type\non_empty_string()->coerce(Env\get_var($name));
    }
}
