"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crosshair,
  ImagePlus,
  Pencil,
  Send,
  Sprout,
  Trash2,
  Waves,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  REPORT_CATEGORIES,
  categoryLabel,
} from "@/lib/reports/reportCategories";
import { REPORT_STATION_OPTIONS, resolveStationOption } from "@/lib/reports/reportStations";
import { cn } from "@/lib/utils";
import type { StationKind } from "@/lib/stationProfile";

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };

const STEPS = [
  { id: 1, label: "Địa điểm" },
  { id: 2, label: "Quan sát" },
  { id: 3, label: "Bằng chứng" },
  { id: 4, label: "Xem lại" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface LocalImage {
  url: string;
  name: string;
  size: number;
}

interface SubmitResult {
  id: string;
  demo: boolean;
  stationName: string;
  categoryLabel: string;
  submittedAt: string;
  hadImage: boolean;
}

function errorMessageFor(status: number, code: string | undefined): string {
  if (status === 429) return "Bạn đã gửi khá nhiều báo cáo trong một giờ qua. Vui lòng thử lại sau.";
  if (code === "description_too_short") return `Mô tả cần ít nhất ${DESCRIPTION_MIN} ký tự.`;
  if (code === "description_too_long") return `Mô tả tối đa ${DESCRIPTION_MAX} ký tự.`;
  if (code === "invalid_category") return "Loại hiện trạng không hợp lệ. Vui lòng chọn lại.";
  return "Không gửi được báo cáo. Vui lòng kiểm tra kết nối và thử lại.";
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Progress rail — the record strip
// ---------------------------------------------------------------------------

function StepRail({
  current,
  furthest,
  onJump,
  record,
}: {
  current: StepId;
  furthest: StepId;
  onJump: (step: StepId) => void;
  record: { label: string; value: string | null }[];
}) {
  return (
    <aside className="space-y-8">
      <ol className="flex gap-2 lg:flex-col lg:gap-0" aria-label="Tiến trình báo cáo">
        {STEPS.map((step) => {
          const active = step.id === current;
          const done = step.id < furthest || (step.id < current && step.id <= furthest);
          const reachable = step.id <= furthest;
          return (
            <li key={step.id} className="flex-1 lg:flex-none">
              <button
                type="button"
                onClick={() => reachable && onJump(step.id)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group w-full text-left transition-colors duration-[var(--motion-base)]",
                  "lg:flex lg:items-baseline lg:gap-3 lg:border-l-2 lg:py-2.5 lg:pl-4",
                  active ? "lg:border-accent" : "lg:border-border/60",
                  reachable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "block h-0.5 w-full rounded-full transition-colors duration-[var(--motion-base)] lg:hidden",
                    active ? "bg-accent" : done ? "bg-accent/40" : "bg-border",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "mt-2 block text-[10px] font-medium uppercase tracking-[0.16em] lg:mt-0 lg:text-[11px]",
                    active ? "text-accent" : reachable ? "text-muted" : "text-muted/50",
                  )}
                >
                  {String(step.id).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "hidden text-sm lg:block",
                    active ? "font-semibold text-foreground" : reachable ? "text-muted" : "text-muted/50",
                  )}
                >
                  {step.label}
                </span>
                {done ? <Check className="hidden h-3.5 w-3.5 shrink-0 text-accent lg:block" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ol>

      {/* The accumulating field record — desktop only; on mobile the review
          step itself covers this and a duplicate would just cost scroll. */}
      <div className="hidden space-y-4 border-t border-border/60 pt-6 lg:block">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Bản ghi</p>
        <dl className="space-y-3">
          {record.map((item) => (
            <div key={item.label} className="space-y-0.5">
              <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{item.label}</dt>
              <dd className={cn("text-sm leading-snug", item.value ? "text-foreground" : "text-muted/60")}>
                {item.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

function SuccessView({ result, onAnother }: { result: SubmitResult; onAnother: () => void }) {
  return (
    <div className="animate-entrance max-w-2xl space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Check className="h-4 w-4 text-healthy" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-healthy">Đã ghi nhận hiện trường</p>
        </div>
        <h2 className="text-h1 font-semibold tracking-tight">Cảm ơn bạn đã ghi lại điều này.</h2>
        <p className="text-sm leading-relaxed text-muted">
          {result.demo
            ? "Hệ thống chưa kết nối được tới cơ sở dữ liệu chính, nên báo cáo đang được giữ trên máy chủ này. Nội dung bạn gửi là thật, nhưng có thể không được giữ lâu dài."
            : "Báo cáo đã được lưu vào cơ sở dữ liệu quan trắc."}
        </p>
      </div>

      <dl className="divide-y divide-border/50 border-y border-border/50">
        {[
          { label: "Mã tham chiếu", value: result.id, mono: true },
          { label: "Trạm", value: result.stationName },
          { label: "Hiện trạng", value: result.categoryLabel },
          { label: "Thời điểm", value: result.submittedAt },
          ...(result.hadImage ? [{ label: "Ảnh", value: "Không được gửi kèm — chưa hỗ trợ lưu ảnh" }] : []),
        ].map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{row.label}</dt>
            <dd className={cn("text-sm", "mono" in row && row.mono && "[font-family:var(--font-data)]")}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {result.demo ? (
        <div className="inline-flex items-center gap-2 rounded-sm bg-watch-bg px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-watch">Bản ghi tạm</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button onClick={onAnother}>Ghi nhận quan sát khác</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Về đài quan trắc</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export function ReportForm() {
  const searchParams = useSearchParams();
  const presetStation = resolveStationOption(searchParams.get("station"));

  const [step, setStep] = useState<StepId>(presetStation ? 2 : 1);
  const [furthest, setFurthest] = useState<StepId>(presetStation ? 2 : 1);
  const [stationId, setStationId] = useState<string | null>(presetStation?.id ?? null);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "error">("idle");
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [image, setImage] = useState<LocalImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const stepChangedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const station = useMemo(() => REPORT_STATION_OPTIONS.find((s) => s.id === stationId) ?? null, [stationId]);
  const trimmed = description.trim();

  // Object URLs are not garbage-collected on their own — release the previous
  // preview whenever it is replaced or the form unmounts.
  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land on the task rather than staying on the (now unmounted) Next button.
  useEffect(() => {
    if (!stepChangedRef.current) return;
    stepChangedRef.current = false;
    headingRef.current?.focus();
  }, [step]);

  const goto = useCallback((next: StepId) => {
    stepChangedRef.current = true;
    setStep(next);
    setFurthest((prev) => (next > prev ? next : prev));
  }, []);

  const stepValid: Record<StepId, boolean> = {
    1: stationId !== null,
    2: category !== null && trimmed.length >= DESCRIPTION_MIN && trimmed.length <= DESCRIPTION_MAX,
    3: true,
    4: true,
  };

  async function handleLocate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsState("error");
      setGpsNote("Thiết bị không hỗ trợ định vị. Báo cáo sẽ dùng vị trí trạm bạn chọn.");
      return;
    }

    setGpsState("locating");
    setGpsNote(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 60000,
          enableHighAccuracy: true,
        });
      });
      setGps({ lat: position.coords.latitude, lng: position.coords.longitude });
      setGpsState("idle");
    } catch {
      setGpsState("error");
      setGpsNote("Chưa lấy được vị trí. Báo cáo vẫn gửi được bằng vị trí trạm bạn chọn.");
    }
  }

  function handlePickImage(file: File | undefined) {
    setImageError(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Tệp này không phải ảnh. Vui lòng chọn ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError(`Ảnh vượt quá ${formatBytes(IMAGE_MAX_BYTES)}. Vui lòng chọn ảnh nhỏ hơn.`);
      return;
    }

    setImage({ url: URL.createObjectURL(file), name: file.name, size: file.size });
  }

  function clearImage() {
    setImage(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (submitting || !station || !category) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/public/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: trimmed,
          lat: gps?.lat,
          lng: gps?.lng,
          stationId: station.id,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; demo?: boolean; error?: string };

      if (!res.ok || payload.ok !== true) {
        setError(errorMessageFor(res.status, payload.error));
        return;
      }

      setResult({
        id: payload.id ?? "—",
        demo: payload.demo === true,
        stationName: station.name,
        categoryLabel: categoryLabel(category),
        submittedAt: new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
        hadImage: image !== null,
      });
    } catch {
      setError("Không gửi được báo cáo. Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    clearImage();
    setResult(null);
    setStationId(presetStation?.id ?? null);
    setCategory(null);
    setDescription("");
    setGps(null);
    setGpsState("idle");
    setGpsNote(null);
    setError(null);
    stepChangedRef.current = true;
    setStep(presetStation ? 2 : 1);
    setFurthest(presetStation ? 2 : 1);
  }

  if (result) {
    return <SuccessView result={result} onAnother={resetForm} />;
  }

  const locationSummary = gps
    ? `GPS thiết bị · ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
    : station
      ? "Theo vị trí trạm đã chọn"
      : null;

  const record = [
    { label: "Trạm", value: station?.name ?? null },
    { label: "Hiện trạng", value: category ? categoryLabel(category) : null },
    { label: "Vị trí", value: locationSummary },
    { label: "Mô tả", value: trimmed ? `${trimmed.length} ký tự` : null },
    { label: "Ảnh", value: image ? "1 ảnh (chỉ trong phiên)" : null },
  ];

  const currentStep = STEPS.find((s) => s.id === step)!;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.26fr)_minmax(0,0.74fr)] lg:gap-16">
      <StepRail current={step} furthest={furthest} onJump={goto} record={record} />

      {/* Capped to a reading measure rather than filling the column: these are
          field controls, and a 900px-wide row strands the station id far from
          its name. The asymmetry (narrow rail + this block sitting left of
          centre) is what uses the wide viewport deliberately — stretching the
          inputs themselves would not. */}
      <div className="min-w-0 max-w-3xl">
        <div key={step} className="animate-entrance space-y-8">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
              {String(currentStep.id).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")} ·{" "}
              {currentStep.label}
            </p>
            {/*
              Programmatically focused on every step change so assistive tech
              lands on the new task instead of the unmounted Next button. The
              visible ring is suppressed here specifically: globals.css's
              `:focus-visible` rule would otherwise draw a box around a
              non-interactive heading, which reads as a text input. `[&:focus]`
              is used rather than `outline-none` because it compiles to
              `.cls:focus` (specificity 0,2,0) and so actually beats the global
              `:focus-visible` (0,1,0) — a plain utility ties and loses on
              source order. Every real control (radios, textarea, file input,
              buttons) keeps its focus ring.
            */}
            <h2 ref={headingRef} tabIndex={-1} className="text-h1 font-semibold tracking-tight [&:focus]:outline-none">
              {step === 1 ? "Bạn đang ở gần trạm nào?" : null}
              {step === 2 ? "Bạn thấy gì?" : null}
              {step === 3 ? "Có ảnh kèm theo không?" : null}
              {step === 4 ? "Kiểm tra lại trước khi gửi." : null}
            </h2>
          </div>

          {/* 01 — Location */}
          {step === 1 ? (
            <div className="space-y-8">
              <fieldset className="space-y-3">
                <legend className="sr-only">Chọn trạm gần nhất</legend>
                {REPORT_STATION_OPTIONS.map((option) => {
                  const Icon = KIND_ICON[option.kind];
                  const active = stationId === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-4 border-l-2 py-4 pl-4 pr-3 transition-colors duration-[var(--motion-base)]",
                        "focus-within:ring-2 focus-within:ring-accent",
                        active ? "border-accent bg-accent/[0.06]" : "border-border/60 hover:border-border hover:bg-muted/20",
                      )}
                    >
                      <input
                        type="radio"
                        name="station"
                        value={option.id}
                        checked={active}
                        onChange={() => setStationId(option.id)}
                        className="sr-only"
                      />
                      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-accent" : "text-muted")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-base font-semibold tracking-tight", active && "text-accent")}>
                          {option.name}
                        </span>
                        <span className="block text-sm text-muted">{option.location}</span>
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted/70 [font-family:var(--font-data)]">
                        {option.id}
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden /> : null}
                    </label>
                  );
                })}
              </fieldset>

              <div className="space-y-3 border-t border-border/50 pt-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Vị trí chính xác hơn</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" onClick={handleLocate} disabled={gpsState === "locating"}>
                    <Crosshair className={cn("h-4 w-4", gpsState === "locating" && "animate-pulse")} aria-hidden />
                    {gpsState === "locating" ? "Đang định vị…" : gps ? "Cập nhật lại vị trí" : "Dùng vị trí hiện tại"}
                  </Button>
                  {gps ? (
                    <p className="text-sm text-muted [font-family:var(--font-data)]">
                      {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {gps
                    ? "Báo cáo sẽ dùng vị trí GPS này."
                    : gpsNote ?? "Không bắt buộc. Nếu bỏ qua, báo cáo được gắn theo vị trí trạm bạn chọn."}
                </p>
              </div>
            </div>
          ) : null}

          {/* 02 — Observation */}
          {step === 2 ? (
            <div className="space-y-8">
              <fieldset>
                <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  Loại hiện trạng
                </legend>
                <div className="divide-y divide-border/50 border-y border-border/50">
                  {REPORT_CATEGORIES.map((item) => {
                    const active = category === item.value;
                    return (
                      <label
                        key={item.value}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-4 py-3.5 pl-1 pr-1 transition-colors duration-[var(--motion-base)]",
                          "focus-within:ring-2 focus-within:ring-accent",
                          active ? "text-accent" : "hover:bg-muted/20",
                        )}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={item.value}
                          checked={active}
                          onChange={() => setCategory(item.value)}
                          className="sr-only"
                        />
                        <span className={cn("text-base", active && "font-semibold")}>{item.label}</span>
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--motion-base)]",
                            active ? "border-accent bg-accent" : "border-border-strong",
                          )}
                          aria-hidden
                        >
                          {active ? <Check className="h-3 w-3 text-background" /> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="block text-[11px] font-medium uppercase tracking-[0.16em] text-muted"
                >
                  Mô tả
                </label>
                <Textarea
                  id="description"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="Bạn nhìn thấy gì, ở đâu, và khi nào?"
                  className="min-h-[160px] rounded-lg bg-background text-base"
                  aria-describedby="description-hint"
                />
                <p id="description-hint" className="text-xs text-muted">
                  {trimmed.length < DESCRIPTION_MIN
                    ? `Cần ít nhất ${DESCRIPTION_MIN} ký tự — hiện có ${trimmed.length}.`
                    : `${trimmed.length} / ${DESCRIPTION_MAX} ký tự.`}
                </p>
              </div>
            </div>
          ) : null}

          {/* 03 — Evidence */}
          {step === 3 ? (
            <div className="space-y-6">
              <Alert tone="info">
                Lưu ảnh chưa được bật trong hệ thống hiện tại. Ảnh bạn chọn chỉ hiển thị trong phiên này để đối chiếu
                khi viết mô tả, và <strong className="font-semibold">không được gửi đi cùng báo cáo</strong>.
              </Alert>

              {image ? (
                <div className="animate-entrance space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never a remote asset; next/image cannot optimize a blob: URL */}
                  <img
                    src={image.url}
                    alt={`Xem trước ảnh đã chọn: ${image.name}`}
                    className="max-h-[320px] w-full rounded-lg border border-border object-contain"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 text-sm text-muted">
                      <span className="block truncate font-medium text-foreground">{image.name}</span>
                      {formatBytes(image.size)} · chỉ trong phiên này
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Đổi ảnh
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearImage}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Bỏ ảnh
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="report-image"
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center transition-colors duration-[var(--motion-base)]",
                    "hover:border-accent/50 hover:bg-accent/[0.03] focus-within:ring-2 focus-within:ring-accent",
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handlePickImage(e.dataTransfer.files?.[0]);
                  }}
                >
                  <ImagePlus className="h-6 w-6 text-muted" aria-hidden />
                  <span className="text-sm font-medium">Chọn ảnh từ thiết bị</span>
                  <span className="text-xs text-muted">Kéo thả hoặc chạm để chọn · JPG, PNG, WEBP · tối đa 8 MB</span>
                </label>
              )}

              {/* One always-mounted input, referenced by the dropzone's htmlFor
                  and by the "Đổi ảnh" button — so the ref stays valid whether
                  or not a preview is currently showing. */}
              <input
                ref={fileInputRef}
                id="report-image"
                type="file"
                accept={IMAGE_ACCEPT}
                className="sr-only"
                onChange={(e) => handlePickImage(e.target.files?.[0])}
              />

              {imageError ? <Alert tone="critical">{imageError}</Alert> : null}

              <p className="text-sm leading-relaxed text-muted">
                Không có ảnh cũng không sao — mô tả cụ thể (vị trí, hiện trạng, mức độ) là phần quan trọng nhất.
              </p>
            </div>
          ) : null}

          {/* 04 — Review */}
          {step === 4 ? (
            <div className="space-y-8">
              <dl className="divide-y divide-border/50 border-y border-border/50">
                {[
                  { label: "Trạm", value: station ? `${station.name} · ${station.location}` : "—", jump: 1 as StepId },
                  { label: "Hiện trạng", value: category ? categoryLabel(category) : "—", jump: 2 as StepId },
                  { label: "Vị trí", value: locationSummary ?? "—", jump: 1 as StepId },
                  { label: "Mô tả", value: trimmed || "—", jump: 2 as StepId },
                  {
                    label: "Ảnh",
                    value: image ? `${image.name} — không gửi kèm (chưa hỗ trợ lưu ảnh)` : "Không có",
                    jump: 3 as StepId,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0 space-y-1">
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{row.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.value}</dd>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => goto(row.jump)}
                      className="shrink-0 text-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Sửa </span>
                      Sửa
                    </Button>
                  </div>
                ))}
              </dl>

              <p className="text-sm leading-relaxed text-muted">
                Đây là một quan sát từ hiện trường, không phải số đo của trạm quan trắc.
              </p>

              {error ? <Alert tone="critical">{error}</Alert> : null}
            </div>
          ) : null}

          {/* Navigation */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-6">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => goto((step - 1) as StepId)}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Quay lại
              </Button>
            ) : null}

            {step < 4 ? (
              <Button
                type="button"
                onClick={() => goto((step + 1) as StepId)}
                disabled={!stepValid[step]}
                className="min-w-[140px]"
              >
                Tiếp tục
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting} className="min-w-[160px]">
                {submitting ? "Đang gửi…" : "Gửi báo cáo"}
                {submitting ? null : <Send className="h-4 w-4" aria-hidden />}
              </Button>
            )}

            {step < 4 && !stepValid[step] ? (
              <p className="text-xs text-muted">
                {step === 1 ? "Chọn một trạm để tiếp tục." : "Chọn loại hiện trạng và viết mô tả để tiếp tục."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
