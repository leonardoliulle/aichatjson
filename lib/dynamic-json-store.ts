import { get, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const localDynamicPath = path.join(dataDir, "jsondinamic.json");
const dynamicBlobPathname = "data/jsondinamic.json";

export const defaultDynamicJson = {
  nomeEspaco: "Espaco de Atendimentos",
  salas: ["Buriti", "Sertão", "Chapada"],
  turnos: [
    {
      nome: "Manha",
      inicio: "07:00",
      fim: "13:00",
    },
    {
      nome: "Tarde",
      inicio: "13:00",
      fim: "18:00",
    },
    {
      nome: "Noite",
      inicio: "18:00",
      fim: "23:00",
    },
  ],
  regras: {
    umaSalaNaoPodeSerOcupadaNoMesmoHorario: true,
    aluguelPorHoraLiberado: true,
  },
  alugueisPorTurno: [],
  alugueisPorHora: [],
};

type DynamicJson = Record<string, unknown>;

function cloneDefaultDynamicJson() {
  return JSON.parse(JSON.stringify(defaultDynamicJson)) as DynamicJson;
}

function canUseBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocalDynamicJson() {
  try {
    const content = await fs.readFile(localDynamicPath, "utf8");
    return JSON.parse(content) as DynamicJson;
  } catch {
    return cloneDefaultDynamicJson();
  }
}

async function writeLocalDynamicJson(dynamicJson: DynamicJson) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(localDynamicPath, JSON.stringify(dynamicJson, null, 2));
}

export async function readDynamicJson() {
  if (!canUseBlob()) {
    return readLocalDynamicJson();
  }

  const blobResult = await get(dynamicBlobPathname, {
    access: "public",
    useCache: false,
  });

  if (!blobResult) {
    const fallback = await readLocalDynamicJson();
    await writeDynamicJson(fallback);
    return fallback;
  }

  if (blobResult.statusCode !== 200 || !blobResult.stream) {
    throw new Error("Failed to read dynamic JSON from Vercel Blob.");
  }

  const content = await new Response(blobResult.stream).text();
  return JSON.parse(content) as DynamicJson;
}

export async function writeDynamicJson(dynamicJson: DynamicJson) {
  if (!canUseBlob()) {
    await writeLocalDynamicJson(dynamicJson);
    return;
  }

  await put(dynamicBlobPathname, JSON.stringify(dynamicJson, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
