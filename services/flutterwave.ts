import { randomBytes } from "node:crypto";
import { headers } from "next/headers";

const FLW_BASE_URL = "https://api.flutterwave.com/v3";

export class FlutterwaveNotConfiguredError extends Error {
  constructor() {
    super("Flutterwave is not configured on this server.");
    this.name = "FlutterwaveNotConfiguredError";
  }
}

export function isFlutterwaveConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

function requireSecretKey(): string {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    throw new FlutterwaveNotConfiguredError();
  }
  return secretKey;
}

export function createTransactionReference(): string {
  const random = randomBytes(8).toString("hex");
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  return `FLW-${timestamp}-${random}`;
}

function majorFromMinor(amountMinor: number): number {
  return Math.trunc(amountMinor / 100);
}

function minorFromMajor(amountMajor: number): number {
  return Math.trunc(amountMajor * 100);
}

export async function getAppBaseUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3000";
  return `${protocol}://${host}`;
}

export async function initializeCheckout(input: {
  txRef: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  redirectUrl: string;
}): Promise<{ checkoutUrl: string }> {
  const secretKey = requireSecretKey();

  const response = await fetch(`${FLW_BASE_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: majorFromMinor(input.amountMinor),
      currency: input.currency.toUpperCase(),
      redirect_url: input.redirectUrl,
      payment_options: "card,ussd,banktransfer,mobilemoney,account,payattitude",
      customer: {
        email: input.customerEmail,
        name: input.customerName,
      },
      customizations: {
        title: "AI Study Companion",
        description: "Premium subscription",
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    status?: string;
    data?: { link?: string };
  } | null;

  if (
    !response.ok ||
    payload?.status !== "success" ||
    !payload?.data?.link
  ) {
    throw new Error("Flutterwave checkout could not be initialized.");
  }

  return { checkoutUrl: payload.data.link };
}

export async function verifyTransaction(txRef: string): Promise<{
  status: string;
  transactionId: string;
  amountMinor: number;
  currency: string;
}> {
  const secretKey = requireSecretKey();

  const response = await fetch(
    `${FLW_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    status?: string;
    data?: {
      id?: string | number;
      status?: string;
      amount?: number | string;
      currency?: string;
    };
  } | null;

  if (!response.ok || payload?.status !== "success" || !payload?.data) {
    throw new Error("Unable to verify the payment at this time.");
  }

  const data = payload.data;
  return {
    status: String(data.status ?? "").toLowerCase(),
    transactionId: String(data.id ?? ""),
    amountMinor: minorFromMajor(Number(data.amount ?? 0)),
    currency: String(data.currency ?? "").toUpperCase(),
  };
}
