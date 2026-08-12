"use client";

import { useEffect, useState } from "react";

type JsonObject = Record<string, unknown>;

const defaultPrompt = "Reserve the Buriti room for the morning shift and add an hourly rental if needed.";

export default function Home() {
  const [staticJson, setStaticJson] = useState<JsonObject>({});
  const [dynamicJson, setDynamicJson] = useState<JsonObject>({});
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [responseText, setResponseText] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/data");
        const data = await res.json();
        setStaticJson(data.staticJson ?? {});
        setDynamicJson(data.dynamicJson ?? {});
      } catch {
        setError("Could not load JSON files.");
      }
    }

    loadData();
  }, []);

  const roomNames = Array.isArray(dynamicJson.salas) && dynamicJson.salas.length > 0
    ? (dynamicJson.salas as string[])
    : ["Buriti", "Sertão", "Chapada"];

  function formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatShortDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }).format(date).replace(".", "");
  }

  function resolveBookingDate(rawValue: string) {
    const value = rawValue.trim().toLowerCase();
    if (!value) return null;

    const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const brMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const dayMap: Record<string, number> = {
      domingo: 0,
      segunda: 1,
      terca: 2,
      quarta: 3,
      quinta: 4,
      sexta: 5,
      sabado: 6,
      sábado: 6,
    };

    const matchingDay = Object.keys(dayMap).find((name) => value.includes(name));
    if (matchingDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDay = dayMap[matchingDay];
      const currentDay = today.getDay();
      let diff = (targetDay - currentDay + 7) % 7;

      if (value.includes("próximo") && diff === 0) {
        diff = 7;
      }

      if (value.includes("passado") || value.includes("anterior")) {
        diff = diff === 0 ? -7 : diff * -1;
      }

      today.setDate(today.getDate() + diff);
      return formatDateKey(today);
    }

    if (value.includes("hoje")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return formatDateKey(today);
    }

    if (value.includes("amanhã") || value.includes("amanha")) {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return formatDateKey(tomorrow);
    }

    return null;
  }

  const futureDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);

    return {
      key: formatDateKey(date),
      label: formatShortDate(date),
    };
  });

  const roomSummary = roomNames.map((room) => {
    const turnos = Array.isArray(dynamicJson.turnos) ? (dynamicJson.turnos as Array<Record<string, unknown>>) : [];
    const bookings = Array.isArray(dynamicJson.alugueisPorTurno)
      ? (dynamicJson.alugueisPorTurno as Array<Record<string, unknown>>)
      : [];

    const turnoStatus = turnos.map((turno) => {
      const inicio = String(turno.inicio ?? "");
      const fim = String(turno.fim ?? "");
      const nome = String(turno.nome ?? "");
      const range = `${inicio}${inicio && fim ? "-" : ""}${fim}`;

      const cells = futureDates.map((date) => {
        const booking = bookings.find((item) => {
          if (String(item.sala ?? "") !== room) return false;
          if (String(item.turno ?? "") !== range) return false;
          return resolveBookingDate(String(item.data ?? "")) === date.key;
        });

        const status = String(booking?.status ?? "disponivel");
        const statusLabel =
          status === "ocupado" ? "Ocupado" : status === "reservado" ? "Reservado" : "Disponível";

        return {
          dateKey: date.key,
          status,
          statusLabel,
        };
      });

      return {
        name: nome ? `${nome} (${range})` : range,
        cells,
      };
    });

    const anyBooked = turnoStatus.some((entry) =>
      entry.cells.some((cell) => cell.status !== "disponivel"),
    );

    return {
      room,
      status: anyBooked ? "ocupada" : "disponível",
      label: anyBooked ? "Ocupada" : "Disponível",
      turnoStatus,
    };
  });

  async function submitPrompt() {
    setLoading(true);
    setError("");
    setResponseText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, staticJson, dynamicJson }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Unknown response from Gemini.");
      }

      if (data?.requiresInput) {
        setResponseText(data.summary ?? data.question ?? "Please provide the missing required fields.");
        return;
      }

      if (data?.dynamicJson && typeof data.dynamicJson === "object" && !Array.isArray(data.dynamicJson)) {
        setDynamicJson(data.dynamicJson);
      }

      setResponseText(data.summary ?? "JSON updated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function saveDynamicJson() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dynamicJson }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Could not save dynamic JSON.");
      }

      setResponseText("Dynamic JSON saved successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
        {/* <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Static JSON</h1>
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">
              source of truth
            </span>
          </div>
          <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-200">
            {JSON.stringify(staticJson, null, 2)}
          </pre>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Dynamic JSON</h2>
            <button
              type="button"
              onClick={saveDynamicJson}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              disabled={loading}
            >
              Save JSON
            </button>
          </div>

          <textarea
            value={JSON.stringify(dynamicJson, null, 2)}
            onChange={(event) => {
              try {
                const parsed = JSON.parse(event.target.value);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  setDynamicJson(parsed);
                  setError("");
                } else {
                  setError("Dynamic JSON must be a valid object.");
                }
              } catch {
                setError("Invalid JSON syntax in dynamic object.");
              }
            }}
            className="h-72 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-100 outline-none ring-0"
          />
        </section> */}

        <section className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h3 className="mb-4 text-xl font-bold">Gemini prompt By Leonardo Liulle</h3>
          <p className="mb-2 text-sm text-slate-300">
            Write your request in plain text. If required fields are missing, Gemini will ask a follow-up question.
          </p>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-100 outline-none"
            placeholder="Exemplo: Reserve o Buriti para o próximo sábado, das 07:00 às 13:00."
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submitPrompt}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Processando..." : "Enviar para o Gemini"}
            </button>
            <button
              type="button"
              onClick={() => setPrompt(defaultPrompt)}
              className="rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800"
            >
              Reset prompt
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {responseText ? (
            <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {responseText}
            </div>
          ) : null}
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
              <h3 className="text-xl font-bold text-white">Ocupação e disponibilidade das salas no futuro</h3>
            </div>
          </div>

          <div className="space-y-4 overflow-x-auto pb-2">
            {roomSummary.map(({ room, label, turnoStatus }) => (
              <div key={room} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-lg font-semibold text-slate-100">{room}</h4>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      label === "Disponível"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {label}
                  </span>
                </div>

                <div className="min-w-[760px]">
                  <div
                    className="mb-2 grid gap-2 text-xs uppercase tracking-[0.14em] text-slate-400"
                    style={{ gridTemplateColumns: `180px repeat(${futureDates.length}, minmax(90px, 1fr))` }}
                  >
                    <div>Turno</div>
                    {futureDates.map(({ key, label: dateLabel }) => (
                      <div key={`${room}-${key}`} className="text-center">{dateLabel}</div>
                    ))}
                  </div>

                  {turnoStatus.map(({ name, cells }) => (
                    <div
                      key={`${room}-${name}`}
                      className="grid gap-2 border-t border-slate-800 py-2"
                      style={{ gridTemplateColumns: `180px repeat(${futureDates.length}, minmax(90px, 1fr))` }}
                    >
                      <div className="flex items-center text-sm font-medium text-slate-200">{name}</div>
                      {cells.map(({ dateKey, status, statusLabel }) => (
                        <div
                          key={`${room}-${name}-${dateKey}`}
                          className={`flex min-h-12 items-center justify-center rounded-lg border px-2 py-2 text-center text-[11px] font-semibold ${
                            status === "disponivel"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : status === "reservado"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : "border-red-500/30 bg-red-500/10 text-red-300"
                          }`}
                        >
                          {statusLabel}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
