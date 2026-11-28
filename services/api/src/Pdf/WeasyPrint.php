<?php

declare(strict_types=1);

namespace App\Pdf;

use App\Pdf\Exception\PdfNotMade;
use App\Pdf\Interfaces\PdfMakerInterface;
use Psl\File;
use Psl\Filesystem;
use Psl\Shell;
use Throwable;

/** WeasyPrint (sc-3911, decided in #4137): the binary sc-5821 puts on the API image's PATH, the document carrying everything it uses. */
final readonly class WeasyPrint implements PdfMakerInterface
{
    public function make(string $html): string
    {
        $in = Filesystem\create_temporary_file(null, 'sheet');
        $out = $in . '.pdf';

        try {
            File\write($in, $html);
            Shell\execute('weasyprint', ['--pdf-variant', 'pdf/ua-1', '--encoding', 'utf-8', $in, $out]);

            return File\read($out);
        } catch (Throwable $failure) {
            throw new PdfNotMade('weasyprint failed: ' . $failure::class, 0, $failure);
        } finally {
            foreach ([$in, $out] as $file) {
                if (Filesystem\is_file($file)) {
                    Filesystem\delete_file($file);
                }
            }
        }
    }
}
