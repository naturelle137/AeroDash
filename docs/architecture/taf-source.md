# TAF source

TAF retrieval uses [wxdecoder](https://wxdecoder.com/api/) for educational and situational awareness use. The free keyless API permits reasonable non-commercial use, requires visible attribution and cache compliance, and prohibits presenting data as an official briefing or go/no-go authority. Commercial use requires separate permission. Coverage depends on upstream availability. Obtain required weather from an authorised briefing source.

On 21 November 2026 an EDDF request returned HTTP 200, `Access-Control-Allow-Origin: *`, and a raw TAF with issuance and validity timestamps matching its UTC tokens. The browser honours the response cache headers. The CSP permits only this provider in addition to same-origin connections; credentials are omitted. Responses are checked for station, timestamp consistency and validity order; expired forecasts are labelled and pilot inputs remain untouched. No decoding or operational validation is claimed.

The [NOAA Aviation Weather Center API](https://aviationweather.gov/data/api/) documents worldwide TAF coverage but prohibits cross-origin access. [metars.eu](https://metars.eu/learn/api) excludes operational flight use and [Datamask](https://www.datamask.org/api-docs) excludes flight planning.
