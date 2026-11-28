<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Pdf\Exception\PdfNotMade;
use App\Pdf\Interfaces\PdfMakerInterface;
use App\Pdf\WeasyPrint;

/** WeasyPrint unless a test takes it down, or hands back bytes of its own so a test that is not about the PDF never runs it; the HTML it was given is kept. */
final class ScriptedPdfMaker implements PdfMakerInterface
{
    private bool $down = false;

    private ?string $bytes = null;

    public ?string $html = null;

    public function __construct(
        private readonly WeasyPrint $weasyPrint,
    ) {
    }

    public function takeDown(): void
    {
        $this->down = true;
    }

    public function answer(string $bytes): void
    {
        $this->bytes = $bytes;
    }

    public function real(): void
    {
        $this->bytes = null;
    }

    public function make(string $html): string
    {
        $this->html = $html;

        if ($this->down) {
            throw new PdfNotMade('taken down by the test');
        }

        return $this->bytes ?? $this->weasyPrint->make($html);
    }
}
