<?php

declare(strict_types=1);

namespace App\Storage;

/**
 * Everything a client needs to upload, and nothing it needs to be trusted with.
 *
 * maxBytes is advisory here — it lets a client refuse a too-large file before
 * spending somebody's data allowance on it. The store enforces the real limit,
 * because a limit only the client checks is not a limit.
 */
final readonly class SignedUpload
{
    public function __construct(
        public string $url,
        public string $key,
        public string $bucket,
        public int $expiresInSeconds,
        public int $maxBytes,
        public string $contentType,
    ) {
    }

    /** @return array<string, string|int> */
    public function toArray(): array
    {
        return [
            'url' => $this->url,
            'key' => $this->key,
            'bucket' => $this->bucket,
            'expires_in' => $this->expiresInSeconds,
            'max_bytes' => $this->maxBytes,
            'content_type' => $this->contentType,
        ];
    }
}
