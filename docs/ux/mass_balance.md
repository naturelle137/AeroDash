# Mass & Balance interaction

The preparation page uses the persisted fleet, not a separate runtime catalogue selector. See [flight preparation](flight_preparation.md) for the page and [state evaluation](../architecture/frontend_state_machine.md) for result priority.

## Inputs and feedback

Select a fleet profile and certification category. Draft, expired and unattributed verification states require the applicable review/acknowledgement flow; the label “Verified” describes profile provenance, not a flight’s result.

Station inputs dispatch store actions; pure core functions calculate mass, moments, CG and envelope/fuel-burn violations. The SVG `CGEnvelopeChart.vue` renders the returned geometry. It does not decide aircraft limits. Keep input/result units visible, use conservative display rounding and avoid chart animation that obscures an input’s effect.

Required occupants at numeric zero produce WARN-UQ-001. Explicitly optional occupants may be empty at zero without confirmation; invalid, blank, negative and nonfinite entries cannot become accepted empty seats. Combined crew/passenger stations use aggregate mass. Occupant quick presets apply to required/optional occupant stations and unclassified legacy stations; baggage and fuel have no occupant presets. See [configured occupancy](../architecture/optional-occupancy.md).

## Recovery

Reset Payload requires confirmation and resets each station to the greater of its configured default quantity and its allowed minimum (including unusable fuel). It preserves the aircraft, resets trip planning/verification state and recalculates. It does not zero every station or guarantee an UNCONFIGURED result. Changing aircraft clears the prior session payload.

Critical result banners must remain prominent and accessible. Input-validation errors prevent calculation; warnings must retain enough field/station context for correction. Preserve future color-independent chart signaling and error-boundary goals in the [design system](design_system.md), without treating them as proven by this document.
