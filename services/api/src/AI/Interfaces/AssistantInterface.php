<?php

declare(strict_types=1);

namespace App\AI\Interfaces;

use App\AI\Exception\AssistantFailed;
use App\AI\Exception\AssistantRefused;
use App\AI\Exception\AssistantUnavailable;
use App\AI\Model\Answer;
use App\AI\Model\Ask;

interface AssistantInterface
{
    public function isEnabled(): bool;

    public function provider(): string;

    public function model(): string;

    /**
     * @throws AssistantUnavailable the provider is busy or unreachable; the
     * @throws AssistantRefused     the model declined; trying again will not help
     * @throws AssistantFailed      anything else, which is ours to fix
     */
    public function chat(Ask $ask): Answer;
}
