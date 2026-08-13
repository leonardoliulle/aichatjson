import { promises as fs } from "fs";
import path from "path";
import { readDynamicJson, writeDynamicJson } from "@/lib/dynamic-json-store";
import { NextResponse } from "next/server";

const dataDir = path.join(process.cwd(), "data");
const staticPath = path.join(dataDir, "jsonstatic.json");

const defaultStaticJson = {
  schemaVersion: 1,
  entity: "espaco_atendimentos",
  requiredFields: [
    "nomeEspaco",
    "salas",
    "turnos",
    "regras",
    "alugueisPorTurno",
    "alugueisPorHora",
  ],
  rules: {
    salas: ["Buriti", "Sertão", "Chapada"],
    turnos: ["07:00-13:00", "13:00-18:00", "18:00-23:00"],
    "alugueisPorTurno.status": ["disponivel", "ocupado", "reservado"],
    "alugueisPorHora.status": ["disponivel", "ocupado", "reservado"],
  },
  fields: {
    nomeEspaco: "string",
    salas: ["Buriti", "Sertão", "Chapada"],
    turnos: [
      {
        nome: "string",
        inicio: "string",
        fim: "string",
      },
    ],
    regras: {
      umaSalaNaoPodeSerOcupadaNoMesmoHorario: "boolean",
      aluguelPorHoraLiberado: "boolean",
    },
    alugueisPorTurno: [
      {
        data: "string",
        sala: "string",
        turno: "string",
        status: "string",
        responsavel: "string",
      },
    ],
    alugueisPorHora: [
      {
        data: "string",
        sala: "string",
        inicio: "string",
        fim: "string",
        status: "string",
        responsavel: "string",
      },
    ],
  },
};

async function ensureStaticFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(staticPath);
  } catch {
    await fs.writeFile(staticPath, JSON.stringify(defaultStaticJson, null, 2));
  }
}

async function readJson(filePath: string) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

export async function GET() {
  await ensureStaticFile();

  const [staticJson, dynamicJson] = await Promise.all([
    readJson(staticPath),
    readDynamicJson(),
  ]);

  return NextResponse.json({ staticJson, dynamicJson });
}

export async function POST(request: Request) {
  await ensureStaticFile();

  const body = await request.json();
  const dynamicJson = body?.dynamicJson;

  if (!dynamicJson || typeof dynamicJson !== "object" || Array.isArray(dynamicJson)) {
    return NextResponse.json(
      { error: "A valid JSON object is required in dynamicJson." },
      { status: 400 },
    );
  }

  await writeDynamicJson(dynamicJson);

  return NextResponse.json({ success: true, dynamicJson });
}
