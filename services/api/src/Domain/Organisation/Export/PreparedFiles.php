<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Export;

use App\Entity\PreparedFile;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Storage\ObjectStore;
use Psl\Filesystem;
use Psl\Str;
use Psr\Clock\ClockInterface;
use RuntimeException;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** How a PreparedFile is written, kept, refused and handed over; neither the file nor its download is ever held in memory whole. */
final readonly class PreparedFiles
{
    private const array REFUSED = ['/' => '-', '\\' => '-', ':' => '-', '*' => '-', '?' => '-', '<' => '-', '>' => '-', '|' => '-', '"' => ''];

    public function __construct(
        private ObjectStore $objectStore,
        private ClockInterface $clock,
    ) {
    }

    /** @param callable(resource): void $write fills the temporary file the kept one is uploaded from */
    public function keep(string $key, string $contentType, callable $write): void
    {
        $this->keepAt($key, $contentType, static function (string $path) use ($write): void {
            $file = \fopen($path, 'wb') ?: throw new RuntimeException('No temporary file for a prepared file.');

            try {
                $write($file);
            } finally {
                \fclose($file);
            }
        });
    }

    /** @param callable(string): void $write writes the file at the temporary path given, which is uploaded from where it stands */
    public function keepAt(string $key, string $contentType, callable $write): void
    {
        $path = Filesystem\create_temporary_file(prefix: 'prepared-file-');

        try {
            $write($path);
            $file = \fopen($path, 'rb') ?: throw new RuntimeException('The prepared file could not be read back.');

            try {
                $this->objectStore->keepFile($key, $file, $contentType);
            } finally {
                \fclose($file);
            }
        } finally {
            Filesystem\delete_file($path);
        }
    }

    public function discard(string $key): void
    {
        $this->objectStore->discardKept($key);
    }

    /**
     * Anyone but the person who asked is told it isn't there, and nothing is given before the file is ready.
     *
     * @template T of PreparedFile
     *
     * @param T|null $file
     *
     * @return T
     */
    public function ready(?PreparedFile $file, User $by): PreparedFile
    {
        if (null === $file || !$file->isAskedBy($by)) {
            throw ApiException::notFound('access.not_found');
        }

        if (!$file->isReady() || null === $file->getFileKey() || null === $file->expiresAt()) {
            throw new ApiException(ErrorCode::ExportNotReady, 'organisation.export_not_ready');
        }

        return $file;
    }

    public function unexpired(PreparedFile $file, string $expired): void
    {
        $expiresAt = $file->expiresAt();

        if (null === $expiresAt || $this->clock->now() >= $expiresAt) {
            throw new ApiException(ErrorCode::ExportExpired, $expired);
        }
    }

    /** @return iterable<string> the kept file in pieces; asking for it already fails for a file that is not kept */
    public function chunks(PreparedFile $file): iterable
    {
        return $this->objectStore->streamKept($file->getFileKey() ?? throw new RuntimeException('The prepared file has no key.'));
    }

    /** @param iterable<string> $chunks */
    public function response(iterable $chunks, string $contentType, string $name, string $fallback): StreamedResponse
    {
        $response = new StreamedResponse(static function () use ($chunks): void {
            $output = \fopen('php://output', 'wb') ?: throw new RuntimeException('No output for a prepared file.');

            foreach ($chunks as $chunk) {
                \fwrite($output, $chunk);
                \flush();
            }

            \fclose($output);
        });
        $response->headers->add(self::headers($contentType, $name, $fallback));

        return $response;
    }

    /** @return array<string, string> a download named as given, with each character a common file system refuses read as a dash, and each quote taken out */
    public static function headers(string $contentType, string $name, string $fallback): array
    {
        return [
            'Content-Type' => $contentType,
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, Str\replace_every($name, self::REFUSED), $fallback),
            'Cache-Control' => 'no-store',
        ];
    }
}
