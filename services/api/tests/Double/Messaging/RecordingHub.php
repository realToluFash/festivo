<?php

declare(strict_types=1);

namespace App\Tests\Double\Messaging;

use Psl\Iter;
use RuntimeException;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Jwt\TokenFactoryInterface;
use Symfony\Component\Mercure\ProtocolVersion;
use Symfony\Component\Mercure\Update;

/** The suite never reaches the hub container; this keeps what would have been published. */
final class RecordingHub implements HubInterface
{
    /** @var list<Update> */
    public array $published = [];

    public int $failuresLeft = 0;

    public function getUrl(): string
    {
        return 'http://mercure.test/.well-known/mercure';
    }

    public function getPublicUrl(): string
    {
        return $this->getUrl();
    }

    public function getFactory(): ?TokenFactoryInterface
    {
        return null;
    }

    public function publish(Update $update): string
    {
        if ($this->failuresLeft > 0) {
            --$this->failuresLeft;

            throw new RuntimeException('the hub is down');
        }

        $this->published[] = $update;

        return 'urn:uuid:' . Iter\count($this->published);
    }

    public function getProtocolVersion(): ProtocolVersion
    {
        return ProtocolVersion::Legacy;
    }

    public function getCookieName(): string
    {
        return 'mercureAuthorization';
    }
}
