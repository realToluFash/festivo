<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\AI\Availability;
use App\AI\Exception\AssistantFailed;
use App\AI\Exception\AssistantRefused;
use App\AI\Exception\AssistantUnavailable;
use App\AI\Model\Ask;
use App\AI\Model\ToolDefinition;
use App\AI\Model\Turn;
use App\AI\ScriptedAssistant;
use App\Enum\AssistantContext;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * The stand-in, which is what makes every other assistant test possible.
 *
 * Its own tests matter because the rest of the suite trusts it: if `!busy`
 * stopped raising, the endpoint's busy path would pass while testing nothing.
 */
final class ScriptedAssistantTest extends TestCase
{
    /** Named so a recorded turn cannot be mistaken for a real one. */
    #[Test]
    public function itIdentifiesItselfAsTheStandIn(): void
    {
        self::assertSame('scripted', $this->assistant()->provider());
        self::assertSame('scripted', $this->assistant()->model());
    }

    #[Test]
    public function itAnswersWithTextThatNamesTheContextAndTheLanguage(): void
    {
        $answer = $this->assistant()->chat($this->ask('how many have replied?', locale: 'pt'));

        self::assertFalse($answer->isToolCall());
        self::assertStringContainsString('organiser', (string) $answer->text);
        self::assertStringContainsString('pt', (string) $answer->text);
        self::assertStringContainsString('how many have replied?', (string) $answer->text);
    }

    #[Test]
    public function theRefuseDirectiveRefuses(): void
    {
        $this->expectException(AssistantRefused::class);

        $this->assistant()->chat($this->ask('!refuse'));
    }

    #[Test]
    public function theBusyDirectiveIsUnavailableRatherThanFailed(): void
    {
        $this->expectException(AssistantUnavailable::class);

        $this->assistant()->chat($this->ask('!busy'));
    }

    #[Test]
    public function theFailDirectiveFails(): void
    {
        $this->expectException(AssistantFailed::class);

        $this->assistant()->chat($this->ask('!fail'));
    }

    #[Test]
    public function theToolDirectiveCallsTheFirstOfferedToolWithAFixedCallId(): void
    {
        $answer = $this->assistant()->chat($this->ask('!tool', tools: [
            new ToolDefinition('count_replies', 'Count RSVPs', []),
            new ToolDefinition('move_guest', 'Move a guest', []),
        ]));

        self::assertTrue($answer->isToolCall());
        self::assertSame('count_replies', $answer->toolCall?->name);
        // Fixed, so a test can assert the id that comes back on the result
        // without reading it out of the response first.
        self::assertNotNull($answer->toolCall);
        self::assertSame('scripted_call_1', $answer->toolCall->callId);
    }

    #[Test]
    public function theToolDirectiveCanNameWhichTool(): void
    {
        $answer = $this->assistant()->chat($this->ask('!tool move_guest', tools: [
            new ToolDefinition('count_replies', 'Count RSVPs', []),
            new ToolDefinition('move_guest', 'Move a guest', []),
        ]));

        self::assertSame('move_guest', $answer->toolCall?->name);
    }

    /**
     * Said plainly rather than answered with prose. A client asking for a tool
     * call and getting text would be debugging its own loop.
     */
    #[Test]
    public function askingForAToolThatWasNotOfferedSaysSo(): void
    {
        $this->expectException(AssistantFailed::class);
        $this->expectExceptionMessage('none named "nonexistent"');

        $this->assistant()->chat($this->ask('!tool nonexistent', tools: [
            new ToolDefinition('count_replies', 'Count RSVPs', []),
        ]));
    }

    #[Test]
    public function askingForAToolWhenNoneWereOfferedSaysThatInstead(): void
    {
        $this->expectExceptionMessage('offered none');

        $this->assistant()->chat($this->ask('!tool'));
    }

    /**
     * A directive is only a directive at the start of the message. Somebody
     * writing about one should get an answer, not the behaviour.
     */
    #[Test]
    public function aDirectiveMentionedMidSentenceIsJustText(): void
    {
        $answer = $this->assistant()->chat($this->ask('what does !refuse do?'));

        self::assertFalse($answer->isToolCall());
        self::assertNotNull($answer->text);
    }

    /**
     * A turn driven by a tool result has no user message to read, and must
     * still answer rather than tripping over the null.
     */
    #[Test]
    public function aTurnWithNoUserMessageStillAnswers(): void
    {
        $ask = new Ask(
            context: AssistantContext::Organiser,
            conversation: [Turn::toolResult('scripted_call_1', ['replied' => 42])],
        );

        self::assertStringContainsString('(nothing)', (string) $this->assistant()->chat($ask)->text);
    }

    private function assistant(): ScriptedAssistant
    {
        return new ScriptedAssistant(new Availability(Availability::STAND_IN, '', true));
    }

    /** @param list<ToolDefinition> $tools */
    private function ask(string $message, array $tools = [], string $locale = 'en'): Ask
    {
        return new Ask(
            context: AssistantContext::Organiser,
            conversation: [Turn::user($message)],
            tools: $tools,
            locale: $locale,
        );
    }
}
