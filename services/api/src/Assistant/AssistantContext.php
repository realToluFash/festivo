<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * What the assistant is being asked to help with.
 *
 * The named context is how a client selects a system prompt WITHOUT being able
 * to supply one. It sends `organiser`; the prompt it gets is this file's.
 *
 * There is one case here on purpose. Foundation owns the transport, and a
 * context is a product decision belonging to the feature it assists — seating,
 * the run of show, a support reply. Each arrives with its own story, as a case
 * here plus its prompt, and needs no change to anything else.
 *
 * The prompts live on the enum rather than in the database because a prompt is
 * code: it is reviewed, it is versioned with the tools it assumes, and a prompt
 * editable at runtime is a behaviour change with no diff. When somebody needs to
 * tune one without a deploy, that is a story about an override, and the default
 * still belongs here.
 */
enum AssistantContext: string
{
    case Organiser = 'organiser';

    /**
     * Resolved here, never accepted from a request.
     *
     * Kept free of anything that varies within a day — no timestamps, no names
     * — because this is the cached prefix of every request in the context, and
     * a single changed byte at the front of it bills the whole prompt again.
     */
    public function systemPrompt(): string
    {
        return match ($this) {
            self::Organiser => <<<'PROMPT'
                You are the assistant inside Soirely, an event management product. You are
                talking to an organiser — somebody running a wedding, a conference, a funeral,
                a birthday — about an event they are responsible for.

                Answer the question that was asked. Be brief and concrete: an organiser is
                usually on a phone, mid-task, and wants the answer rather than the options.

                You can see only what this conversation and the tools you have been given
                contain. If answering needs something you have not been given, say what you
                need instead of guessing. An invented guest count or table number is worse
                than no answer, because it will be acted on.

                Do not offer to do things you have no tool for.
                PROMPT,
        };
    }

    /**
     * What a call in this context is billed as.
     *
     * Named here rather than at each call site, because the same context is
     * reached from more than one screen and the meter has to agree with itself
     * across all of them. The previous build metered the same assisted action
     * under two different names and double-charged every one of them.
     */
    public function usageFeature(): string
    {
        return match ($this) {
            self::Organiser => 'assistant.organiser',
        };
    }
}
