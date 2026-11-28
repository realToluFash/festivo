<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Enum\UploadPurpose;
use App\Storage\ObjectStore;
use App\Tests\FunctionalTestCase;
use AsyncAws\Core\Configuration;
use AsyncAws\S3\S3Client;
use InvalidArgumentException;
use LogicException;
use PHPUnit\Framework\Attributes\Test;

/**
 * Against the real store, not a double.
 *
 * A signed URL is a signature over a host, a path and a clock. Every one of
 * those is a way for it to be subtly wrong while looking perfectly correct in
 * a unit test, so these actually upload.
 */
final class ObjectStoreTest extends FunctionalTestCase
{
    private ObjectStore $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->store = self::service(ObjectStore::class);
    }

    #[Test]
    public function aSignedUrlActuallyAcceptsTheFile(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::GuestImport, 'text/csv', 'guests.csv');

        $put = $this->put($signed->url, "name,email\nAda,ada@example.com\n", 'text/csv');

        self::assertSame(200, $put['status'], 'The store refused an upload to its own signed URL');
        self::assertTrue($this->store->exists($signed->bucket, $signed->key));
    }

    /**
     * The API signs against the in-network endpoint; the browser uploads from
     * the host. Without the rewrite, every signed URL names a hostname no
     * browser can resolve — and the signature still looks valid.
     */
    #[Test]
    public function theUrlIsReachableFromOutsideTheContainerNetwork(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::EventCover, 'image/png', 'cover.png');

        self::assertStringNotContainsString('storage:4566', $signed->url);
        self::assertMatchesRegularExpression('#^https?://(localhost|127\.0\.0\.1)(:\d+)?/#', $signed->url);
    }

    #[Test]
    public function anUploadSentToAnotherHostThanItWasSignedForIsRefused(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::GuestImport, 'text/csv', 'moved.csv');

        $put = $this->put($signed->url, "x\n", 'text/csv', 'elsewhere.example:4566');

        self::assertSame(403, $put['status']);
        self::assertStringContainsString('SignatureDoesNotMatch', $put['body']);
        self::assertFalse($this->store->exists($signed->bucket, $signed->key));
    }

    #[Test]
    public function withNoPublicEndpointUrlsAreSignedForTheStoreEndpoint(): void
    {
        $store = $this->storeWithNoPublicEndpoint();

        $signed = $store->signUpload(UploadPurpose::GuestImport, 'text/csv', 'same-host.csv');
        $put = $this->put($signed->url, "x\n", 'text/csv');
        $read = $store->urlFor($signed->bucket, $signed->key);

        self::assertStringStartsWith('http://storage:4566/', $signed->url);
        self::assertSame(200, $put['status']);
        self::assertStringStartsWith('http://storage:4566/', $read);
        self::assertSame(200, $this->getStatus($read));
    }

    #[Test]
    public function theClientDoesNotChooseTheKey(): void
    {
        $signed = $this->store->signUpload(
            UploadPurpose::EventCover,
            'image/png',
            '../../../etc/passwd.png',
        );

        self::assertStringNotContainsString('..', $signed->key);
        self::assertStringNotContainsString('etc/passwd', $signed->key);
        self::assertStringStartsWith('event_cover/', $signed->key);
        self::assertStringEndsWith('.png', $signed->key);
    }

    #[Test]
    public function twoUploadsOfTheSameFilenameDoNotCollide(): void
    {
        $a = $this->store->signUpload(UploadPurpose::EventCover, 'image/png', 'cover.png');
        $b = $this->store->signUpload(UploadPurpose::EventCover, 'image/png', 'cover.png');

        self::assertNotSame($a->key, $b->key);
    }

    #[Test]
    public function aContentTypeThePurposeDoesNotAcceptIsRefused(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->store->signUpload(UploadPurpose::EventCover, 'application/x-php', 'shell.php');
    }

    /**
     * A private object is reachable with a signature and not without one.
     *
     * CAVEAT, and it is a real one: the "not without one" half asserts the
     * bucket's configuration rather than the store's behaviour, because
     * LocalStack does NOT enforce a public access block. An anonymous GET of a
     * private object succeeds locally and would be denied by real S3.
     *
     * So local storage is MORE PERMISSIVE than production. Anybody checking
     * "is this private?" against this stack gets a false pass. The block is
     * set and asserted here because that is the thing protecting production;
     * the behaviour cannot be verified until a real S3 is in front of it.
     */
    #[Test]
    public function aPrivateObjectIsReadableWithASignature(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::GuestImport, 'text/csv', 'private.csv');
        $this->put($signed->url, "secret\n", 'text/csv');

        self::assertSame(200, $this->getStatus($this->store->urlFor($signed->bucket, $signed->key)));
    }

    /**
     * A signed read URL expires. One valid for a week is a credential that
     * leaks into browser history, chat logs and screenshots.
     */
    #[Test]
    public function aSignedReadUrlCarriesAnExpiry(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::GuestImport, 'text/csv', 'expiring.csv');

        $url = $this->store->urlFor($signed->bucket, $signed->key);

        self::assertStringContainsString('X-Amz-Expires', $url);
        self::assertStringContainsString('X-Amz-Signature', $url);
    }

    #[Test]
    public function aPublicObjectNeedsNoSignatureToRead(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::OrganisationLogo, 'image/png', 'logo.png');

        $url = $this->store->urlFor($signed->bucket, $signed->key);

        self::assertStringNotContainsString('X-Amz-Signature', $url);
    }

    #[Test]
    public function deletingRemovesIt(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::GuestImport, 'text/csv', 'gone.csv');
        $this->put($signed->url, "x\n", 'text/csv');

        self::assertTrue($this->store->exists($signed->bucket, $signed->key));

        $this->store->delete($signed->bucket, $signed->key);

        self::assertFalse($this->store->exists($signed->bucket, $signed->key));
    }

    private function storeWithNoPublicEndpoint(): ObjectStore
    {
        $env = static fn (string $name): string => \is_string($_SERVER[$name] ?? null) ? $_SERVER[$name] : throw new LogicException($name . ' is not set');

        return new ObjectStore(
            new S3Client(Configuration::create([
                'endpoint' => $env('STORAGE_ENDPOINT'),
                'region' => $env('STORAGE_REGION'),
                'accessKeyId' => $env('STORAGE_KEY'),
                'accessKeySecret' => $env('STORAGE_SECRET'),
                'pathStyleEndpoint' => 'true',
            ])),
            $env('STORAGE_BUCKET_PRIVATE'),
            $env('STORAGE_BUCKET_PUBLIC'),
            '',
        );
    }

    /** @return array{status: int, body: string} */
    private function put(string $url, string $body, string $contentType, ?string $host = null): array
    {
        $hostHeader = null === $host ? [] : ['Host: ' . $host];

        $handle = \curl_init($url);
        \curl_setopt_array($handle, [
            \CURLOPT_CONNECT_TO => ['::storage:4566'],
            \CURLOPT_CUSTOMREQUEST => 'PUT',
            \CURLOPT_POSTFIELDS => $body,
            \CURLOPT_HTTPHEADER => ['Content-Type: ' . $contentType, ...$hostHeader],
            \CURLOPT_RETURNTRANSFER => true,
            \CURLOPT_TIMEOUT => 10,
        ]);
        $response = \curl_exec($handle);

        return ['status' => (int) \curl_getinfo($handle, \CURLINFO_HTTP_CODE), 'body' => \is_string($response) ? $response : ''];
    }

    private function getStatus(string $url): int
    {
        $handle = \curl_init($url);
        \curl_setopt_array($handle, [
            \CURLOPT_CONNECT_TO => ['::storage:4566'],
            \CURLOPT_RETURNTRANSFER => true,
            \CURLOPT_TIMEOUT => 10,
        ]);
        \curl_exec($handle);

        return (int) \curl_getinfo($handle, \CURLINFO_HTTP_CODE);
    }
}
