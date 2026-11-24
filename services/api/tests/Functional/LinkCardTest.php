<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Guest\Link\LinkCard;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Storage\ObjectStore;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** The head a guest's link answers a chat app with (sc-89272), as the web's nginx asks for it. */
final class LinkCardTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string NAME = "Kemi's 40th <\"Surprise\"> & more";

    private const string TITLE = '<title>Kemi&apos;s 40th &lt;&quot;Surprise&quot;&gt; &amp; more</title><meta property="og:title" content="Kemi&apos;s 40th &lt;&quot;Surprise&quot;&gt; &amp; more">';

    private User $owner;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-03T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->as('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => self::NAME, 'type' => 'party', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->eventId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['event'] ?? null)['id'];
        $this->hosts(['Tunde', 'Kemi', 'Bola']);
        $this->as('POST', '/api/events/' . $this->eventId . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::service(Connection::class)->executeStatement("UPDATE organisations SET locale = 'en' WHERE id = :id", ['id' => $organisation->getId()->toRfc4122()]);
    }

    #[Test]
    public function aLiveEventWithNoPhotoAnswersItsNameTheHostsAndItsOwnColour(): void
    {
        $link = $this->link($this->add());
        $head = $this->card(Str\after($link, '/i/') ?? '');

        self::assertSame(
            self::TITLE
            . '<meta property="og:description" content="Your invitation from Tunde, Kemi and Bola">'
            . '<meta property="og:image" content="' . (Str\before($link, '/i/') ?? self::fail('no origin')) . '/link-cards/' . LinkCard::meshFor($this->eventId) . '.jpg">'
            . '<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="675">',
            $head,
        );
        self::assertSame(200, $this->statusCode());
        self::assertStringStartsWith('text/html', (string) $this->client->getResponse()->headers->get('Content-Type'));
    }

    #[Test]
    public function aPhotoIsItsCardAtItsFrameWithItsDescriptionAsTheAlternative(): void
    {
        $photoKey = $this->withCover('Adaeze & Tunde under the arch');
        $head = $this->card($this->token($this->add()));

        self::assertStringContainsString('<meta property="og:image" content="' . self::service(ObjectStore::class)->publicUrl(EventCoverEditor::cardKey($photoKey)) . '">', $head);
        self::assertStringContainsString('<meta property="og:image:alt" content="Adaeze &amp; Tunde under the arch">', $head);
        self::assertStringNotContainsString('/link-cards/', $head);
    }

    #[Test]
    public function aPhotoWithNoDescriptionHasNoAlternative(): void
    {
        $this->withCover(null);

        self::assertStringNotContainsString('og:image:alt', $this->card($this->token($this->add())));
    }

    /** @return iterable<string, array{?string, string}> */
    public static function languages(): iterable
    {
        yield 'none: the organisation\'s' => [null, 'Tunde and Kemi'];
        yield 'en' => ['en', 'Tunde and Kemi'];
        yield 'es' => ['es', 'Tunde y Kemi'];
        yield 'fr' => ['fr', 'Tunde et Kemi'];
        yield 'pt' => ['pt', 'Tunde e Kemi'];
    }

    /** Until the translation ticket merges, the words are English in every catalogue; the hosts are joined in the guest's language. */
    #[Test]
    #[DataProvider('languages')]
    public function theLineIsInTheGuestsLanguageWhateverTheFetchAsks(?string $language, string $hosts): void
    {
        $this->hosts(['Tunde', 'Kemi']);
        $token = $this->token($this->add(['language' => $language]));

        foreach ([['HTTP_ACCEPT_LANGUAGE' => 'en'], ['HTTP_ACCEPT_LANGUAGE' => 'fr'], []] as $server) {
            self::assertStringContainsString('<meta property="og:description" content="Your invitation from ' . $hosts . '">', $this->card($token, $server));
        }
    }

    #[Test]
    public function anEventThatNamesNoHostsHasNoLine(): void
    {
        $token = $this->token($this->add());
        $this->hosts([]);

        $head = $this->card($token);

        self::assertStringNotContainsString('og:description', $head);
        self::assertStringContainsString('og:image', $head);
    }

    #[Test]
    public function aPausedEventAnswersTheWholeCard(): void
    {
        $token = $this->token($this->add());
        self::service(Connection::class)->executeStatement("UPDATE events SET status = 'paused' WHERE id = :id", ['id' => $this->eventId]);

        self::assertStringContainsString('og:image', $this->card($token));
    }

    #[Test]
    public function aCalledOffOrFinishedEventAnswersItsNameAlone(): void
    {
        $token = $this->token($this->add());
        self::service(Connection::class)->executeStatement("UPDATE events SET ended_at = '2026-10-03 09:00:00' WHERE id = :id", ['id' => $this->eventId]);
        self::assertSame(self::TITLE, $this->card($token), 'called off');

        self::service(Connection::class)->executeStatement('UPDATE events SET ended_at = NULL WHERE id = :id', ['id' => $this->eventId]);
        self::mockTime(new DateTimeImmutable('2030-11-16T09:00:00+00:00'));
        self::assertSame(self::TITLE, $this->card($token), 'finished');
    }

    #[Test]
    public function aLinkThatOpensNoPageAnswersAsOneThatNeverExisted(): void
    {
        $guest = $this->add();
        $token = $this->token($guest);
        $this->as('POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link/replace');

        self::assertSame(LinkCard::NOTHING, $this->card($token), 'replaced');

        $removed = $this->token($guest = $this->add(['fullName' => 'Removed Guest']));
        $this->as('DELETE', '/api/events/' . $this->eventId . '/guests/' . $guest);
        self::assertSame(LinkCard::NOTHING, $this->card($removed), 'removed');
        $this->as('DELETE', '/api/events/' . $this->eventId . '/guests/' . $guest . '/removal');
        self::assertStringContainsString('og:image', $this->card($removed), 'removal undone');

        $erased = $this->token($guest = $this->add(['fullName' => 'Erased Guest']));
        $this->as('DELETE', '/api/events/' . $this->eventId . '/guests/' . $guest);
        $this->as('POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/erasure');
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(LinkCard::NOTHING, $this->card($erased), 'erased');

        $live = $this->token($this->add(['fullName' => 'Kept Guest']));
        $this->as('DELETE', '/api/events/' . $this->eventId, ['name' => self::NAME]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(LinkCard::NOTHING, $this->card($live), 'event deleted');

        self::assertSame(LinkCard::NOTHING, $this->card('made-up'), 'made up');
        self::assertSame(LinkCard::NOTHING, $this->card(''), 'none');
        self::assertSame('<title>Soirely</title>', LinkCard::NOTHING);
    }

    #[Test]
    public function twoGuestsInOneLanguageGetTheSameCardAndFetchingChangesNothing(): void
    {
        $first = $this->add();
        $token = $this->token($first);
        $this->as('GET', '/api/events/' . $this->eventId . '/guests/' . $first);
        $before = $this->last();

        for ($fetch = 0; $fetch < 20; ++$fetch) {
            $this->card($token);
        }

        self::assertSame($this->card($token), $this->card($this->token($this->add(['fullName' => 'Ada Obi']))));
        self::assertStringNotContainsString('Bisi', $this->card($token));
        $this->as('GET', '/api/events/' . $this->eventId . '/guests/' . $first);
        self::assertSame($before, $this->last());
    }

    /** The page's meshFor in apps/web/src/mesh.ts, case for case. */
    #[Test]
    public function theColourIsTheOneThePageDraws(): void
    {
        self::assertSame(['party', 'draft', 'wed', 'ireti'], [LinkCard::meshFor('a'), LinkCard::meshFor('b'), LinkCard::meshFor('c'), LinkCard::meshFor('d')]);
        self::assertSame('party', LinkCard::meshFor('0196f0a2-7c1e-7d3a-9f00-1a2b3c4d5e6f'));
    }

    /** @param array<string, string> $server */
    private function card(#[SensitiveParameter] string $token, array $server = []): string
    {
        $this->client->request('GET', '/api/guest-links/card', server: ['HTTP_X_GUEST_LINK' => $token, ...$server]);

        return (string) $this->client->getResponse()->getContent();
    }

    /** @param list<string> $hosts */
    private function hosts(array $hosts): void
    {
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => Json\encode($hosts), 'id' => $this->eventId]);
    }

    private function withCover(?string $description): string
    {
        $photoKey = 'event_cover/' . $this->eventId . '/' . Uuid::v7()->toRfc4122();
        self::service(Connection::class)->executeStatement(
            'INSERT INTO event_covers (event_id, photo_key, position, description, created_at, updated_at) VALUES (:id, :photo, 50, :description, NOW(), NOW())',
            ['id' => $this->eventId, 'photo' => $photoKey, 'description' => $description],
        );

        return $photoKey;
    }

    /** @param array<string, mixed> $with */
    private function add(array $with = []): string
    {
        $this->as('POST', '/api/events/' . $this->eventId . '/guests', ['fullName' => 'Bisi Adewale', 'companions' => [], ...$with]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
    }

    private function token(string $guest): string
    {
        return Str\after($this->link($guest), '/i/') ?? self::fail('no token');
    }

    private function link(string $guest): string
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\string()->coerce($this->last()['url'] ?? null);
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<string, mixed>|null $body */
    private function as(string $method, string $path, ?array $body = null): void
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
