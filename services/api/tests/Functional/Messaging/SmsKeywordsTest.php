<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\GuestMessages\GuestSuppressions;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Enum\GuestChannel;
use App\Enum\GuestSuppressionReason;
use App\Integrations\Twilio\TwilioSignature;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Uid\Uuid;

final class SmsKeywordsTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string NUMBER = '+447700900123';

    private const string PATH = '/api/webhooks/sms/inbound';

    private const string STOPPED = 'You will get no more texts through Soirely from any organisation. Text START to get them again.';

    private Uuid $one;

    private Uuid $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();

        $this->one = $this->organisationNamed('One Events', 'one@example.test');
        $this->other = $this->organisationNamed('Other Events', 'other@example.test');
    }

    #[Test]
    #[DataProvider('stopWords')]
    public function aStopKeywordInAnyLanguageStopsEveryOrganisation(string $word): void
    {
        $this->text($word);

        self::assertResponseStatusCodeSame(200);
        self::assertTrue($this->stopped($this->one));
        self::assertTrue($this->stopped($this->other));
        self::assertSame(1, \substr_count((string) $this->client->getResponse()->getContent(), '<Message>'));
    }

    /** @return iterable<string, array{string}> */
    public static function stopWords(): iterable
    {
        foreach (['STOP', 'stopall', 'Unsubscribe', 'CANCEL', 'END', 'QUIT', 'ARRÊT', 'BAJA', 'PARAR', 'SAIR'] as $word) {
            yield $word => [$word];
        }
    }

    #[Test]
    public function theReplyNamesSoirely(): void
    {
        $this->text('STOP');

        self::assertStringContainsString('<Message>' . self::STOPPED . '</Message>', (string) $this->client->getResponse()->getContent());
    }

    #[Test]
    #[DataProvider('startWords')]
    public function startResumesEveryOrganisationOneStoppedByTheSwitchToo(string $word): void
    {
        self::service(GuestSuppressions::class)->suppress($this->one, GuestChannel::Texts, self::NUMBER, GuestSuppressionReason::OptedOut);
        $this->text('STOP');

        $this->text($word);

        self::assertFalse($this->stopped($this->one));
        self::assertFalse($this->stopped($this->other));
        self::assertStringContainsString('<Message>You will get texts through Soirely again. Text STOP to stop them.</Message>', (string) $this->client->getResponse()->getContent());
    }

    /** @return iterable<string, array{string}> */
    public static function startWords(): iterable
    {
        yield 'START' => ['START'];
        yield 'UNSTOP' => ['unstop'];
    }

    #[Test]
    public function theSwitchTurnsOneOrganisationBackOnUntilTheNextStop(): void
    {
        $this->text('STOP');

        self::service(GuestSuppressions::class)->lift($this->one, GuestChannel::Texts, self::NUMBER);

        self::assertFalse($this->stopped($this->one));
        self::assertTrue($this->stopped($this->other));

        $this->text('STOP');

        self::assertTrue($this->stopped($this->one));
    }

    #[Test]
    public function aStopByKeywordStopsTextsOnly(): void
    {
        $this->text('STOP');

        self::assertNull(self::service(GuestSuppressions::class)->since($this->one, GuestChannel::WhatsApp, self::NUMBER));
        self::assertSame(
            [self::NUMBER => GuestSuppressionReason::OptedOut],
            self::service(GuestSuppressions::class)->among($this->one, GuestChannel::Texts, [self::NUMBER, '+447700900124']),
        );
    }

    #[Test]
    public function helpIsAnsweredOnceWithTheSupportAddressAndStopsNothing(): void
    {
        $this->text('HELP');

        self::assertStringContainsString('<Message>Soirely texts you about events you are invited to. Text STOP to stop. Help: support@soirely.com</Message>', (string) $this->client->getResponse()->getContent());
        self::assertFalse($this->stopped($this->one));
    }

    #[Test]
    public function aTextWithNoKeywordIsNotAnswered(): void
    {
        $this->text('Will there be parking?');

        self::assertResponseStatusCodeSame(200);
        self::assertStringNotContainsString('<Message>', (string) $this->client->getResponse()->getContent());
    }

    #[Test]
    public function anUnsignedOrWronglySignedTextIsRefusedAndStopsNothing(): void
    {
        $this->post(['From' => self::NUMBER, 'Body' => 'STOP'], null);
        self::assertResponseStatusCodeSame(403);

        $this->post(['From' => self::NUMBER, 'Body' => 'STOP'], $this->signature(['From' => self::NUMBER, 'Body' => 'HELP']));
        self::assertResponseStatusCodeSame(403);

        self::assertFalse($this->stopped($this->one));
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function text(string $body): void
    {
        $fields = ['From' => self::NUMBER, 'To' => '+447700900999', 'Body' => $body];
        $this->post($fields, $this->signature($fields));
    }

    /** @param array<string, string> $fields */
    private function signature(array $fields): string
    {
        $signature = self::service(TwilioSignature::class);

        return $signature->of($signature->url(self::PATH), $fields);
    }

    /** @param array<string, string> $fields */
    private function post(array $fields, ?string $signature): void
    {
        $this->client->request(Request::METHOD_POST, self::PATH, $fields, [], null === $signature ? [] : ['HTTP_X_TWILIO_SIGNATURE' => $signature]);
    }

    private function stopped(Uuid $organisation): bool
    {
        return null !== self::service(GuestSuppressions::class)->optedOutSince($organisation, GuestChannel::Texts, self::NUMBER);
    }

    private function organisationNamed(string $name, string $email): Uuid
    {
        $organisation = self::service(OrganisationFounder::class)->found($this->account($email), $name, 'GB', 'Europe/London');
        self::em()->flush();

        return $organisation->getId();
    }
}
