<?php

namespace App\Http\Controllers\Tariff;

use App\Enums\TariffPlan;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TariffController extends Controller
{
    /**
     * GET /api/v1/tariffs
     */
    public function index(): JsonResponse
    {
        $plans = collect(TariffPlan::cases())->map(fn (TariffPlan $plan) => [
            'key'          => $plan->value,
            'price_rub'    => $plan->priceRub(),
            'file_size_mb' => (int) round($plan->fileSizeLimitBytes() / 1024 / 1024),
            'storage_mb'   => (int) round($plan->storageLimitBytes() / 1024 / 1024),
            'device_limit' => $plan->deviceLimit(),
        ]);

        return $this->success('Тарифные планы получены', ['plans' => $plans]);
    }

    /**
     * POST /api/v1/tariffs/request
     */
    public function request(Request $request): JsonResponse
    {
        $request->validate([
            'plan' => ['required', 'string', 'in:free,silver,gold'],
        ]);

        return $this->success('Заявка принята');
    }
}
