<?php

namespace App\Http\Controllers\Tariff;

use App\Enums\TariffPlan;
use App\Http\Controllers\Controller;
use App\Models\DeviceSession;
use App\Models\File;
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
     * GET /api/v1/tariffs/usage
     */
    public function usage(Request $request): JsonResponse
    {
        $user  = $request->user();
        $plan  = $user->getPlan();

        $storageUsed   = (int) File::where('owner_id', $user->id)
            ->whereNotIn('status', ['deleted', 'uploading'])
            ->sum('size');

        $deviceCount   = DeviceSession::where('user_id', $user->id)->count();

        $maxFileSize   = (int) File::where('owner_id', $user->id)
            ->whereNotIn('status', ['deleted'])
            ->max('size') ?? 0;

        return $this->success('Использование тарифа получено', [
            'storage_used_bytes'     => $storageUsed,
            'storage_limit_bytes'    => $plan->storageLimitBytes(),
            'device_count'           => $deviceCount,
            'device_limit'           => $plan->deviceLimit(),
            'max_file_size_bytes'    => $maxFileSize,
            'file_size_limit_bytes'  => $plan->fileSizeLimitBytes(),
        ]);
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
