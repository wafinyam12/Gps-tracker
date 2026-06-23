<?php

return [
    'outstanding_receivable_base_url' => env(
        'SAP_OUTSTANDING_RECEIVABLE_BASE_URL',
        'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable'
    ),

    'outstanding_receivable_timeout' => (int) env('SAP_OUTSTANDING_RECEIVABLE_TIMEOUT', 15),

    'outstanding_receivable_cache_minutes' => (int) env('SAP_OUTSTANDING_RECEIVABLE_CACHE_MINUTES', 10),

    'store_catalog_refresh_minutes' => (int) env('SAP_STORE_CATALOG_REFRESH_MINUTES', 15),

    'store_catalog_warmup_seconds' => (int) env('SAP_STORE_CATALOG_WARMUP_SECONDS', 30),
];
