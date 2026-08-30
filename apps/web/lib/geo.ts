/**
 * The project's one geographic reference point.
 *
 * Cồn Hô, Vĩnh Long — an island in the Cổ Chiên branch of the Mekong. This
 * coordinate is not a measurement and not data: it is where the project is,
 * the same way "Vĩnh Long" is. That distinction matters because it is what
 * makes it safe to use in demo mode, where every *reading* is synthetic. The
 * island is in the same place either way.
 *
 * It lived as a private constant in three files (the weather client, the
 * health probe, and the report route's fallback) before this. One of them
 * drifting would have been invisible — nothing compares them.
 *
 * Deliberately NOT `server-only`: the map is a client component and needs the
 * same point to centre on when it has no stations to fit to.
 */
export const CON_HO = {
  lat: 10.2419,
  lng: 105.826,
} as const;

/**
 * The zoom the basemap-only view opens at.
 *
 * 14, because that is what `fitBounds` actually resolves to for the three
 * pilot stations in the Bento's map cell — read off the live tile requests
 * (`…/tile/14/7722/13007`), not estimated. Matching it is the point: demo and
 * real mode should show the island at the same scale, so switching between
 * them changes the markers and nothing else about the map.
 */
export const CON_HO_ZOOM = 14;
