<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontReport = [];

    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Render exceptions as unified JSON API responses.
     */
    public function render($request, Throwable $e): \Illuminate\Http\Response|JsonResponse|\Symfony\Component\HttpFoundation\Response
    {
        // Only intercept API requests
        if ($request->expectsJson() || $request->is('api/*')) {
            return $this->renderApiException($e);
        }

        return parent::render($request, $e);
    }

    private function renderApiException(Throwable $e): JsonResponse
    {
        // Validation errors
        if ($e instanceof ValidationException) {
            return response()->json([
                'result'  => 'error',
                'message' => 'Validation failed',
                'data'    => [
                    'code'   => 'VALIDATION_ERROR',
                    'errors' => $e->errors(),
                ],
            ], 422);
        }

        // Authentication
        if ($e instanceof AuthenticationException) {
            return response()->json([
                'result'  => 'error',
                'message' => 'Unauthenticated',
                'data'    => ['code' => 'UNAUTHORIZED', 'errors' => (object)[]],
            ], 401);
        }

        // Not found
        if ($e instanceof NotFoundHttpException) {
            return response()->json([
                'result'  => 'error',
                'message' => 'Resource not found',
                'data'    => ['code' => 'NOT_FOUND', 'errors' => (object)[]],
            ], 404);
        }

        // Forbidden
        if ($e instanceof AccessDeniedHttpException) {
            return response()->json([
                'result'  => 'error',
                'message' => 'Access denied',
                'data'    => ['code' => 'FORBIDDEN', 'errors' => (object)[]],
            ], 403);
        }

        // Generic server error
        $status  = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
        $message = app()->isProduction() ? 'An unexpected error occurred' : $e->getMessage();

        return response()->json([
            'result'  => 'error',
            'message' => $message,
            'data'    => ['code' => 'SERVER_ERROR', 'errors' => (object)[]],
        ], $status);
    }
}
