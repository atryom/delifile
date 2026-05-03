<?php

namespace App\Http\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponseTrait
{
    /**
     * Return a unified success API response.
     *
     * @param  string  $message
     * @param  array   $data
     * @param  int     $status
     * @return JsonResponse
     */
    protected function success(string $message, array $data = [], int $status = 200): JsonResponse
    {
        return response()->json([
            'result'  => 'success',
            'message' => $message,
            'data'    => $data ?: (object)[],
        ], $status);
    }

    /**
     * Return a unified error API response.
     *
     * @param  string  $message
     * @param  string  $code
     * @param  array   $errors
     * @param  int     $status
     * @return JsonResponse
     */
    protected function error(string $message, string $code = 'ERROR', array $errors = [], int $status = 422): JsonResponse
    {
        return response()->json([
            'result'  => 'error',
            'message' => $message,
            'data'    => [
                'code'   => $code,
                'errors' => $errors ?: (object)[],
            ],
        ], $status);
    }

    /**
     * Return a 404 not found error.
     */
    protected function notFound(string $message = 'Resource not found'): JsonResponse
    {
        return $this->error($message, 'NOT_FOUND', [], 404);
    }

    /**
     * Return a 403 forbidden error.
     */
    protected function forbidden(string $message = 'Access denied'): JsonResponse
    {
        return $this->error($message, 'FORBIDDEN', [], 403);
    }

    /**
     * Return a 401 unauthorized error.
     */
    protected function unauthorized(string $message = 'Unauthenticated'): JsonResponse
    {
        return $this->error($message, 'UNAUTHORIZED', [], 401);
    }
}
