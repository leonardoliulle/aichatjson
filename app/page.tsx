"use client";

import { useEffect, useState } from "react";

type JsonObject = Record<string, unknown>;

type ThemeMode = "light" | "green" | "dark";

const defaultPrompt = "Reserve a sala Buriti para o turno da manhã e adicione uma locação por hora, se necessário.";

const themeStyles: Record<ThemeMode, {
  page: string;
  card: string;
  panel: string;
  text: string;
  mutedText: string;
  border: string;
  textarea: string;
  buttonPrimary: string;
  buttonSecondary: string;
  statusBadgeOn: string;
  statusBadgeOff: string;
  tableHeader: string;
  tableRow: string;
  availableCell: string;
  reservedCell: string;
  occupiedCell: string;
}> = {
  green: {
    page: "bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 text-slate-100",
    card: "border-emerald-900/60 bg-slate-900/90 shadow-[0_20px_60px_rgba(4,120,87,0.18)]",
    panel: "border-slate-800 bg-slate-950/80",
    text: "text-slate-100",
    mutedText: "text-slate-300",
    border: "border-slate-700",
    textarea: "border-emerald-900/50 bg-slate-950 text-slate-100 placeholder:text-slate-500",
    buttonPrimary: "bg-emerald-600 text-white hover:bg-emerald-500",
    buttonSecondary: "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
    statusBadgeOn: "bg-emerald-500/15 text-emerald-300",
    statusBadgeOff: "bg-amber-500/15 text-amber-300",
    tableHeader: "text-slate-400",
    tableRow: "border-slate-800",
    availableCell: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    reservedCell: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    occupiedCell: "border-red-500/30 bg-red-500/10 text-red-300",
  },
  light: {
    page: "bg-gradient-to-br from-emerald-50 via-white to-slate-100 text-slate-900",
    card: "border-emerald-100 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
    panel: "border-slate-200 bg-white",
    text: "text-slate-900",
    mutedText: "text-slate-600",
    border: "border-slate-200",
    textarea: "border-emerald-200 bg-white text-slate-900 placeholder:text-slate-400",
    buttonPrimary: "bg-emerald-600 text-white hover:bg-emerald-500",
    buttonSecondary: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    statusBadgeOn: "bg-emerald-100 text-emerald-700",
    statusBadgeOff: "bg-amber-100 text-amber-700",
    tableHeader: "text-slate-500",
    tableRow: "border-slate-200",
    availableCell: "border-emerald-200 bg-emerald-50 text-emerald-700",
    reservedCell: "border-amber-200 bg-amber-50 text-amber-700",
    occupiedCell: "border-red-200 bg-red-50 text-red-700",
  },
  dark: {
    page: "bg-slate-950 text-slate-100",
    card: "border-slate-800 bg-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.3)]",
    panel: "border-slate-800 bg-slate-950",
    text: "text-slate-100",
    mutedText: "text-slate-300",
    border: "border-slate-700",
    textarea: "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500",
    buttonPrimary: "bg-emerald-600 text-white hover:bg-emerald-500",
    buttonSecondary: "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
    statusBadgeOn: "bg-emerald-500/15 text-emerald-300",
    statusBadgeOff: "bg-amber-500/15 text-amber-300",
    tableHeader: "text-slate-400",
    tableRow: "border-slate-800",
    availableCell: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    reservedCell: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    occupiedCell: "border-red-500/30 bg-red-500/10 text-red-300",
  },
};

export default function Home() {
  const [staticJson, setStaticJson] = useState<JsonObject>({});
  const [dynamicJson, setDynamicJson] = useState<JsonObject>({});
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [responseText, setResponseText] = useState("");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("aichatjson-theme");

    if (storedTheme === "green" || storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }

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

  useEffect(() => {
    window.localStorage.setItem("aichatjson-theme", theme);
  }, [theme]);

  const activeTheme = themeStyles[theme];

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
    <main className={`min-h-screen p-6 ${activeTheme.page}`}>
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
        

        <section className={`lg:col-span-2 rounded-2xl border p-6 shadow-xl ${activeTheme.card}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className={`text-xl font-bold ${activeTheme.text}`}>AI chat By Leonardo Liulle</h3>
              <p className={`mt-1 text-sm ${activeTheme.mutedText}`}>
                Escreva sua solicitação em texto simples. Se campos obrigatórios estiverem faltando, o Gemini fará uma pergunta complementar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["green", "light", "dark"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    theme === mode
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : activeTheme.buttonSecondary
                  }`}
                >
                  {mode === "green" ? "Green" : mode === "light" ? "White" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className={`min-h-28 w-full rounded-xl border p-4 outline-none ${activeTheme.textarea}`}
            placeholder="Exemplo: Reserve o Buriti para o próximo sábado, das 07:00 às 13:00."
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submitPrompt}
              className={`rounded-lg px-4 py-2 font-semibold transition disabled:opacity-60 ${activeTheme.buttonPrimary}`}
              disabled={loading}
            >
              {loading ? "Processando..." : "Enviar para o AI chat"}
            </button>
            <button
              type="button"
              onClick={() => setPrompt(defaultPrompt)}
              className={`rounded-lg border px-4 py-2 font-medium transition ${activeTheme.buttonSecondary}`}
            >
              Reset prompt
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {responseText ? (
            <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200">
              {responseText}
            </div>
          ) : null}
        </section>

        <section className={`lg:col-span-2 rounded-2xl border p-6 shadow-xl ${activeTheme.card}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${activeTheme.mutedText}`}>Status</p>
              <h3 className={`text-xl font-bold ${activeTheme.text}`}>Ocupação e disponibilidade das salas no futuro</h3>
            </div>
          </div>

          <div className="space-y-4 overflow-x-auto pb-2">
            {roomSummary.map(({ room, label, turnoStatus }) => (
              <div key={room} className={`rounded-xl border p-4 ${activeTheme.panel}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className={`text-lg font-semibold ${activeTheme.text}`}>{room}</h4>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      label === "Disponível" ? activeTheme.statusBadgeOn : activeTheme.statusBadgeOff
                    }`}
                  >
                    {label}
                  </span>
                </div>

                <div className="min-w-[760px]">
                  <div
                    className={`mb-2 grid gap-2 text-xs uppercase tracking-[0.14em] ${activeTheme.tableHeader}`}
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
                      className={`grid gap-2 border-t py-2 ${activeTheme.tableRow}`}
                      style={{ gridTemplateColumns: `180px repeat(${futureDates.length}, minmax(90px, 1fr))` }}
                    >
                      <div className={`flex items-center text-sm font-medium ${activeTheme.text}`}>{name}</div>
                      {cells.map(({ dateKey, status, statusLabel }) => (
                        <div
                          key={`${room}-${name}-${dateKey}`}
                          className={`flex min-h-12 items-center justify-center rounded-lg border px-2 py-2 text-center text-[11px] font-semibold ${
                            status === "disponivel"
                              ? activeTheme.availableCell
                              : status === "reservado"
                                ? activeTheme.reservedCell
                                : activeTheme.occupiedCell
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
