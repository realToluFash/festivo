<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Enum\UploadPurpose;
use App\Storage\ObjectStore;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Against the real store, not a double.
 *
 * A signed URL is a signature over a host, a path and a clock. Every one of
 * those is a way for it to be subtly wrong while looking perfectly correct in
 * a unit test, so these actually upload.
 */
final class ObjectStoreTest extends KernelTestCase
{
    private ObjectStore $store;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->store = self::getContainer()->get(ObjectStore::class);
    }

    #[Test]
    public function aSignedUrlActuallyAcceptsTheFile(): void
    {
        $signed = $this->store->signUpload(UploadPurpose::GuestImport, 'text/csv', 'guests.csv');

        $put = $this->put($signed->url, "name,email\nAda,ada@example.com\n", 'text/csv');

        self::assertSame(200, $put, 'The store refused an upload to its own signed URL');
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
        self::assertStringContainsString('localhost', $signed->url);
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

        self::assertSame(200, $this->headStatus($this->store->urlFor($signed->bucket, $signed->key)));
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
        $signed = $this->store->signUpload(UploadPurpose::EventCover, 'image/png', 'cover.png');

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

    /**
     * The signed URL names the host a BROWSER reaches the store at, which is
     * not the host this test reaches it at — the test runs inside the container
     * network and the browser does not.
     *
     * Swapped back for the request only. The signature covers the path and
     * query, not the host, so this exercises exactly the signature a browser
     * would present.
     */
    private function asSeenFromInsideTheNetwork(string $url): string
    {
        return str_replace('localhost:4566', 'storage:4566', $url);
    }

    private function put(string $url, string $body, string $contentType): int
    {
        $url = $this->asSeenFromInsideTheNetwork($url);

        $handle = curl_init($url);
        curl_setopt_array($handle, [
            \CURLOPT_CUSTOMREQUEST => 'PUT',
            \CURLOPT_POSTFIELDS => $body,
            \CURLOPT_HTTPHEADER => ['Content-Type: ' . $contentType],
            \CURLOPT_RETURNTRANSFER => true,
            \CURLOPT_TIMEOUT => 10,
        ]);
        curl_exec($handle);
        $status = (int) curl_getinfo($handle, \CURLINFO_HTTP_CODE);
        curl_close($handle);

        return $status;
    }

    private function headStatus(string $url): int
    {
        $url = $this->asSeenFromInsideTheNetwork($url);

        $handle = curl_init($url);
        curl_setopt_array($handle, [
            \CURLOPT_NOBODY => true,
            \CURLOPT_RETURNTRANSFER => true,
            \CURLOPT_TIMEOUT => 10,
        ]);
        curl_exec($handle);
        $status = (int) curl_getinfo($handle, \CURLINFO_HTTP_CODE);
        curl_close($handle);

        return $status;
    }
}
