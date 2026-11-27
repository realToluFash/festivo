<?php

declare(strict_types=1);

namespace App\Pdf\Interfaces;

use App\Pdf\Exception\PdfNotMade;

/** Turns a whole HTML document into a tagged PDF (PDF/UA-1, ISO 14289-1): its headings and tables become the PDF's structure. */
interface PdfMakerInterface
{
    /**
     * @return string the PDF's bytes
     *
     * @throws PdfNotMade
     */
    public function make(string $html): string;
}
