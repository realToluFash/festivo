<?php

declare(strict_types=1);

namespace App\Storage;

use App\Enum\UploadPurpose;
use App\Storage\Model\SignedUpload;
use AsyncAws\S3\S3Client;
use DateTimeImmutable;
use InvalidArgumentException;
use Symfony\Component\Uid\Uuid;

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

    /** A scope, such as an organisation's id, starts the key, so a later request can check the key is its own. */
    public function signUpload(UploadPurpose $purpose, string $contentType, string $filename, ?string $scope = null): SignedUpload
    {
        if (!$purpose->allows($contentType)) {
            throw new InvalidArgumentException(\sprintf(
                '%s does not accept %s.',
                $purpose->value,
                $contentType,
            ));
        }

        $key = $this->key($purpose, $filename, $scope);
        $bucket = $this->bucketFor($purpose);

        $request = $this->s3->presign(
            new \AsyncAws\S3\Input\PutObjectRequest([
                'Bucket' => $bucket,
                'Key' => $key,
                'ContentType' => $contentType,
            ]),
            new DateTimeImmutable(\sprintf('+%d seconds', $this->uploadTtlSeconds)),
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

    public function urlFor(string $bucket, string $key): string
    {
        if ($bucket === $this->publicBucket) {
            return \sprintf('%s/%s/%s', \rtrim($this->publicEndpoint, '/'), $bucket, $key);
        }

        $request = $this->s3->presign(
            new \AsyncAws\S3\Input\GetObjectRequest(['Bucket' => $bucket, 'Key' => $key]),
            new DateTimeImmutable(\sprintf('+%d seconds', $this->downloadTtlSeconds)),
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

    /** A signed upload carries no length, so what arrived is measured before anything reads it. Null when nothing did. */
    public function uploadSize(UploadPurpose $purpose, string $key): ?int
    {
        $bucket = $this->bucketFor($purpose);

        if (!$this->exists($bucket, $key)) {
            return null;
        }

        return (int) $this->s3->headObject(['Bucket' => $bucket, 'Key' => $key])->getContentLength();
    }

    public function readUpload(UploadPurpose $purpose, string $key): string
    {
        return $this->s3->getObject(['Bucket' => $this->bucketFor($purpose), 'Key' => $key])->getBody()->getContentAsString();
    }

    public function deleteUpload(UploadPurpose $purpose, string $key): void
    {
        $this->delete($this->bucketFor($purpose), $key);
    }

    /** Written by the server, readable by anyone at publicUrl(). */
    public function publish(string $key, string $bytes, string $contentType): void
    {
        $this->s3->putObject(['Bucket' => $this->publicBucket, 'Key' => $key, 'Body' => $bytes, 'ContentType' => $contentType]);
    }

    public function copyPublished(string $from, string $to): void
    {
        $this->s3->copyObject(['Bucket' => $this->publicBucket, 'Key' => $to, 'CopySource' => $this->publicBucket . '/' . $from]);
    }

    public function unpublish(string $key): void
    {
        $this->delete($this->publicBucket, $key);
    }

    public function publicUrl(string $key): string
    {
        return $this->urlFor($this->publicBucket, $key);
    }

    private function bucketFor(UploadPurpose $purpose): string
    {
        return $purpose->isPublic() ? $this->publicBucket : $this->privateBucket;
    }

    private function key(UploadPurpose $purpose, string $filename, ?string $scope): string
    {
        $extension = \strtolower(\pathinfo($filename, \PATHINFO_EXTENSION));
        $extension = 1 === \preg_match('/^[a-z0-9]{1,8}$/', $extension) ? '.' . $extension : '';

        return \sprintf(
            '%s/%s%s/%s%s',
            $purpose->value,
            null === $scope ? '' : $scope . '/',
            new DateTimeImmutable()->format('Y/m'),
            Uuid::v7()->toRfc4122(),
            $extension,
        );
    }

    private function forBrowser(string $url): string
    {
        $internal = \parse_url($this->s3->getConfiguration()->get('endpoint') ?: '', \PHP_URL_HOST);
        $public = \rtrim($this->publicEndpoint, '/');

        if (null === $internal || '' === $public) {
            return $url;
        }

        $parts = \parse_url($url);
        if (false === $parts || !isset($parts['path'])) {
            return $url;
        }

        return $public . $parts['path'] . (isset($parts['query']) ? '?' . $parts['query'] : '');
    }
}
