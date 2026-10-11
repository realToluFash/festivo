<?php

declare(strict_types=1);

namespace App\Assistant;

use RuntimeException;

/**
 * The model declined to answer.
 *
 * Its own outcome rather than a flavour of failure. It is not an outage, so
 * telling the organiser to try again wastes their time; it is not our bug, so
 * reporting it as one buries the real ones. The only honest thing to say is
 * that the assistant would not answer this.
 */
final class AssistantRefused extends RuntimeException
{
}
