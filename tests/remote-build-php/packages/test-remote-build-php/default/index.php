<?php
use NFNumberToWord\NumberToWords;
 
function main(array $args) : array
{
    $number = 9999;
    $words = (new NumberToWords)->toWords($number);
 
    return [
        'body' => $words,
    ];
}
