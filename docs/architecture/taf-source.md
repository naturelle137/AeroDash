# TAF source availability

Weather provides ICAO entry and an unavailable state; it does not retrieve or display a forecast or modify pilot inputs. Obtain an authorised weather briefing before flight.

On 21 November 2026, the [NOAA Aviation Weather Center API](https://aviationweather.gov/data/api/) documented worldwide TAF coverage and no cross-origin access. An EDDF request with an Origin header returned HTTP 200 without `Access-Control-Allow-Origin`. [metars.eu](https://metars.eu/learn/api) documents free browser access and worldwide coverage but excludes operational flight use; an EDDF request returned HTTP 200 with a matching CORS header and day/hour validity tokens, without month or year. [Datamask](https://www.datamask.org/api-docs) also provides free CORS access but excludes flight planning. Its EDDF response returned an `issuedAt` of 12:42 while its raw forecast stated 11:00Z, so that field cannot be assumed to represent forecast issuance.

The existing `connect-src 'self'` policy blocks these external browser requests. A live integration requires an authorised source and destination and an appropriate policy decision, plus validated issuance and validity semantics, expiry, missing and malformed responses, and synthetic tests. Do not infer a current forecast from retrieval time or apply weather to pilot inputs.
