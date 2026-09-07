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

    /*
    |--------------------------------------------------------------------------
    | BP coordinate staging integration
    |--------------------------------------------------------------------------
    |
    | The GET route is configurable because the SAP gateway only supports
    | lookups per BP. Its default follows the existing SAP gateway style.
    |
    */
    'bp_coordinate_base_url' => env(
        'SAP_BP_COORDINATE_BASE_URL',
        'https://ite-sap.utomodeck.com/sap/api/v1/bp-coordinate'
    ),

    'bp_coordinate_get_url_template' => env(
        'SAP_BP_COORDINATE_GET_URL_TEMPLATE',
        '{base}/{db}/{cardcode}'
    ),

    'bp_coordinate_timeout' => (int) env('SAP_BP_COORDINATE_TIMEOUT', 15),
    'bp_coordinate_token' => env('SAP_BP_COORDINATE_TOKEN'),
    'bp_coordinate_api_key' => env('SAP_BP_COORDINATE_API_KEY'),
    'coordinate_match_tolerance_meters' => (float) env('SAP_COORDINATE_MATCH_TOLERANCE_METERS', 50),
    'coordinate_verification_threshold_meters' => (float) env('SAP_COORDINATE_VERIFICATION_THRESHOLD_METERS', 100),
    'coordinate_max_observation_accuracy_meters' => (float) env('SAP_COORDINATE_MAX_OBSERVATION_ACCURACY_METERS', 25),
    'coordinate_observation_agreement_meters' => (float) env('SAP_COORDINATE_OBSERVATION_AGREEMENT_METERS', 30),
];
