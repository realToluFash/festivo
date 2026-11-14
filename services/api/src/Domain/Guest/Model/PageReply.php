<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** What a guest sends with Coming from their own page, as GuestRules accepted it: who fills the places (sc-3779), the guest's own needs (sc-3778), null to leave them as they are, and the needs of each place left unnamed. */
final readonly class PageReply
{
    /**
     * @param list<CompanionChoice> $companions
     * @param list<PlaceNeeds>      $unnamed
     */
    public function __construct(
        public array $companions,
        public ?GuestNeeds $needs,
        public array $unnamed = [],
    ) {
    }
}
