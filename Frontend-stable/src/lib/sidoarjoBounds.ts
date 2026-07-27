export const SIDOARJO_BBOX = {
  lngMin: 112.5,
  lngMax: 112.95,
  latMin: -7.65,
  latMax: -7.25,
}

export function isInSidoarjoBbox(lat: number, lng: number): boolean {
  return (
    lat >= SIDOARJO_BBOX.latMin &&
    lat <= SIDOARJO_BBOX.latMax &&
    lng >= SIDOARJO_BBOX.lngMin &&
    lng <= SIDOARJO_BBOX.lngMax
  )
}
