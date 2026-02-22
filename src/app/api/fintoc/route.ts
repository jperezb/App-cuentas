import { NextRequest, NextResponse } from "next/server";

const FINTOC_SECRET_KEY = process.env.FINTOC_SECRET_KEY;
const FINTOC_API_URL = "https://api.fintoc.com/v1";

// Exchange a link token for account data
export async function POST(request: NextRequest) {
  if (!FINTOC_SECRET_KEY) {
    return NextResponse.json(
      { error: "Fintoc no está configurado. Agrega FINTOC_SECRET_KEY en las variables de entorno." },
      { status: 500 }
    );
  }

  try {
    const { linkToken } = await request.json();

    if (!linkToken || typeof linkToken !== "string") {
      return NextResponse.json(
        { error: "linkToken es requerido" },
        { status: 400 }
      );
    }

    // Exchange link token for a link
    const linkRes = await fetch(`${FINTOC_API_URL}/links`, {
      method: "POST",
      headers: {
        Authorization: FINTOC_SECRET_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ link_token: linkToken }),
    });

    if (!linkRes.ok) {
      const err = await linkRes.text();
      return NextResponse.json(
        { error: `Error de Fintoc: ${err}` },
        { status: linkRes.status }
      );
    }

    const link = await linkRes.json();

    // Get accounts for this link
    const accountsRes = await fetch(
      `${FINTOC_API_URL}/links/${link.id}/accounts`,
      {
        headers: { Authorization: FINTOC_SECRET_KEY },
      }
    );

    if (!accountsRes.ok) {
      return NextResponse.json(
        { error: "No se pudieron obtener las cuentas" },
        { status: 500 }
      );
    }

    const accounts = await accountsRes.json();

    return NextResponse.json({
      linkId: link.id,
      institution: link.institution,
      accounts: accounts.map(
        (acc: { id: string; name: string; type: string; currency: string; balance: { current: number } }) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          currency: acc.currency,
          balance: acc.balance?.current || 0,
        })
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al conectar con Fintoc" },
      { status: 500 }
    );
  }
}

// Get movements for a linked account
export async function GET(request: NextRequest) {
  if (!FINTOC_SECRET_KEY) {
    return NextResponse.json(
      { error: "Fintoc no configurado" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("linkId");
  const accountId = searchParams.get("accountId");

  if (!linkId || !accountId) {
    return NextResponse.json(
      { error: "linkId y accountId son requeridos" },
      { status: 400 }
    );
  }

  try {
    const movRes = await fetch(
      `${FINTOC_API_URL}/links/${linkId}/accounts/${accountId}/movements?per_page=50`,
      {
        headers: { Authorization: FINTOC_SECRET_KEY },
      }
    );

    if (!movRes.ok) {
      return NextResponse.json(
        { error: "No se pudieron obtener los movimientos" },
        { status: 500 }
      );
    }

    const movements = await movRes.json();
    return NextResponse.json(movements);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener movimientos" },
      { status: 500 }
    );
  }
}
