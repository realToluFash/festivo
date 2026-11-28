<?php

declare(strict_types=1);

namespace App\Tests\Functional\Billing;

use App\Deletion\Pruner;
use App\Domain\Billing\Meter\StorageMeasurer;
use App\Domain\Billing\Meter\UsageMeter;
use App\Domain\Billing\Meter\UsageReader;
use App\Domain\Event\Cover\CoverPhotoProcessor;
use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\UsageKind;
use App\Repository\EventCoverRepository;
use App\Storage\ObjectStore;
use App\Tests\ApiTestCase;
use App\Tests\Double\RecordingLogger;
use App\Tests\Double\S3ClientFailingUnder;
use App\Tests\Traits\OnboardsAccounts;
use AsyncAws\Core\Configuration;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Imagick;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Uid\Uuid;

/** sc-90252: an organisation's storage is the bytes the store holds for its events' covers, measured into the meter's gauge. */
final class StorageMeasurementTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-11-24T09:00:00+00:00'));
        [$this->owner, $this->organisation] = $this->found('folake@ire.events', 'Ìrè Events');
    }

    #[Test]
    public function anOrganisationWithNothingStoredMeasuresZeroAndTheMeasurementIsRecorded(): void
    {
        self::assertSame(0, $this->measure());
        self::assertSame([0], $this->measurements($this->organisation));
    }

    #[Test]
    public function aCoverCountsAtItsStoredCopiesNotAtItsUpload(): void
    {
        $event = $this->draft();
        $uploaded = $this->photo();
        $this->setCover($event, $uploaded);

        $stored = $this->stored($this->photoKeyOf($event));

        self::assertSame($stored, $this->measure());
        self::assertNotSame(Str\Byte\length($uploaded), $stored);
        self::assertSame($stored, $this->storage());
    }

    #[Test]
    public function aReplacedCoverAndARemovedOneAreGoneAtTheNextMeasurement(): void
    {
        $event = $this->draft();
        $this->setCover($event, $this->photo());
        $first = $this->measure();

        $this->setCover($event, $this->photo(2400, 1800, 'tomato'));
        $replaced = $this->stored($this->photoKeyOf($event));

        self::assertSame($replaced, $this->measure());
        self::assertNotSame($first, $replaced);

        $this->as('DELETE', '/api/events/' . $event . '/cover');
        self::assertSame(200, $this->statusCode());

        self::assertSame(0, $this->measure());
    }

    #[Test]
    public function aDuplicatedEventHoldsItsOwnCopiesSoBothCount(): void
    {
        $event = $this->draft();
        $this->setCover($event, $this->photo());

        $body = $this->as('POST', '/api/events/' . $event . '/duplicate', ['startsAt' => '2031-05-15T16:00']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $copy = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];

        self::assertSame($this->stored($this->photoKeyOf($event)) + $this->stored($this->photoKeyOf($copy)), $this->measure());
    }

    #[Test]
    public function aDeletedEventsCoverCountsUntilThePurgeAndNotAfter(): void
    {
        $event = $this->draft();
        $this->setCover($event, $this->photo());
        $stored = $this->stored($this->photoKeyOf($event));

        $this->as('DELETE', '/api/events/' . $event);
        self::assertSame(200, $this->statusCode());
        self::assertSame($stored, $this->measure());

        self::mockTime(new DateTimeImmutable('2026-12-24T09:00:00+00:00'));
        self::em()->clear();
        self::assertSame(1, self::service(Pruner::class)->prune());

        self::assertSame(0, $this->measure());
    }

    #[Test]
    public function anExportAndAnUploadNeverSavedAsACoverAreNotCounted(): void
    {
        $id = $this->organisation->getId()->toRfc4122();
        self::service(ObjectStore::class)->keep('organisation-exports/' . $id . '/export.zip', Str\repeat('x', 4096), 'application/zip');
        self::service(ObjectStore::class)->keep('audit-exports/' . $id . '/audit.csv', Str\repeat('x', 4096), 'text/csv');
        $this->upload($this->photo());

        self::assertSame(0, $this->measure());
    }

    #[Test]
    public function aStoreFailureForOneOrganisationLeavesItsLastMeasurementWhileTheOthersAreMeasured(): void
    {
        $failing = $this->draft();
        $this->setCover($failing, $this->photo());
        $before = $this->measure();
        $first = $this->organisation;
        [$this->owner, $other] = $this->found('tunde@ire.events', 'Tunde Events');
        $this->organisation = $other;
        $measured = $this->draft();
        $this->setCover($measured, $this->photo());
        $logger = new RecordingLogger();

        self::assertGreaterThanOrEqual(1, $this->measurer($this->failingStoreUnder('event_cover/' . $failing . '/'), $logger)->measureAll());
        self::assertSame([$before], $this->measurements($first));
        self::assertSame([$this->stored($this->photoKeyOf($measured))], $this->measurements($other));
        $failed = Vec\filter_keys($logger->contexts, static fn (int $i): bool => 'error' === $logger->records[$i]['level']);
        self::assertCount(1, $failed);
        self::assertSame('The store did not answer.', Iter\first($failed)['reason'] ?? null);
    }

    #[Test]
    public function aSecondMeasurementOnOneDayStandsAsTheTotal(): void
    {
        self::assertSame(0, $this->measure());
        $event = $this->draft();
        $this->setCover($event, $this->photo());

        $stored = $this->measure();

        self::assertSame([$stored], $this->measurements($this->organisation));
        self::assertSame($stored, $this->storage());
    }

    #[Test]
    public function theCommandMeasuresOneOrganisationAtOnce(): void
    {
        $this->setCover($this->draft(), $this->photo());
        $tester = new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:usage:measure-storage'));

        self::assertSame(0, $tester->execute(['organisation' => $this->organisation->getId()->toRfc4122()]));
        self::assertSame([$this->storage()], $this->measurements($this->organisation));
        self::assertGreaterThan(0, $this->storage());
    }

    #[Test]
    public function theCommandRefusesAnIdThatNamesNoOrganisation(): void
    {
        $tester = new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:usage:measure-storage'));

        self::assertSame(2, $tester->execute(['organisation' => Uuid::v7()->toRfc4122()]));
        self::assertStringContainsString('No organisation has that id.', $tester->getDisplay());
    }

    private function measure(): int
    {
        return self::service(StorageMeasurer::class)->measure($this->organisation->getId());
    }

    private function storage(): int
    {
        return self::service(UsageReader::class)->read($this->organisation->getId(), new DateTimeImmutable())->of(UsageKind::StorageBytes)->used;
    }

    /** @return list<int> */
    private function measurements(Organisation $organisation): array
    {
        return Vec\map(self::service(Connection::class)->fetchFirstColumn(
            "SELECT quantity FROM usage_records WHERE kind = 'storage_bytes' AND organisation_id = :organisation",
            ['organisation' => $organisation->getId()->toRfc4122()],
        ), Type\int()->coerce(...));
    }

    /** Every copy as the store hands it back, read one by one rather than listed, so the sum does not lean on the measurer's own read. */
    private function stored(string $photoKey): int
    {
        $store = self::service(ObjectStore::class);
        $keys = [...Vec\map(Vec\keys(CoverPhotoProcessor::SIZES), static fn (string $size): string => EventCoverEditor::sizeKey($photoKey, $size)), EventCoverEditor::cardKey($photoKey)];

        return Math\sum(Vec\map($keys, static fn (string $key): int => Str\Byte\length($store->readPublished($key))));
    }

    private function photoKeyOf(string $event): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT photo_key FROM event_covers WHERE event_id = :id', ['id' => $event]));
    }

    private function measurer(ObjectStore $store, RecordingLogger $logger): StorageMeasurer
    {
        return new StorageMeasurer(self::service(Connection::class), self::service(EventCoverRepository::class), $store, self::service(UsageMeter::class), self::service(ClockInterface::class), $logger);
    }

    private function failingStoreUnder(string $prefix): ObjectStore
    {
        $env = static fn (string $name): string => Type\string()->coerce($_SERVER[$name]);
        $s3 = new S3ClientFailingUnder(Configuration::create([
            'endpoint' => $env('STORAGE_ENDPOINT'),
            'region' => $env('STORAGE_REGION'),
            'accessKeyId' => $env('STORAGE_KEY'),
            'accessKeySecret' => $env('STORAGE_SECRET'),
            'pathStyleEndpoint' => 'true',
        ]), $prefix);

        return new ObjectStore($s3, $env('STORAGE_BUCKET_PRIVATE'), $env('STORAGE_BUCKET_PUBLIC'), $env('STORAGE_PUBLIC_ENDPOINT'));
    }

    /** @return array{User, Organisation} */
    private function found(string $address, string $name): array
    {
        $owner = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($owner, withOrganisation: false);
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::em()->flush();

        return [$owner, $organisation];
    }

    private function draft(): string
    {
        $body = $this->as('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function setCover(string $event, string $photo): void
    {
        $body = $this->as('PUT', '/api/events/' . $event . '/cover', ['uploadKey' => $this->upload($photo), 'position' => 50]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));
    }

    private function upload(string $bytes): string
    {
        $body = $this->as('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/event-cover-uploads', ['contentType' => 'image/jpeg', 'size' => Str\Byte\length($bytes), 'filename' => 'photo.jpg']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $upload = Type\shape(['url' => Type\string(), 'key' => Type\string()], true)->coerce($body['upload'] ?? null);

        $handle = \curl_init($upload['url']);
        \curl_setopt_array($handle, [\CURLOPT_CONNECT_TO => ['::storage:4566'], \CURLOPT_CUSTOMREQUEST => 'PUT', \CURLOPT_POSTFIELDS => $bytes, \CURLOPT_HTTPHEADER => ['Content-Type: image/jpeg'], \CURLOPT_RETURNTRANSFER => true, \CURLOPT_TIMEOUT => 30]);
        \curl_exec($handle);
        self::assertSame(200, \curl_getinfo($handle, \CURLINFO_HTTP_CODE));

        return $upload['key'];
    }

    private function photo(int $width = 2400, int $height = 1600, string $colour = 'skyblue'): string
    {
        $image = new Imagick();
        $image->newImage($width, $height, $colour);
        $image->setImageFormat('jpeg');

        return $image->getImageBlob();
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
