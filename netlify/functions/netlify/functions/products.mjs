
import { getStore } from "@netlify/blobs";
import {
  createHmac,
  timingSafeEqual,
  randomUUID
} from "node:crypto";

const sklad = getStore("slovensky-obchod-potravin");
const KLUC = "potraviny.json";

const povodnePotraviny = [
  {
    id: "potravina-1",
    nazov: "Jablká",
    cena: 1.50,
    popis: "Čerstvé jablká, 1 kg.",
    obrazok: "https://placehold.co/600x400?text=Jablka"
  },
  {
    id: "potravina-2",
    nazov: "Banány",
    cena: 1.80,
    popis: "Sladké banány, 1 kg.",
    obrazok: "https://placehold.co/600x400?text=Banany"
  },
  {
    id: "potravina-3",
    nazov: "Chlieb",
    cena: 2.20,
    popis: "Čerstvý chlieb.",
    obrazok: "https://placehold.co/600x400?text=Chlieb"
  },
  {
    id: "potravina-4",
    nazov: "Mlieko",
    cena: 1.20,
    popis: "Mlieko, 1 liter.",
    obrazok: "https://placehold.co/600x400?text=Mlieko"
  },
  {
    id: "potravina-5",
    nazov: "Vajcia",
    cena: 3.00,
    popis: "Balenie 10 vajec.",
    obrazok: "https://placehold.co/600x400?text=Vajcia"
  },
  {
    id: "potravina-6",
    nazov: "Syr",
    cena: 2.50,
    popis: "Syr, 200 g.",
    obrazok: "https://placehold.co/600x400?text=Syr"
  },
  {
    id: "potravina-7",
    nazov: "Maslo",
    cena: 2.30,
    popis: "Maslo, 250 g.",
    obrazok: "https://placehold.co/600x400?text=Maslo"
  },
  {
    id: "potravina-8",
    nazov: "Zemiaky",
    cena: 1.30,
    popis: "Zemiaky, 1 kg.",
    obrazok: "https://placehold.co/600x400?text=Zemiaky"
  },
  {
    id: "potravina-9",
    nazov: "Mrkva",
    cena: 1.10,
    popis: "Čerstvá mrkva, 1 kg.",
    obrazok: "https://placehold.co/600x400?text=Mrkva"
  },
  {
    id: "potravina-10",
    nazov: "Čokoláda",
    cena: 1.60,
    popis: "Mliečna čokoláda, 100 g.",
    obrazok: "https://placehold.co/600x400?text=Cokolada"
  },
  {
    id: "potravina-11",
    nazov: "Cukor",
    cena: 1.20,
    popis: "Kryštálový cukor, 1 kg.",
    obrazok: "https://placehold.co/600x400?text=Cukor"
  },
  {
    id: "potravina-12",
    nazov: "Pomaranče",
    cena: 2.00,
    popis: "Pomaranče, 1 kg.",
    obrazok: "https://placehold.co/600x400?text=Pomarance"
  }
];

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

function jePrihlaseny(request) {
  const tajomstvo = process.env.ADMIN_TOKEN_SECRET;
  const hlavicka = request.headers.get("authorization") || "";
  const [typ, token] = hlavicka.split(" ");

  if (!tajomstvo || tajomstvo.length < 32 ||
      typ !== "Bearer" || !token) {
    return false;
  }

  const casti = token.split(".");
  if (casti.length !== 2) return false;

  const [udaje, podpisTokenu] = casti;
  const ocakavany = Buffer.from(podpis(udaje, tajomstvo));
  const skutocny = Buffer.from(podpisTokenu);

  if (ocakavany.length !== skutocny.length ||
      !timingSafeEqual(ocakavany, skutocny)) {
    return false;
  }

  try {
    const data = JSON.parse(
      Buffer.from(udaje, "base64url").toString()
    );

    return data.administrator === true &&
      Number.isFinite(data.platnost) &&
      data.platnost > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function nacitajPotraviny() {
  let potraviny = await sklad.get(KLUC, { type: "json" });

  if (!Array.isArray(potraviny)) {
    potraviny = povodnePotraviny;
    await sklad.set(KLUC, JSON.stringify(potraviny));
  }

  return potraviny;
}

export default async function handler(request) {
  try {
    if (request.method === "GET") {
      return odpoved(await nacitajPotraviny());
    }

    if (!["POST", "DELETE"].includes(request.method)) {
      return odpoved({ chyba: "Nepovolená metóda." }, 405);
    }

    if (!jePrihlaseny(request)) {
      return odpoved({
        chyba: "Najprv sa prihlás ako administrátor."
      }, 401);
    }

    let telo;

    try {
      telo = await request.json();
    } catch {
      return odpoved({ chyba: "Neplatné údaje." }, 400);
    }

    const potraviny = await nacitajPotraviny();

    if (request.method === "POST") {
      const nazov = typeof telo.nazov === "string"
        ? telo.nazov.trim() : "";

      const popis = typeof telo.popis === "string"
        ? telo.popis.trim() : "";

      const cena = Number(telo.cena);

      let obrazok = typeof telo.obrazok === "string"
        ? telo.obrazok.trim() : "";

      if (!nazov || nazov.length > 80) {
        return odpoved({
          chyba: "Názov musí mať 1 až 80 znakov."
        }, 400);
      }

      if (!Number.isFinite(cena) ||
          cena < 0 || cena > 1000000) {
        return odpoved({ chyba: "Neplatná cena." }, 400);
      }

      if (popis.length > 300) {
        return odpoved({ chyba: "Popis je príliš dlhý." }, 400);
      }

      if (obrazok) {
        try {
          const url = new URL(obrazok);
          if (url.protocol !== "https:") throw new Error();
        } catch {
          return odpoved({
            chyba: "Obrázok musí mať platnú HTTPS adresu."
          }, 400);
        }
      } else {
        obrazok = "https://placehold.co/600x400?text=Potravina";
      }

      const novaPotravina = {
        id: randomUUID(),
        nazov,
        cena: Math.round(cena * 100) / 100,
        popis,
        obrazok
      };

      potraviny.push(novaPotravina);
      await sklad.set(KLUC, JSON.stringify(potraviny));

      return odpoved({
        sprava: "Potravina bola pridaná.",
        potravina: novaPotravina
      }, 201);
    }

    if (request.method === "DELETE") {
      const id = typeof telo.id === "string" ? telo.id : "";

      if (!id) {
        return odpoved({ chyba: "Chýba ID potraviny." }, 400);
      }

      const novePotraviny = potraviny.filter(p => p.id !== id);

      if (novePotraviny.length === potraviny.length) {
        return odpoved({ chyba: "Potravina sa nenašla." }, 404);
      }

      await sklad.set(KLUC, JSON.stringify(novePotraviny));

      return odpoved({
        sprava: "Potravina bola odstránená."
      });
    }
  } catch (chyba) {
    console.error("Chyba obchodu:", chyba);
    return odpoved({
      chyba: "Chyba servera. Skontroluj záznamy Netlify Functions."
    }, 500);
  }
}

export const config = {
  path: "/api/products"
};
