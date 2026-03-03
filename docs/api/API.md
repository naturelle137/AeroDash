# AeroDash API Documentation

This document defines the REST API endpoints and data contracts for the AeroDash cloud backend.
As an offline-first application, the client primarily relies on its local IndexedDB. The API is used exclusively for fetching external environmental data (Weather, Airports) and synchronizing cloud state (Sync, Sharing).

## Base URL

`/api/v1`

## Authentication

> [!NOTE]
> Authentication is planned for Milestone #7. Currently, the API is unauthenticated for local use.

_(Future: OIDC/JWT Bearer Token required for all `/sync` and Organization endpoints)._

## Rate Limiting

> [!NOTE]
> Currently no rate limiting for local deployment.

## Endpoints

### 1. Weather & Environmental Data (WX)

AeroDash acts as a proxy to fetch and normalize weather data from external authorities (e.g., CheckWX, NOAA) to prevent CORS issues on the client and provide a unified JSON structure.

#### `GET /api/v1/weather/metar/:icao`

Fetches the current METAR for the specified airport.

- **Parameters**: `icao` (string) - 4-letter ICAO code.
- **Response `200 OK`**:

  ```json
  {
    "icao": "EDDF",
    "raw": "EDDF 021420Z ...",
    "wind": {
      "direction": 240,
      "speed_kt": 15,
      "gust_kt": 25,
      "variation": { "direction1": 200, "direction2": 300 }
    },
    "temperature_c": 12,
    "qnh_hpa": 1013,
    "precipitation": ["RA"],
    "meta": { "source": "NOAA", "timestamp": "2026-03-02T14:20:00Z" }
  }
  ```

#### `GET /api/v1/weather/taf/:icao`

Fetches the current TAF for the specified airport.

- **Parameters**: `icao` (string) - 4-letter ICAO code.
- **Response `200 OK`**: Returns the parsed TAF structure.

### 2. Airport Database (AP)

#### `GET /api/v1/airports/:icao`

Fetches static airport infrastructure data.

- **Parameters**: `icao` (string) - 4-letter ICAO code.
- **Response `200 OK`**:

  ```json
  {
    "icao": "EDDF",
    "name": "Frankfurt am Main",
    "elevation_ft": 364,
    "runways": [
      {
        "designator": "07R",
        "heading_mag": 69,
        "surface": "Asphalt",
        "tora_m": 4000,
        "toda_m": 4000,
        "asda_m": 4000,
        "lda_m": 4000
      }
    ],
    "meta": { "source": "OpenAIP", "timestamp": "..." }
  }
  ```

### 3. Collaboration & Sharing (SC)

#### `POST /api/v1/shares`

Generates a short, alphanumeric Share-Code for ad-hoc peer-to-peer sharing of an aircraft profile (REQ-SC-005).

- **Body**: Aircraft Profile JSON object.
- **Response `201 Created`**:

  ```json
  {
    "shareCode": "A3F9-X2R7",
    "expiresAt": "2026-03-09T00:00:00Z"
  }
  ```

#### `GET /api/v1/shares/:code`

Retrieves an aircraft profile using a Share-Code (REQ-SC-006).

- **Parameters**: `code` (string) - 6-character alphanumeric code.
- **Response `200 OK`**: Returns the Aircraft Profile JSON structure.

### 4. Cloud Synchronization (SC)

#### `POST /api/v1/sync/push`

Pushes local modifications to the cloud. The backend resolves conflicts, prioritizing Organization data.

- **Body**: Array of synchronization mutation objects (Delta changes).
- **Response `Response 200 OK: { "syncedAt": "2026-03-02T15:30:00Z", "conflicts": [] }`**: Returns acknowledgment and any server-side conflict resolutions.

#### `GET /api/v1/sync/pull`

Retrieves changes from the cloud since the last local sync timestamp.

- **Query**: `?since=<ISO_8601_TIMESTAMP>`
- **Response `200 OK`**: Array of synchronization mutation objects.

---

## Standardized Error Responses

If an API request fails, it always returns a standardized JSON structure matching the application-wide Notification Schema to allow direct mapping to UI alerts.

```json
{
  "error": {
    "id": "INFO-API-001",
    "severity": "INFO",
    "message": "Online Weather Service unavailable.",
    "context": "API.OnlineWeather"
  }
}
```

```json
{
  "error": {
    "id": "INFO-API-002",
    "severity": "INFO",
    "message": "Online Airport Data unavailable.",
    "context": "API.OnlineAirports"
  }
}
```

```json
{
  "error": {
    "id": "INFO-API-003",
    "severity": "INFO",
    "message": "Share code not created. Please try again.",
    "context": "API.ShareCreate"
  }
}
```

```json
{
  "error": {
    "id": "INFO-API-004",
    "severity": "INFO",
    "message": "Share code expired or invalid or service currently unavailable.",
    "context": "API.ShareRetrieve"
  }
}
```

### Common HTTP Status Codes

- **`400 Bad Request`**: Malformed input (e.g., invalid ICAO code format, Zod validation failure on `POST /shares`).
- **`401 Unauthorized`**: Missing or invalid OIDC token (Future).
- **`403 Forbidden`**: Role-Based Access Control violation (e.g., Member attempting to push Organization fleet changes).
- **`404 Not Found`**: Resource does not exist (e.g., ICAO not found, Share-Code expired or invalid). Puts the app into `ManualEntry` fallback mode.
- **`500 Internal Server Error`**: Unexpected backend failure.
- **`503 Service Unavailable`**: External dependency failure (e.g., NOAA weather API is down). Should trigger a graceful degradation in the client.
