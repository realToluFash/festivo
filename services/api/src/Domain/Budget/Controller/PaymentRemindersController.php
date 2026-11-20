<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Reminder\PaymentReminders;
use App\Entity\Organisation;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PlanFeature;
use App\Http\Access\Interfaces\PlanFeaturesInterface;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\OrganisationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > Vendors > Payment reminders (sc-95): only the organisation's Owners and Admins see or change the days. */
final readonly class PaymentRemindersController
{
    public function __construct(
        private OrganisationRepository $organisationRepository,
        private PlanFeaturesInterface $planFeatures,
        private PaymentReminders $paymentReminders,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/payment-reminders', name: 'orgs_payment_reminders', methods: ['GET'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function show(string $organisationId): JsonResponse
    {
        return new JsonResponse($this->setting($this->organisation($organisationId)));
    }

    /** A whole number of days from 1 to 30. Reminders not sent yet move to the new day; one already sent is never sent again. */
    #[Route('/api/orgs/{organisationId}/payment-reminders', name: 'orgs_payment_reminders_update', methods: ['PUT'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function update(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $days = Input::body($request, Type\shape(['days' => Type\mixed()]))['days'];

        if (!\is_int($days) || $days < Organisation::PAYMENT_REMINDER_DAYS_MINIMUM || $days > Organisation::PAYMENT_REMINDER_DAYS_MAXIMUM) {
            throw ApiException::validation([[
                'propertyPath' => 'days',
                'message' => $this->translator->trans('validation.payment_reminder_days'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        if ($days !== $organisation->getPaymentReminderDays()) {
            $this->entityManager->wrapInTransaction(function () use ($organisation, $days): void {
                $organisation->setPaymentReminderDays($days);
                $this->paymentReminders->followAll($organisation);
                $this->entityManager->flush();
            });
        }

        return new JsonResponse($this->setting($organisation));
    }

    /** @return array{days: int, inForce: bool} inForce is false once the plan no longer has payment schedules: nothing goes */
    private function setting(Organisation $organisation): array
    {
        return [
            'days' => $organisation->getPaymentReminderDays(),
            'inForce' => $this->planFeatures->unlocks($organisation->getId(), PlanFeature::Vendors),
        ];
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }
}
