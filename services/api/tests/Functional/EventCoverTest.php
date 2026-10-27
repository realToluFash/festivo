<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Enum\UploadPurpose;
use App\Storage\ObjectStore;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Imagick;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Encoding\Base64;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Str\Byte;
use Psl\Type;
use Psl\Vec;

final class EventCoverTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $body = $this->as($this->owner, 'POST', $this->path('events'), [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());
        $this->eventId = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    #[Test]
    public function anEventWithNoPhotoHasNoCoverSoItsTypeDefaultShows(): void
    {
        self::assertNull($this->cover($this->as($this->owner, 'GET', '/api/events/' . $this->eventId)));
    }

    #[Test]
    public function aPhotoIsStoredAtEverySizeWithoutItsGpsOrExif(): void
    {
        $original = self::photo(2400, 1600, withGps: true);
        self::assertArrayHasKey('exif:GPSLatitude', self::read($original)->getImageProperties('exif:*'), 'The photo carries no GPS for the test to see stripped');

        $cover = $this->cover($this->as($this->owner, 'PUT', $this->coverPath(), [
            'uploadKey' => $this->upload($original, 'image/jpeg'),
            'position' => 30,
            'description' => '  Ada and Tunde under the arch  ',
        ]));

        self::assertSame(200, $this->statusCode());
        self::assertNotNull($cover);
        self::assertSame(30, $cover['position']);
        self::assertSame('Ada and Tunde under the arch', $cover['description']);
        self::assertSame([640, 1280, 1920], Vec\map($cover['sizes'], static fn (array $size): int => $size['width']));

        foreach ($cover['sizes'] as $size) {
            $stored = $this->fetch($size['url']);
            $image = self::read($stored);

            self::assertSame('WEBP', $image->getImageFormat());
            self::assertSame($size['width'], $image->getImageWidth());
            self::assertSame([], $image->getImageProfiles('*', false), 'A stored size kept a metadata profile');
            self::assertSame([], $image->getImageProperties('exif:*'), 'A stored size kept EXIF');
            self::assertStringNotContainsString('Exif', $stored);
            self::assertStringNotContainsString('GPS', $stored);
        }
    }

    /** A browser that cannot show a HEIC is sent this instead (sc-13861); nothing is stored, so nothing is left to delete. */
    #[Test]
    public function aPreviewIsTheUploadAsAWebPCarriedInTheAnswerWithoutItsGpsOrExif(): void
    {
        $key = $this->upload(self::photo(2400, 1600, withGps: true), 'image/jpeg');

        $body = $this->as($this->owner, 'POST', $this->path('event-cover-uploads/preview'), ['uploadKey' => $key]);

        self::assertSame(200, $this->statusCode());
        $preview = Type\string()->coerce($body['preview'] ?? null);
        self::assertStringStartsWith('data:image/webp;base64,', $preview);
        $bytes = Base64\decode(Str\strip_prefix($preview, 'data:image/webp;base64,'));
        $image = self::read($bytes);
        self::assertSame('WEBP', $image->getImageFormat());
        self::assertSame(1280, $image->getImageWidth());
        self::assertSame([], $image->getImageProfiles('*', false), 'The preview kept a metadata profile');
        self::assertSame([], $image->getImageProperties('exif:*'), 'The preview kept EXIF');
        self::assertStringNotContainsString('GPS', $bytes);
        self::assertNotNull(self::service(ObjectStore::class)->uploadSize(UploadPurpose::EventCover, $key), 'The upload went before Use this photo could save it');
    }

    /** @return iterable<string, array{string, string}> */
    public static function refusedPreviews(): iterable
    {
        yield 'smaller than 1200 × 675' => [self::photo(1600, 674), '1200 × 675'];
        yield 'not a photo' => ['<?php echo 1;', 'JPEG, PNG, WebP or HEIC'];
    }

    #[Test]
    #[DataProvider('refusedPreviews')]
    public function aPreviewOfASmallOrUnreadablePhotoIsRefusedWithTheSavesLineAndDeletesIt(string $bytes, string $line): void
    {
        $key = $this->upload($bytes, 'image/heic');

        $this->as($this->owner, 'POST', $this->path('event-cover-uploads/preview'), ['uploadKey' => $key]);

        self::assertSame(422, $this->statusCode());
        self::assertStringContainsString($line, $this->violations()['file'] ?? '');
        self::assertNull(self::service(ObjectStore::class)->uploadSize(UploadPurpose::EventCover, $key));
    }

    #[Test]
    public function anotherOrganisationsUploadIsNotPreviewed(): void
    {
        $theirs = Str\replace($this->upload(self::photo(1600, 900), 'image/jpeg'), $this->organisation->getId()->toRfc4122(), '0199f0aa-1111-7000-8000-000000000001');

        $this->as($this->owner, 'POST', $this->path('event-cover-uploads/preview'), ['uploadKey' => $theirs]);

        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('uploadKey', $this->violations());
    }

    #[Test]
    public function aPngAndAWebPAreTakenToo(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1200, 675, format: 'png'), 'image/png'), 'position' => 50]);
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1300, 800, format: 'webp'), 'image/webp'), 'position' => 50]);
        self::assertSame(200, $this->statusCode());
    }

    /** The image has no HEIC encoder to make one with, so this asserts the decoder a phone's photo needs is there. */
    #[Test]
    public function theImageReadsHeic(): void
    {
        self::assertContains('HEIC', Imagick::queryFormats('HEIC'));
    }

    /** @return iterable<string, array{string, int}> */
    public static function refusedBeforeUpload(): iterable
    {
        yield 'a GIF' => ['image/gif', 1000];
        yield 'a PDF' => ['application/pdf', 1000];
        yield 'over 15 MB' => ['image/jpeg', 15 * 1024 * 1024 + 1];
    }

    #[Test]
    #[DataProvider('refusedBeforeUpload')]
    public function aTypeOrSizeTheCoverDoesNotTakeIsRefusedBeforeItUploads(string $contentType, int $size): void
    {
        $this->as($this->owner, 'POST', $this->path('event-cover-uploads'), ['contentType' => $contentType, 'size' => $size, 'filename' => 'photo']);

        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('file', $this->violations());
    }

    #[Test]
    public function anUploadLargerThanItsSignatureDeclaredIsRefusedAndDeleted(): void
    {
        $key = $this->upload(self::photo(1600, 900) . Str\repeat("\0", 15 * 1024 * 1024), 'image/jpeg', declaredSize: 1000);

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $key, 'position' => 50]);

        self::assertSame(422, $this->statusCode());
        self::assertStringContainsString('15 MB', $this->violations()['file'] ?? '');
        self::assertNull(self::service(ObjectStore::class)->uploadSize(UploadPurpose::EventCover, $key));
    }

    #[Test]
    public function aCancelledUploadIsDeleted(): void
    {
        $key = $this->upload(self::photo(1600, 900, withGps: true), 'image/jpeg');

        $this->as($this->owner, 'DELETE', $this->path('event-cover-uploads'), ['uploadKey' => $key]);

        self::assertSame(204, $this->statusCode());
        self::assertNull(self::service(ObjectStore::class)->uploadSize(UploadPurpose::EventCover, $key));
    }

    #[Test]
    public function anotherOrganisationsUploadIsNotDiscarded(): void
    {
        $key = $this->upload(self::photo(1600, 900), 'image/jpeg');
        $theirs = Str\replace($key, $this->organisation->getId()->toRfc4122(), '0199f0aa-1111-7000-8000-000000000001');

        $this->as($this->owner, 'DELETE', $this->path('event-cover-uploads'), ['uploadKey' => $theirs]);

        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('uploadKey', $this->violations());
    }

    #[Test]
    public function aPhotoSmallerThan1200By675IsRefusedAndLeavesThePreviousCover(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 20]);
        $before = $this->cover($this->last());

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1199, 900), 'image/jpeg'), 'position' => 50]);

        self::assertSame(422, $this->statusCode());
        self::assertStringContainsString('1200 × 675', $this->violations()['file'] ?? '');
        self::assertSame($before, $this->cover($this->as($this->owner, 'GET', '/api/events/' . $this->eventId)));
    }

    /** @return iterable<string, array{string}> */
    public static function damagedJpegs(): iterable
    {
        $whole = self::photo(1600, 900);
        $scan = (Byte\search($whole, "\xFF\xDA") ?? 0) + 14;

        yield 'cut off after its header' => [Byte\slice($whole, 0, $scan + 6)];
        yield 'cut off halfway' => [Byte\slice($whole, 0, Byte\length($whole) >> 1)];
        yield 'a header and a random body' => [Byte\slice($whole, 0, $scan) . SecureRandom\bytes(60_000)];
        yield 'a header and a random body that ends as a JPEG ends' => [Byte\slice($whole, 0, $scan) . SecureRandom\bytes(60_000) . "\xFF\xD9"];
    }

    /** The browser reads its size from the header and showed it as a grey box (qa2, #16039; Decided, 27 Oct). */
    #[Test]
    #[DataProvider('damagedJpegs')]
    public function aJpegWhosePictureIsCutOffOrNotPictureDataIsRefusedAtThePreviewAndTheSave(string $bytes): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 20]);
        $before = $this->cover($this->last());

        $this->as($this->owner, 'POST', $this->path('event-cover-uploads/preview'), ['uploadKey' => $this->upload($bytes, 'image/jpeg')]);
        self::assertSame(422, $this->statusCode());
        self::assertStringContainsString('JPEG, PNG, WebP or HEIC', $this->violations()['file'] ?? '');

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload($bytes, 'image/jpeg'), 'position' => 50]);
        self::assertSame(422, $this->statusCode());
        self::assertStringContainsString('JPEG, PNG, WebP or HEIC', $this->violations()['file'] ?? '');
        self::assertSame($before, $this->cover($this->as($this->owner, 'GET', '/api/events/' . $this->eventId)));
    }

    /** @return iterable<string, array{string}> */
    public static function wholeJpegsAStrictReaderWarnsAbout(): iterable
    {
        $whole = self::photo(1600, 900);
        $scan = Byte\search($whole, "\xFF\xDA") ?? 0;

        yield 'padding between segments' => [Byte\slice($whole, 0, $scan) . "\0\0\0" . Byte\slice($whole, $scan)];
        yield 'no end marker' => [Byte\strip_suffix($whole, "\xFF\xD9")];
        yield 'bytes after the end' => [$whole . SecureRandom\bytes(512)];
    }

    #[Test]
    #[DataProvider('wholeJpegsAStrictReaderWarnsAbout')]
    public function aJpegWhoseWholePictureShowsIsTakenThoughAStrictReaderWarns(string $bytes): void
    {
        $this->as($this->owner, 'POST', $this->path('event-cover-uploads/preview'), ['uploadKey' => $this->upload($bytes, 'image/jpeg')]);
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload($bytes, 'image/jpeg'), 'position' => 50]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aFileThatIsNotAnImageIsRefusedOnceItHasArrived(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload('<?php echo 1;', 'image/jpeg'), 'position' => 50]);

        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('file', $this->violations());
    }

    #[Test]
    public function anUploadKeyFromAnotherOrganisationIsNotRead(): void
    {
        $key = Str\replace($this->upload(self::photo(1600, 900), 'image/jpeg'), $this->organisation->getId()->toRfc4122(), '0199f0aa-1111-7000-8000-000000000001');

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $key, 'position' => 50]);

        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('uploadKey', $this->violations());
    }

    #[Test]
    public function aDescriptionOver250CharactersIsRefused(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50, 'description' => Str\repeat('a', 251)]);

        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('description', $this->violations());
    }

    #[Test]
    public function aBlankDescriptionMarksThePhotoDecorative(): void
    {
        $cover = $this->cover($this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50, 'description' => '   ']));

        self::assertNotNull($cover);
        self::assertNull($cover['description']);
    }

    #[Test]
    public function theSavedPhotoTakesANewPositionAndDescriptionWithoutANewUpload(): void
    {
        $first = $this->cover($this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50]));
        $moved = $this->cover($this->as($this->owner, 'PUT', $this->coverPath(), ['position' => 90, 'description' => 'The arch']));

        self::assertSame(200, $this->statusCode());
        self::assertSame($first['sizes'] ?? null, $moved['sizes'] ?? null);
        self::assertSame([90, 'The arch'], [$moved['position'] ?? null, $moved['description'] ?? null]);
    }

    #[Test]
    public function aPositionWithNoPhotoSavedOrOutsideZeroToAHundredIsRefused(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['position' => 50]);
        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('uploadKey', $this->violations());

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 101]);
        self::assertSame(422, $this->statusCode());
        self::assertArrayHasKey('position', $this->violations());
    }

    #[Test]
    public function removingThePhotoBringsBackTheDefaultAndDeletesWhatWasStored(): void
    {
        $cover = $this->cover($this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50]));
        self::assertNotNull($cover);

        $this->as($this->owner, 'DELETE', $this->coverPath());

        self::assertSame(200, $this->statusCode());
        self::assertNull($this->cover($this->last()));
        foreach ($cover['sizes'] as $size) {
            self::assertSame(404, $this->statusOf($size['url']));
        }
    }

    /** Pausing is how somebody gets time to fix things, so the cover still changes (sc-3586). */
    #[Test]
    public function aPausedEventsCoverIsChanged(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50]);
        self::assertSame(200, $this->statusCode());
        self::service(Connection::class)->executeStatement("UPDATE events SET status = 'paused' WHERE id = :id", ['id' => $this->eventId]);

        $this->as($this->owner, 'PUT', $this->coverPath(), ['position' => 10]);

        self::assertSame(200, $this->statusCode());
        self::assertSame(10, $this->cover($this->as($this->owner, 'GET', '/api/events/' . $this->eventId))['position'] ?? null);
    }

    #[Test]
    public function aNewPhotoDeletesTheOneItReplaces(): void
    {
        $first = $this->cover($this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50]));
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1700, 1000), 'image/jpeg'), 'position' => 50]);

        self::assertNotNull($first);
        self::assertSame(404, $this->statusOf($first['sizes'][0]['url']));
    }

    #[Test]
    public function onlySomeoneWhoManagesEventsChangesTheCover(): void
    {
        $reader = $this->member('reader@ire.events', SeededRole::ReadOnly);

        $this->as($reader, 'POST', $this->path('event-cover-uploads'), ['contentType' => 'image/jpeg', 'size' => 1000, 'filename' => 'photo.jpg']);
        self::assertSame(403, $this->statusCode());

        $this->as($reader, 'PUT', $this->coverPath(), ['position' => 50]);
        self::assertSame(403, $this->statusCode());

        $this->as($reader, 'DELETE', $this->coverPath());
        self::assertSame(403, $this->statusCode());

        $this->as($reader, 'DELETE', $this->path('event-cover-uploads'), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg')]);
        self::assertSame(403, $this->statusCode());

        $this->as($reader, 'POST', $this->path('event-cover-uploads/preview'), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg')]);
        self::assertSame(403, $this->statusCode());

        $coordinator = $this->member('coordinator@ire.events', SeededRole::Coordinator);
        $this->as($coordinator, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aChangeAndARemovalAreInTheAuditLog(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 40, 'description' => 'The arch']);
        $this->as($this->owner, 'DELETE', $this->coverPath());

        $changed = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventCoverEditor::CHANGED, 'subjectType' => 'Event']);
        $removed = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventCoverEditor::REMOVED, 'subjectType' => 'Event']);

        self::assertInstanceOf(AuditEntry::class, $changed);
        self::assertSame([null, 40], $changed->getChanges()['position'] ?? null);
        self::assertSame([null, 'The arch'], $changed->getChanges()['description'] ?? null);
        self::assertInstanceOf(AuditEntry::class, $removed);
        self::assertSame([40, null], $removed->getChanges()['position'] ?? null);
    }

    #[Test]
    public function aCoverDoesNotMoveTheEventsVersion(): void
    {
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        $tag = $this->client->getResponse()->headers->get('ETag');

        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50]);
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);

        self::assertSame($tag, $this->client->getResponse()->headers->get('ETag'));
    }

    #[Test]
    public function theListCarriesEachEventsCover(): void
    {
        $this->as($this->owner, 'PUT', $this->coverPath(), ['uploadKey' => $this->upload(self::photo(1600, 900), 'image/jpeg'), 'position' => 50]);

        $listed = Type\vec(Type\shape(['cover' => Type\nullable(Type\shape(['position' => Type\int()], true))], true))->coerce($this->as($this->owner, 'GET', $this->path('events'))['events'] ?? null);

        self::assertSame(50, $listed[0]['cover']['position'] ?? null);
    }

    private function upload(string $bytes, string $contentType, ?int $declaredSize = null): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('event-cover-uploads'), ['contentType' => $contentType, 'size' => $declaredSize ?? Str\Byte\length($bytes), 'filename' => 'photo']);
        self::assertSame(201, $this->statusCode());
        $upload = Type\shape(['url' => Type\string(), 'key' => Type\string()], true)->coerce($body['upload'] ?? null);

        $handle = \curl_init(self::insideTheNetwork($upload['url']));
        \curl_setopt_array($handle, [
            \CURLOPT_CUSTOMREQUEST => 'PUT',
            \CURLOPT_POSTFIELDS => $bytes,
            \CURLOPT_HTTPHEADER => ['Content-Type: ' . $contentType],
            \CURLOPT_RETURNTRANSFER => true,
            \CURLOPT_TIMEOUT => 30,
        ]);
        \curl_exec($handle);
        self::assertSame(200, \curl_getinfo($handle, \CURLINFO_HTTP_CODE));

        return $upload['key'];
    }

    private function fetch(string $url): string
    {
        $handle = \curl_init(self::insideTheNetwork($url));
        \curl_setopt_array($handle, [\CURLOPT_RETURNTRANSFER => true, \CURLOPT_TIMEOUT => 10]);
        $body = \curl_exec($handle);
        self::assertSame(200, \curl_getinfo($handle, \CURLINFO_HTTP_CODE));

        return Type\string()->assert($body);
    }

    private function statusOf(string $url): int
    {
        $handle = \curl_init(self::insideTheNetwork($url));
        \curl_setopt_array($handle, [\CURLOPT_NOBODY => true, \CURLOPT_RETURNTRANSFER => true, \CURLOPT_TIMEOUT => 10]);
        \curl_exec($handle);

        return (int) \curl_getinfo($handle, \CURLINFO_HTTP_CODE);
    }

    /** A URL names the store as a browser reaches it; this test reaches it inside the compose network. */
    private static function insideTheNetwork(string $url): string
    {
        $parts = Type\shape(['path' => Type\string(), 'query' => Type\optional(Type\string())], true)->coerce(\parse_url($url));

        return 'http://storage:4566' . $parts['path'] . (isset($parts['query']) ? '?' . $parts['query'] : '');
    }

    private static function photo(int $width, int $height, bool $withGps = false, string $format = 'jpeg'): string
    {
        $image = new Imagick();
        $image->newImage($width, $height, 'skyblue');
        $image->setImageFormat($format);

        if ($withGps) {
            $image->profileImage('exif', self::exifWithGps());
        }

        return $image->getImageBlob();
    }

    private static function read(string $bytes): Imagick
    {
        $image = new Imagick();
        $image->readImageBlob($bytes);

        return $image;
    }

    private static function exifWithGps(): string
    {
        $short = static fn (int $value): string => \pack('v', $value);
        $long = static fn (int $value): string => \pack('V', $value);

        return "Exif\0\0"
            . 'II' . $short(42) . $long(8)
            . $short(1) . $short(0x8825) . $short(4) . $long(1) . $long(26) . $long(0)
            . $short(2)
            . $short(1) . $short(2) . $long(2) . "N\0\0\0"
            . $short(2) . $short(5) . $long(3) . $long(56)
            . $long(0)
            . $long(51) . $long(1) . $long(30) . $long(1) . $long(0) . $long(1);
    }

    private function coverPath(): string
    {
        return '/api/events/' . $this->eventId . '/cover';
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}
     */
    private function cover(array $body): ?array
    {
        return Type\nullable(Type\shape([
            'position' => Type\int(),
            'description' => Type\nullable(Type\string()),
            'sizes' => Type\vec(Type\shape(['width' => Type\int(), 'url' => Type\string()])),
        ]))->coerce(Type\shape(['cover' => Type\mixed()], true)->coerce($body['event'] ?? null)['cover']);
    }

    /** @return array<string, string> */
    private function violations(): array
    {
        $found = [];

        foreach (Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []) as $violation) {
            $found[$violation['propertyPath']] = $violation['message'];
        }

        return $found;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/' . $rest;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
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
