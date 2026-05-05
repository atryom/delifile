<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SuperUserMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        if (!$request->user()?->is_superuser) {
            return response()->json([
                'result'  => 'error',
                'message' => 'Доступ запрещён',
                'data'    => ['code' => 'FORBIDDEN', 'errors' => []],
            ], 403);
        }

        return $next($request);
    }
}