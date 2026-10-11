<?php

declare(strict_types=1);

/*
 * Runs in Docker rather than on the developer's machine — see scripts/php-tool.mjs.
 * Nobody should need a local PHP to work on this repository.
 */

$finder = PhpCsFixer\Finder::create()
    ->in(__DIR__ . '/services/api')
    ->exclude(['var', 'vendor'])
    ->notPath('bin/.phpunit')
    ->ignoreDotFiles(true)
    ->ignoreVCS(true);

return (new PhpCsFixer\Config())
    ->setRiskyAllowed(true)
    ->setRules([
        '@Symfony' => true,
        '@PHP82Migration' => true,
        'declare_strict_types' => true,
        'global_namespace_import' => [
            'import_classes' => true,
            'import_functions' => false,
            'import_constants' => false,
        ],
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'no_unused_imports' => true,
        'single_line_throw' => false,
        'concat_space' => ['spacing' => 'one'],
        'phpdoc_to_comment' => false,
    ])
    ->setFinder($finder)
    ->setCacheFile('var/.php-cs-fixer.cache');
