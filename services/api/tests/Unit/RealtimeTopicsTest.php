<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use FilesystemIterator;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;
use Symfony\Component\Mercure\Jwt\StaticTokenProvider;
use Symfony\Component\Mercure\MockHub;
use Symfony\Component\Mercure\Update;

/** Every topic published is one RealtimeTopic declares, and only RealtimePublisher reaches the hub (sc-3980). */
final class RealtimeTopicsTest extends TestCase
{
    #[Test]
    public function eachTopicTakesOneIdAndNoTwoAreTheSame(): void
    {
        foreach (RealtimeTopic::cases() as $topic) {
            self::assertCount(2, Str\split($topic->value, '{id}'), $topic->name . ' must take exactly one {id}');
            self::assertTrue(Regex\matches($topic->value, '#^[a-z]+/\{id\}(/[a-z-]+)*$#'), $topic->name . ' is not a path of lowercase segments');
        }

        $values = Vec\map(RealtimeTopic::cases(), static fn (RealtimeTopic $topic): string => $topic->value);
        self::assertSame($values, Vec\unique($values));
    }

    #[Test]
    public function aMembersNotificationsTopicNamesThatMember(): void
    {
        self::assertSame('users/0199d4a2-7b1e-7c3a-9f00-1a2b3c4d5e6f/notifications', RealtimeTopic::UserNotifications->for('0199d4a2-7b1e-7c3a-9f00-1a2b3c4d5e6f'));
    }

    #[Test]
    public function aPublishedUpdateIsPrivateAndOnItsDeclaredTopic(): void
    {
        $published = [];
        $hub = new MockHub('http://mercure/.well-known/mercure', new StaticTokenProvider('token'), static function (Update $update) use (&$published): string {
            $published[] = $update;

            return 'id';
        });

        new RealtimePublisher($hub)->publish(RealtimeTopic::UserNotifications, 'someone', ['unread' => 3]);

        self::assertCount(1, $published);
        self::assertSame(['users/someone/notifications'], $published[0]->getTopics());
        self::assertTrue($published[0]->isPrivate(), 'A public update reaches every subscriber, whatever their token says');
        self::assertSame('{"unread":3}', $published[0]->getData());
    }

    #[Test]
    public function nothingButThePublisherReachesTheHub(): void
    {
        $offenders = [];

        foreach ($this->sourceFiles() as $relative => $contents) {
            if ('Realtime/RealtimePublisher.php' === $relative) {
                continue;
            }

            // API Platform publishes a resource marked `mercure:` on its IRI, a topic RealtimeTopic never declared.
            if (Str\contains($contents, 'Symfony\\Component\\Mercure\\') || Regex\matches($contents, '/\bmercure\s*:/')) {
                $offenders[] = $relative;
            }
        }

        self::assertSame([], $offenders, "Publish through App\\Realtime\\RealtimePublisher, on a topic App\\Enum\\RealtimeTopic declares:\n" . Str\join($offenders, "\n"));
    }

    /** @return array<string, string> */
    private function sourceFiles(): array
    {
        $src = \dirname(__DIR__, 2) . '/src';
        $files = [];

        /** @var SplFileInfo $file */
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS)) as $file) {
            if ('php' === $file->getExtension()) {
                $contents = \file_get_contents($file->getPathname());
                self::assertIsString($contents);
                $files[Str\strip_prefix($file->getPathname(), $src . '/')] = $contents;
            }
        }

        self::assertFalse(Iter\is_empty($files));

        return $files;
    }
}
