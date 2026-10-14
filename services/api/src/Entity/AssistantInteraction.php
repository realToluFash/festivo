<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\Actor;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
#[ORM\Table(name: 'assistant_interactions')]
#[ORM\Index(name: 'idx_assistant_occurred', columns: ['occurred_at'])]
#[ORM\Index(name: 'idx_assistant_actor', columns: ['actor_type', 'actor_id'])]
#[ORM\Index(name: 'idx_assistant_session', columns: ['session_id'])]

#[ORM\Index(name: 'idx_assistant_feature', columns: ['usage_feature', 'occurred_at'])]
class AssistantInteraction
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $occurredAt;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: Actor::class)]
    private Actor $actorType;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $actorId;

    #[ORM\Column(type: Types::STRING, length: 180, nullable: true)]
    private ?string $actorLabel;

    #[ORM\Column(type: Types::STRING, length: 64, nullable: true)]
    private ?string $sessionId;

    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $context;

    #[ORM\Column(type: Types::STRING, length: 60)]
    private string $usageFeature;

    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $provider;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $model;

    #[ORM\Column(type: Types::STRING, length: 8)]
    private string $locale;

    #[ORM\Column(type: Types::STRING, length: 20)]
    private string $outcome;

    #[ORM\Column(type: Types::TEXT)]
    private string $systemPrompt;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $userPrompt;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $resourceContext;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $toolsOffered;

    #[ORM\Column(type: Types::STRING, length: 80, nullable: true)]
    private ?string $toolCalled;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $response;

    #[ORM\Column(type: Types::INTEGER)]
    private int $inputTokens;

    #[ORM\Column(type: Types::INTEGER)]
    private int $outputTokens;

    /** @param list<string> $toolsOffered */
    public function __construct(
        Actor $actorType,
        ?Uuid $actorId,
        ?string $actorLabel,
        ?string $sessionId,
        string $context,
        string $usageFeature,
        string $provider,
        string $model,
        string $locale,
        string $outcome,
        string $systemPrompt,
        ?string $userPrompt,
        ?string $resourceContext,
        array $toolsOffered,
        ?string $toolCalled = null,
        ?string $response = null,
        int $inputTokens = 0,
        int $outputTokens = 0,
    ) {
        $this->id = Uuid::v7();
        $this->occurredAt = new DateTimeImmutable();
        $this->actorType = $actorType;
        $this->actorId = $actorId;
        $this->actorLabel = $actorLabel;
        $this->sessionId = $sessionId;
        $this->context = $context;
        $this->usageFeature = $usageFeature;
        $this->provider = $provider;
        $this->model = $model;
        $this->locale = $locale;
        $this->outcome = $outcome;
        $this->systemPrompt = $systemPrompt;
        $this->userPrompt = $userPrompt;
        $this->resourceContext = $resourceContext;
        $this->toolsOffered = $toolsOffered;
        $this->toolCalled = $toolCalled;
        $this->response = $response;
        $this->inputTokens = $inputTokens;
        $this->outputTokens = $outputTokens;
    }

    public function id(): Uuid
    {
        return $this->id;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function actorType(): Actor
    {
        return $this->actorType;
    }

    public function sessionId(): ?string
    {
        return $this->sessionId;
    }

    public function context(): string
    {
        return $this->context;
    }

    public function usageFeature(): string
    {
        return $this->usageFeature;
    }

    public function provider(): string
    {
        return $this->provider;
    }

    public function model(): string
    {
        return $this->model;
    }

    public function locale(): string
    {
        return $this->locale;
    }

    public function outcome(): string
    {
        return $this->outcome;
    }

    public function systemPrompt(): string
    {
        return $this->systemPrompt;
    }

    public function userPrompt(): ?string
    {
        return $this->userPrompt;
    }

    public function resourceContext(): ?string
    {
        return $this->resourceContext;
    }

    /** @return list<string> */
    public function toolsOffered(): array
    {
        return $this->toolsOffered;
    }

    public function toolCalled(): ?string
    {
        return $this->toolCalled;
    }

    public function response(): ?string
    {
        return $this->response;
    }

    public function inputTokens(): int
    {
        return $this->inputTokens;
    }

    public function outputTokens(): int
    {
        return $this->outputTokens;
    }
}
