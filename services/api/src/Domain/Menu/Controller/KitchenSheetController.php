<?php

declare(strict_types=1);

namespace App\Domain\Menu\Controller;

use App\Domain\Menu\Kitchen\FinalNumbers;
use App\Domain\Menu\Kitchen\KitchenSheet;
use App\Domain\Menu\Kitchen\KitchenSheetDocument;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Locale\Listener\RequestLocaleListener;
use App\Locale\SupportedLocales;
use App\Pdf\Exception\PdfNotMade;
use App\Pdf\Interfaces\PdfMakerInterface;
use App\Repository\EventRepository;
use App\Repository\KitchenCopyRepository;
use DateTimeImmutable;
use Psl\Str;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The kitchen sheet (sc-3911): menu.read opens it; names in Allergies need guests.manage, because allergies are health data (GDPR Art. 9), the one gate sc-3777 set.
 *
 * @phpstan-import-type Sheet from KitchenSheet
 */
final readonly class KitchenSheetController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private KitchenSheet $kitchenSheet,
        private KitchenSheetDocument $kitchenSheetDocument,
        private PdfMakerInterface $pdfMaker,
        private TranslatorInterface $translator,
        private FinalNumbers $finalNumbers,
        private KitchenCopyRepository $kitchenCopyRepository,
    ) {
    }

    #[Route('/api/events/{eventId}/menu/kitchen-sheet', name: 'menu_kitchen_sheet_show', methods: ['GET'])]
    #[InEvent(Permission::MenuRead)]
    public function show(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $sheet = $this->kitchenSheet->of($event, $this->names($event));

        return new JsonResponse(['sheet' => [...$sheet, 'paper' => $sheet['paper']->value], 'finalNumbers' => $this->finalNumbers->of($event)], Response::HTTP_OK, ['Cache-Control' => 'no-store']);
    }

    /** Final numbers due (sc-30812): a day or null. Refused 422 on `due`. */
    #[Route('/api/events/{eventId}/menu/final-numbers', name: 'menu_final_numbers_change', methods: ['PUT'])]
    #[InEvent(Permission::MenuManage)]
    public function changeDue(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['due' => Type\nullable(Type\string())]));
        $this->finalNumbers->setDue($event, $body['due']);

        return new JsonResponse(['finalNumbers' => $this->finalNumbers->of($event)], Response::HTTP_OK, ['Cache-Control' => 'no-store']);
    }

    /** Give final numbers… (sc-30812): the PDF exactly as Download PDF makes it now, and the whole sheet kept as the numbers given. A PDF that cannot be made records nothing. */
    #[Route('/api/events/{eventId}/menu/kitchen-sheet/copies', name: 'menu_kitchen_sheet_give', methods: ['POST'])]
    #[InEvent(Permission::MenuManage)]
    public function give(Request $request, string $eventId): Response
    {
        $event = $this->event($eventId);
        $names = $this->names($event);
        $sheet = $this->kitchenSheet->of($event, $names);
        $locale = self::locale($request);
        $pdf = $this->made($event, $sheet, $locale);
        $this->finalNumbers->record($event, $names ? $sheet : $this->kitchenSheet->of($event, true), $this->user(), $names);

        return $this->download($pdf, $this->fileName($event, $sheet['asOf'], $locale));
    }

    /** Download this copy: as given, in the reader's language, "As of" the moment it was given, named for that day. */
    #[Route('/api/events/{eventId}/menu/kitchen-sheet/copies/{copyId}/pdf', name: 'menu_kitchen_sheet_copy_pdf', methods: ['POST'])]
    #[InEvent(Permission::MenuRead)]
    public function copyPdf(Request $request, string $eventId, string $copyId): Response
    {
        $event = $this->event($eventId);
        $copy = $this->kitchenCopyRepository->findOneInEvent($event, $copyId) ?? throw ApiException::notFound('access.not_found');
        $sheet = $this->finalNumbers->sheetOf($copy, $this->names($event));
        $locale = self::locale($request);

        return $this->download($this->made($event, $sheet, $locale), $this->fileName($event, $sheet['asOf'], $locale));
    }

    /** Made when pressed, from the sheet as it is now, in the viewer's language; named for the event and the snapshot's day. */
    #[Route('/api/events/{eventId}/menu/kitchen-sheet/pdf', name: 'menu_kitchen_sheet_pdf', methods: ['POST'])]
    #[InEvent(Permission::MenuRead)]
    public function pdf(Request $request, string $eventId): Response
    {
        $event = $this->event($eventId);
        $sheet = $this->kitchenSheet->of($event, $this->names($event));
        $locale = self::locale($request);

        return $this->download($this->made($event, $sheet, $locale), $this->fileName($event, $sheet['asOf'], $locale));
    }

    /** @param Sheet $sheet */
    private function made(Event $event, array $sheet, string $locale): string
    {
        try {
            return $this->pdfMaker->make($this->kitchenSheetDocument->html($event, $sheet, $locale));
        } catch (PdfNotMade $failure) {
            throw new ApiException(ErrorCode::ServiceUnavailable, 'The PDF could not be made. Print still works.', [], $failure);
        }
    }

    private function download(string $pdf, string $name): Response
    {
        return new Response($pdf, Response::HTTP_OK, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $name, 'kitchen-sheet.pdf'),
            'Cache-Control' => 'no-store',
        ]);
    }

    private static function locale(Request $request): string
    {
        $locale = $request->attributes->get(RequestLocaleListener::ATTRIBUTE);

        return \is_string($locale) ? $locale : SupportedLocales::DEFAULT;
    }

    /** "{event} kitchen sheet {YYYY-MM-DD}.pdf", the snapshot's day in the event's time zone so files sort; a slash would make the name a path. */
    private function fileName(Event $event, string $asOf, string $locale): string
    {
        $base = $this->translator->trans('kitchen_sheet.file', [
            'event' => $event->getName(),
            'day' => new DateTimeImmutable($asOf)->format('Y-m-d'),
        ], 'messages', $locale);

        return Str\replace_every($base, ['/' => '-', '\\' => '-']) . '.pdf';
    }

    private function names(Event $event): bool
    {
        return true === $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId())?->holds(Permission::GuestsManage);
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
