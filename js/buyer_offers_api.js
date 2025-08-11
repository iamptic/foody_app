// webapp/js/buyer_offers_api.js
export async function fetchOffers(apiBase, restaurantId) {
  const url = new URL('/api/v1/offers', apiBase);
  if (restaurantId) url.searchParams.set('restaurant_id', restaurantId);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error('Failed to fetch offers');
  return r.json();
}

export async function reserveOffer(apiBase, offerId, buyerTgId) {
  const r = await fetch(new URL('/api/v1/reservations', apiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer_id: offerId, buyer_tg_id: String(buyerTgId||'') })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listReservations(apiBase, restaurantId, status) {
  const url = new URL('/api/v1/reservations', apiBase);
  url.searchParams.set('restaurant_id', restaurantId);
  if (status) url.searchParams.set('status', status);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

export async function redeemReservation(apiBase, reservationId, code) {
  const r = await fetch(new URL(`/api/v1/reservations/${encodeURIComponent(reservationId)}/redeem`, apiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
