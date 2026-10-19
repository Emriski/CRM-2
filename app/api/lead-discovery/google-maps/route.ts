import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "Google Maps discovery is not connected yet. Add GOOGLE_MAPS_API_KEY to the Vercel project environment variables, then redeploy. No leads have been fetched."
    }, { status: 503 });
  }

  let body: { country?: string; region?: string; category?: string; keywords?: string } = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Send a valid search request." }, { status: 400 });
  }
  const country = String(body.country || "").trim().slice(0, 80);
  const region = String(body.region || "").trim().slice(0, 100);
  const category = String(body.category || "").trim().slice(0, 120);
  const keywords = String(body.keywords || "").trim().slice(0, 160);
  if (!country || !category) {
    return NextResponse.json({ error: "Country and business category are required." }, { status: 400 });
  }

  const query = [category, keywords, region, country].filter(Boolean).join(" ");
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus,places.primaryTypeDisplayName,places.rating,places.userRatingCount"
      },
      body: JSON.stringify({ textQuery: query, pageSize: 20, languageCode: "en" }),
      cache: "no-store"
    });
    const payload = await response.json();
    if (!response.ok) {
      const detail = typeof payload?.error?.message === "string" ? payload.error.message : "Google Places API request failed.";
      return NextResponse.json({ error: detail }, { status: response.status === 429 ? 429 : 502 });
    }
    const places = Array.isArray(payload.places) ? payload.places : [];
    const results = places.map((place: any) => {
      const name = String(place.displayName?.text || "").trim();
      const address = String(place.formattedAddress || "").trim();
      const phone = String(place.nationalPhoneNumber || "").trim();
      const website = String(place.websiteUri || "").trim();
      const mapsUrl = String(place.googleMapsUri || "").trim();
      const rating = typeof place.rating === "number" ? place.rating : null;
      const reviewCount = typeof place.userRatingCount === "number" ? place.userRatingCount : 0;
      const businessStatus = String(place.businessStatus || "UNKNOWN");
      let score = 25;
      if (name) score += 15;
      if (address) score += 20;
      if (phone) score += 15;
      if (website) score += 10;
      if (rating !== null && reviewCount > 0) score += 5;
      if (reviewCount >= 10) score += 5;
      if (businessStatus === "OPERATIONAL") score += 5;
      return {
        placeId: String(place.id || ""),
        name, address, phone: phone || null, website: website || null,
        mapsUrl: mapsUrl || null, rating, reviewCount, businessStatus,
        category: String(place.primaryTypeDisplayName?.text || category),
        qualityScore: Math.min(100, score),
        qualitySignals: [
          address ? "Address returned by Google" : null,
          phone ? "Public phone returned by Google" : null,
          website ? "Website returned by Google" : null,
          rating !== null && reviewCount > 0 ? "Google rating/review count available" : null,
          businessStatus === "OPERATIONAL" ? "Google lists business as operational" : null
        ].filter(Boolean)
      };
    }).filter((place: any) => place.placeId && place.name);
    return NextResponse.json({ query, count: results.length, results, provider: "Google Places API (New)", note: "Signals reflect Google Places fields only; they do not prove CAC registration, legal identity, or lead intent." });
  } catch {
    return NextResponse.json({ error: "Could not reach Google Places. Please try again." }, { status: 502 });
  }
}
