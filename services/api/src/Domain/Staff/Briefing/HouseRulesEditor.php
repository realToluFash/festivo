<?php

declare(strict_types=1);

namespace App\Domain\Staff\Briefing;

use App\Audit\Auditor;
use App\Domain\Staff\StaffRosterPublisher;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The staff's house rules (sc-3917). Changing them sends nothing and sets no Changed since sent. */
final readonly class HouseRulesEditor
{
    public const string CHANGED = 'staff.rules_changed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffRosterPublisher $staffRosterPublisher,
        private Auditor $auditor,
        private TranslatorInterface $translator,
    ) {
    }

    /** Counted in code points, as the clients count them: "Ọ̀" is two. Blank clears them. */
    public function save(Event $event, string $rules, User $by): void
    {
        $rules = Str\trim($rules);

        if (Str\length($rules) > Event::STAFF_RULES_MAXIMUM) {
            throw ApiException::validation([[
                'propertyPath' => 'rules',
                'message' => $this->translator->trans('validation.staff_rules_too_long', ['{max}' => (string) Event::STAFF_RULES_MAXIMUM]),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $event->setStaffRules('' === $rules ? null : $rules);
        $this->auditor->record(self::CHANGED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName());
        $this->entityManager->flush();

        $this->staffRosterPublisher->publish($event);
    }
}
