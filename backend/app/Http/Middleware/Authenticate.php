<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    // API-only app: never redirect to a login page.
    // AuthenticationException will be caught by Handler and returned as 401 JSON.
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
