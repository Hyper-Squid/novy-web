
import { createHmac, timingSafeEqual } from "node:crypto";

function odpoved(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function podpis(hodnota, tajomstvo) {
  return createHmac("sha256", tajomstvo)
    .update(hodnota)
    .digest("base64url");
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return odpoved({ chyba: "Nepovolená metóda." }, 405);
  }

  const heslo = process.env.ADMIN_PASSWORD;
  const tajomstvo = process.env.ADMIN_TOKEN_SECRET;

  if (!heslo || heslo.length < 12 ||
      !tajomstvo || tajomstvo.length < 32) {
    return odpoved({
      chyba: "Administrátor nie je správne nastavený v Netlify."
    }, 500);
  }

  let telo;

  try {
    telo = await request.json();
  } catch {
    return odpoved({ chyba: "Neplatné údaje." }, 400);
  }

  const zadaneHeslo =
    typeof telo.heslo === "string" ? telo.heslo : "";

  const a = Buffer.from(zadaneHeslo);
  const b = Buffer.from(heslo);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return odpoved({ chyba: "Nesprávne heslo." }, 401);
  }

  const udaje = Buffer.from(JSON.stringify({
    administrator: true,
    platnost: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  })).toString("base64url");

  const token = udaje + "." + podpis(udaje, tajomstvo);

  return odpoved({ token });
}

export const config = {
  path: "/api/login"
};
