# METAR source availability

Flight Prep exposes ICAO entry but does not fetch or display a METAR. It leaves pilot inputs unchanged and directs pilots to authorised briefing sources. The same-origin-only `connect-src` policy currently prevents direct browser calls to external services; the issue does not authorise changing project policy or external destinations.

On 21 November 2026 the [NOAA Aviation Weather Center API](https://aviationweather.gov/data/api/) documented worldwide METAR access without a key, a 100-request-per-minute limit and no cross-origin access. A request with an Origin header returned HTTP 200 without an `Access-Control-Allow-Origin` header. Its observation timestamp is distinct from retrieval time. Direct browser retrieval therefore fails CORS.

[wxdecoder](https://wxdecoder.com/api/) documents free, non-commercial use for education and situational awareness, attribution and no official briefing or go/no-go use. A request for EDDF returned HTTP 200 with `Access-Control-Allow-Origin: *`, a raw METAR and an observation `reportTime`; its cache headers permit 15 seconds in a browser. It remains unusable under the current connection policy. [metars.eu](https://metars.eu/learn/api) supports CORS but prohibits operational flight use; [Datamask](https://www.datamask.org/api-docs) excludes flight planning. Neither restriction is waived here.

A future integration requires an authorised destination and policy decision, source terms suitable for the intended use, validation of station and observation timestamps, explicit stale/malformed/unavailable states, and browser tests with synthetic responses. No retrieved value may overwrite pilot inputs automatically.
