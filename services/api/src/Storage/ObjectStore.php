<?php

declare(strict_types=1);

namespace App\Storage;

use AsyncAws\S3\S3Client;
use DateTimeImmutable;
use InvalidArgumentException;
use Symfony\Component\Uid\Uuid;

/**
 * Signed URLs, so bytes never pass through the API.
 *
 * A fifteen-megabyte guest list uploaded through PHP occupies a worker for the
 * duration of somebody's hotel wifi. The client uploads straight to the store;
 * the API only ever says where, and for how long.
 */
final readonly class ObjectStore
{
    public function __construct(
        private S3Client $s3,
        private string $privateBucket,
        private string $publicBucket,
        private string $publicEndpoint,
        private int $uploadTtlSeconds = 900,
        private int $downloadTtlSeconds = 300,
    ) {
    }

    /**
     * Where to PUT a file, and what it will be called.
     *
     * The key is generated here, never taken from the client. A client-supplied
     * key is a path traversal and an overwrite of somebody else's object.
     */
    public function signUpload(UploadPurpose $purpose, string $contentType, string $filename): SignedUpload
    {
        if (!$purpose->allows($contentType)) {
            throw new InvalidArgumentException(sprintf(
                '%s does not accept %s.',
                $purpose->value,
                $contentType,
            ));
        }

        $key = $this->key($purpose, $filename);
        $bucket = $purpose->isPublic() ? $this->publicBucket : $this->privateBucket;

        $request = $this->s3->presign(
            new \AsyncAws\S3\Input\PutObjectRequest([
                'Bucket' => $bucket,
                'Key' => $key,
                'ContentType' => $contentType,
            ]),
            new DateTimeImmutable(sprintf('+%d seconds', $this->uploadTtlSeconds)),
        );

        return new SignedUpload(
            url: $this->forBrowser($request),
            key: $key,
            bucket: $bucket,
            expiresInSeconds: $this->uploadTtlSeconds,
            maxBytes: $purpose->maxBytes(),
            contentType: $contentType,
        );
    }

    /**
     * A readable URL.
     *
     * Public objects are served directly and need no signature. Private ones
     * get a short-lived signed URL — short, because a URL that is valid for a
     * week is a credential that leaks into browser history and chat logs.
     */
    public function urlFor(string $bucket, string $key): string
    {
        if ($bucket === $this->publicBucket) {
            return sprintf('%s/%s/%s', rtrim($this->publicEndpoint, '/'), $bucket, $key);
        }

        $request = $this->s3->presign(
            new \AsyncAws\S3\Input\GetObjectRequest(['Bucket' => $bucket, 'Key' => $key]),
            new DateTimeImmutable(sprintf('+%d seconds', $this->downloadTtlSeconds)),
        );

        return $this->forBrowser($request);
    }

    public function delete(string $bucket, string $key): void
    {
        $this->s3->deleteObject(['Bucket' => $bucket, 'Key' => $key]);
    }

    public function exists(string $bucket, string $key): bool
    {
        return $this->s3->objectExists(['Bucket' => $bucket, 'Key' => $key])->isSuccess();
    }

    /**
     * A key the client cannot choose.
     *
     * Dated so an object's age is visible without a database, and prefixed by
     * purpose so a misplaced lifecycle rule cannot reach the wrong kind.
     */
    private function key(UploadPurpose $purpose, string $filename): string
    {
        $extension = strtolower(pathinfo($filename, \PATHINFO_EXTENSION));
        $extension = 1 === preg_match('/^[a-z0-9]{1,8}$/', $extension) ? '.' . $extension : '';

        return sprintf(
            '%s/%s/%s%s',
            $purpose->value,
            new DateTimeImmutable()->format('Y/m'),
            Uuid::v7()->toRfc4122(),
            $extension,
        );
    }

    /**
     * Rewrite the signed URL's host for a browser.
     *
     * The API signs against the in-network endpoint and the browser uploads
     * from the host, and locally those are different addresses. The signature
     * covers the path and query, not the host, so swapping it is safe — and
     * without it every signed URL points at a hostname no browser can resolve.
     */
    private function forBrowser(string $url): string
    {
        $internal = parse_url($this->s3->getConfiguration()->get('endpoint') ?: '', \PHP_URL_HOST);
        $public = rtrim($this->publicEndpoint, '/');

        if (null === $internal || '' === $public) {
            return $url;
        }

        $parts = parse_url($url);
        if (false === $parts || !isset($parts['path'])) {
            return $url;
        }

        return $public . $parts['path'] . (isset($parts['query']) ? '?' . $parts['query'] : '');
    }
}
