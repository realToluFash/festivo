<?php

declare(strict_types=1);

namespace App\Doctrine\Query;

use Doctrine\ORM\Query\AST\Functions\FunctionNode;
use Doctrine\ORM\Query\AST\Node;
use Doctrine\ORM\Query\Parser;
use Doctrine\ORM\Query\SqlWalker;
use Doctrine\ORM\Query\TokenType;
use Psl\Str;

/** `HOLDS_NAME(column, :name) = true`: whether a JSON list of names holds :name in any case, as the Filter offers each name once (sc-30302). */
final class HoldsName extends FunctionNode
{
    public Node $column;

    public Node $sought;

    public function getSql(SqlWalker $sqlWalker): string
    {
        return Str\format(
            '(EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS_TEXT(CAST(%s AS JSONB)) AS held(name) WHERE LOWER(held.name) = LOWER(%s)))',
            $sqlWalker->walkStringPrimary($this->column),
            $sqlWalker->walkStringPrimary($this->sought),
        );
    }

    public function parse(Parser $parser): void
    {
        $parser->match(TokenType::T_IDENTIFIER);
        $parser->match(TokenType::T_OPEN_PARENTHESIS);
        $this->column = $parser->StringPrimary();
        $parser->match(TokenType::T_COMMA);
        $this->sought = $parser->StringPrimary();
        $parser->match(TokenType::T_CLOSE_PARENTHESIS);
    }
}
