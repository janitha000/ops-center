import { OpsDashboardPayload } from "@/lib/types";
import {
  DecisionSeverity,
  DecisionSignal,
  TemporalDashboardModel,
} from "@/lib/decisions/types";
import { formatLKR, formatPercent, formatUSD } from "@/lib/utils";

export function escapeHtml(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatSltTimestamp(isoOrDate?: string | Date): {
  full: string;
  dateOnly: string;
} {
  const date = isoOrDate ? new Date(isoOrDate) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const full = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(safeDate);

  const dateOnly = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(safeDate);

  return { full: `${full} SLT`, dateOnly };
}

export function getOverallStatusBadge(decisions: TemporalDashboardModel["decisions"]): {
  label: string;
  bg: string;
  fg: string;
  border: string;
} {
  if (decisions.criticalCount > 0) {
    return {
      label: `CRITICAL (${decisions.criticalCount})`,
      bg: "#7f1d1d",
      fg: "#fecaca",
      border: "#ef4444",
    };
  }
  if (decisions.warningCount > 0) {
    return {
      label: `ATTENTION (${decisions.warningCount})`,
      bg: "#78350f",
      fg: "#fde68a",
      border: "#f59e0b",
    };
  }
  if (decisions.opportunityCount > 0) {
    return {
      label: `OPPORTUNITY (${decisions.opportunityCount})`,
      bg: "#164e63",
      fg: "#a5f3fc",
      border: "#06b6d4",
    };
  }
  return {
    label: "ALL SYSTEMS NOMINAL",
    bg: "#064e3b",
    fg: "#a7f3d0",
    border: "#10b981",
  };
}

function getSeverityColors(severity: DecisionSeverity): {
  label: string;
  bg: string;
  fg: string;
  accent: string;
} {
  switch (severity) {
    case "critical":
      return { label: "CRITICAL", bg: "#fef2f2", fg: "#b91c1c", accent: "#dc2626" };
    case "warning":
      return { label: "WARNING", bg: "#fffbeb", fg: "#b45309", accent: "#d97706" };
    case "opportunity":
      return { label: "OPPORTUNITY", bg: "#ecfeff", fg: "#0e7490", accent: "#0891b2" };
    default:
      return { label: "NOMINAL", bg: "#ecfdf5", fg: "#047857", accent: "#059669" };
  }
}

export function renderDecisionSignalsHtml(
  signals: DecisionSignal[],
  emptyMessage = "No active decision alerts. All monitored thresholds are within target parameters."
): string {
  if (!signals || signals.length === 0) {
    return `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; color: #475569; font-size: 13px;">
        ${escapeHtml(emptyMessage)}
      </div>`;
  }

  return signals
    .map((sig) => {
      const sev = getSeverityColors(sig.severity);
      const horizonColor =
        sig.horizon === "live"
          ? "#dc2626"
          : sig.horizon === "daily"
            ? "#d97706"
            : "#4f46e5";

      return `
      <div style="background-color: ${sev.bg}; border: 1px solid ${sev.accent}33; border-left: 4px solid ${sev.accent}; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align: top;">
              <div style="margin-bottom: 4px;">
                <span style="display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #ffffff; background-color: ${sev.accent}; padding: 2px 7px; border-radius: 4px; margin-right: 6px;">${sev.label}</span>
                <span style="display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: ${horizonColor}; background-color: #ffffff; border: 1px solid ${horizonColor}44; padding: 1px 6px; border-radius: 4px; margin-right: 6px;">${escapeHtml(sig.horizon)}</span>
                <span style="display: inline-block; font-size: 10px; font-weight: 700; color: #334155; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(sig.domain)}</span>
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                ${escapeHtml(sig.title)}
              </div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px; line-height: 1.45;">
                ${escapeHtml(sig.whyItMatters)}
              </div>
            </td>
            <td style="vertical-align: top; text-align: right; white-space: nowrap; padding-left: 12px;">
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">${escapeHtml(sig.metricLabel)}</div>
              <div style="font-size: 15px; font-weight: 800; color: ${sev.fg}; margin-top: 2px;">${escapeHtml(sig.currentValue)}</div>
              <div style="font-size: 11px; color: #64748b;">Target: ${escapeHtml(sig.thresholdValue)}</div>
            </td>
          </tr>
        </table>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed ${sev.accent}33; font-size: 12px; color: #0f172a;">
          <strong style="color: ${sev.fg};">Action:</strong> ${escapeHtml(sig.recommendedAction)}
        </div>
      </div>`;
    })
    .join("");
}

function formatDurationMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
}

function formatSltTime(isoOrText: string | null | undefined): string {
  if (!isoOrText) return "";
  const parsed = new Date(isoOrText);
  if (Number.isNaN(parsed.getTime())) return isoOrText;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
  return `${formatted} SLT`;
}

export function buildDailyOpsDigestEmail(
  payload: OpsDashboardPayload,
  temporal: TemporalDashboardModel
): { subject: string; html: string } {
  const slt = formatSltTimestamp(temporal.generatedAt || payload.timestamp);
  const statusBadge = getOverallStatusBadge(temporal.decisions);

  const prioritizedSignals = temporal.decisions.all
    .filter((d) => d.severity !== "nominal")
    .slice(0, 8);
  const displaySignals =
    prioritizedSignals.length > 0
      ? prioritizedSignals
      : temporal.decisions.all.slice(0, 4);

  const { live, daily, monthly } = temporal;
  const openPositions = payload.bot?.openPositions ?? [];

  const sugarOver = daily.sugarGrams > daily.sugarLimit;
  const sugarNear = !sugarOver && daily.sugarGrams >= daily.sugarLimit * 0.8;
  const sugarColor = sugarOver ? "#dc2626" : sugarNear ? "#d97706" : "#059669";

  const burnStatusColor =
    daily.dailyBurnStatus === "OVER_PACE"
      ? "#dc2626"
      : daily.dailyBurnStatus === "CAUTION"
        ? "#d97706"
        : "#059669";

  const gridBadgeColor =
    live.gridExportStatus === "EXPORTING"
      ? "#059669"
      : live.gridExportStatus === "IMPORTING"
        ? "#d97706"
        : "#475569";

  const nextRadarItem = [...(payload.investments?.maturityRadar ?? [])]
    .filter((item) => item.daysRemaining >= 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)[0];

  const eatingWindowClosingSoon =
    !live.fastingActive &&
    live.eatingWindowActive &&
    live.eatingWindowRemainingMinutes <= 60;
  const fastingCardLabel = live.fastingActive
    ? "16:8 Metabolic Fasting"
    : live.eatingWindowActive
      ? "8h Eating Window Countdown"
      : "16:8 Metabolic Fasting";
  const fastingHeadline = live.fastingActive
    ? formatDurationMinutes(live.fastingMinutes)
    : live.eatingWindowActive
      ? `Closes in ${formatDurationMinutes(live.eatingWindowRemainingMinutes)}`
      : "Window Closed";
  const fastingHeadlineColor = live.fastingActive
    ? "#059669"
    : live.eatingWindowActive
      ? eatingWindowClosingSoon
        ? "#d97706"
        : "#0891b2"
      : "#475569";
  const fastingSubline = live.fastingActive
    ? `${live.fastingPct.toFixed(0)}% of ${Math.round(live.fastingGoalMinutes / 60)}h goal${live.fastingStartTime ? ` &middot; Started ${escapeHtml(live.fastingStartTime)}` : ""}`
    : live.eatingWindowActive
      ? `${live.fastBrokenAt ? `Broken ${escapeHtml(formatSltTime(live.fastBrokenAt))}` : "Feeding active"}${live.eatingWindowClosesAt ? ` &middot; Closes ${escapeHtml(formatSltTime(live.eatingWindowClosesAt))}` : ""}`
      : "Start next 16:8 fat oxidation fast";

  const cseTopMoverColor =
    live.cseTopMoverChangePct >= 0 ? "#059669" : "#dc2626";
  const cseConcentrationColor =
    live.cseMaxConcentrationPct >= 22 ? "#d97706" : "#0f172a";

  const paceVarianceColor =
    daily.calendarPaceVariancePct > 10
      ? "#dc2626"
      : daily.calendarPaceVariancePct > 0
        ? "#d97706"
        : "#059669";

  const criticalTag =
    temporal.decisions.criticalCount > 0
      ? `${temporal.decisions.criticalCount} Critical`
      : temporal.decisions.warningCount > 0
        ? `${temporal.decisions.warningCount} Attention`
        : "Nominal";

  const subject = `⚡ Life-Ops Daily Digest (${slt.dateOnly}) — ${criticalTag} | Net Cal ${Math.round(daily.netCalorieBalance)} kcal · Solar ${daily.solarDailyKwh.toFixed(1)} kWh`;

  const openPositionsHtml =
    openPositions.length > 0
      ? `
      <div style="margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 7px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: left; text-transform: uppercase;">Open Pair</th>
              <th style="padding: 7px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: left; text-transform: uppercase;">Side</th>
              <th style="padding: 7px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Entry / Mark</th>
              <th style="padding: 7px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Unrealized PnL</th>
            </tr>
          </thead>
          <tbody>
            ${openPositions
              .slice(0, 5)
              .map((pos) => {
                const pnlColor = pos.unrealizedPnl >= 0 ? "#059669" : "#dc2626";
                return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 7px 10px; font-size: 12px; font-weight: 700; color: #0f172a;">${escapeHtml(pos.symbol)}</td>
                  <td style="padding: 7px 10px; font-size: 11px; font-weight: 700; color: ${pos.side === "LONG" ? "#059669" : "#dc2626"};">${escapeHtml(pos.side)}</td>
                  <td style="padding: 7px 10px; font-size: 11px; color: #475569; text-align: right;">${pos.entryPrice.toFixed(2)} &rarr; ${pos.currentPrice.toFixed(2)}</td>
                  <td style="padding: 7px 10px; font-size: 12px; font-weight: 700; color: ${pnlColor}; text-align: right;">${pos.unrealizedPnl >= 0 ? "+" : ""}${formatUSD(pos.unrealizedPnl)} (${formatPercent(pos.unrealizedPnlPct)})</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`
      : `<div style="margin-top: 8px; font-size: 12px; color: #64748b;">No open positions currently held.</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eef2f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 660px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #090b0e 0%, #111827 65%, #0f172a 100%); padding: 24px 24px 20px 24px; border-bottom: 2px solid #06b6d4;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 11px; font-weight: 800; color: #22d3ee; text-transform: uppercase; letter-spacing: 1.4px;">
                      LIFE-OPS COMMAND // LIVE &rarr; DAILY &rarr; MONTHLY
                    </div>
                    <h1 style="margin: 6px 0 4px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.2px;">
                      &#9889; LIFE-OPS DAILY EXECUTIVE DIGEST
                    </h1>
                    <div style="font-size: 12px; color: #94a3b8;">
                      Generated ${escapeHtml(slt.full)}
                    </div>
                  </td>
                  <td style="vertical-align: top; text-align: right;">
                    <span style="display: inline-block; background-color: ${statusBadge.bg}; color: ${statusBadge.fg}; border: 1px solid ${statusBadge.border}; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 6px; letter-spacing: 0.5px;">
                      ${escapeHtml(statusBadge.label)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 1: At-a-Glance Decisions Required -->
          <tr>
            <td style="padding: 22px 24px 14px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">Section 1 // Tier 0 Decision Queue</div>
                    <h2 style="margin: 2px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a;">At-a-Glance Decisions Required</h2>
                  </td>
                  <td style="text-align: right; vertical-align: bottom; font-size: 11px; font-weight: 700; color: #475569;">
                    <span style="color: #dc2626;">${temporal.decisions.criticalCount} Crit</span> &middot;
                    <span style="color: #d97706;">${temporal.decisions.warningCount} Warn</span> &middot;
                    <span style="color: #0891b2;">${temporal.decisions.opportunityCount} Opp</span>
                  </td>
                </tr>
              </table>
              ${renderDecisionSignalsHtml(displaySignals)}
            </td>
          </tr>

          <!-- Section 2: Live Snapshot -->
          <tr>
            <td style="padding: 8px 24px 18px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 1px;">Section 2 // Horizon 1: Live</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Live Intraday Telemetry Snapshot</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="padding-right: 6px; padding-bottom: 10px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Solar Inverter &amp; Grid</div>
                      <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${live.solarKw.toFixed(2)} kW</div>
                      <div style="font-size: 12px; font-weight: 700; color: ${gridBadgeColor}; margin-top: 3px;">
                        ${escapeHtml(live.gridExportStatus)} (${live.netGridKw >= 0 ? "+" : ""}${live.netGridKw.toFixed(2)} kW net)
                      </div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 6px; padding-bottom: 10px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">EV Fleet (${escapeHtml(payload.gridFleet?.fleet?.vehicleName || "BYD Sealion 6")})</div>
                      <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${Math.round(live.evBatteryPct)}% <span style="font-size: 13px; font-weight: 600; color: #475569;">(${Math.round(live.evRangeKm)} km)</span></div>
                      <div style="font-size: 12px; color: #475569; margin-top: 3px;">
                        ${live.evIsCharging ? "Charging active" : live.evChargerConnected ? "Plugged in (standby)" : "Unplugged"}
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding-right: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">${fastingCardLabel}</div>
                      <div style="font-size: 20px; font-weight: 800; color: ${fastingHeadlineColor}; margin-top: 4px;">
                        ${fastingHeadline}
                      </div>
                      <div style="font-size: 12px; color: #475569; margin-top: 3px;">
                        ${fastingSubline}
                      </div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Trading Bot (${escapeHtml(live.botMode.toUpperCase())})</div>
                      <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatUSD(live.botTotalWalletUsdt)}</div>
                      <div style="font-size: 12px; color: #475569; margin-top: 3px;">
                        <strong style="color: ${live.botRunning ? "#059669" : "#dc2626"};">${live.botRunning ? "RUNNING" : "OFFLINE"}</strong> &middot; ${live.botOpenPositionsCount} open &middot; ${live.botIdleCashPct.toFixed(1)}% idle (${formatUSD(live.botFreeUsdt)})
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        Active Slot Signals: <strong>${live.botActiveSignalsCount}</strong> &middot; Unrealized ${live.botUnrealizedPnlUsdt >= 0 ? "+" : ""}${formatUSD(live.botUnrealizedPnlUsdt)}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CSE Equity Watch Strip -->
              <div style="margin-top: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="40%" style="vertical-align: middle;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">CSE Intraday Watch</div>
                      <div style="font-size: 12px; color: #334155; margin-top: 2px;">
                        ${live.cseStockCount} stocks &middot; ${live.cseAlertsCount} alert${live.cseAlertsCount === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td width="30%" style="vertical-align: middle; text-align: right; padding-right: 10px;">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Top Mover</div>
                      <div style="font-size: 13px; font-weight: 800; color: ${cseTopMoverColor}; margin-top: 2px;">
                        ${live.cseTopMoverSymbol ? `${escapeHtml(live.cseTopMoverSymbol)} (${formatPercent(live.cseTopMoverChangePct)})` : "&mdash;"}
                      </div>
                    </td>
                    <td width="30%" style="vertical-align: middle; text-align: right;">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Max Concentration</div>
                      <div style="font-size: 13px; font-weight: 800; color: ${cseConcentrationColor}; margin-top: 2px;">
                        ${live.cseMaxConcentrationSymbol ? `${escapeHtml(live.cseMaxConcentrationSymbol)} (${live.cseMaxConcentrationPct.toFixed(1)}%)` : "&mdash;"}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              ${openPositionsHtml}
            </td>
          </tr>

          <!-- Section 3: Today's Daily Scorecard -->
          <tr>
            <td style="padding: 8px 24px 18px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 1px;">Section 3 // Horizon 2: Daily</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Today&rsquo;s Daily Scorecard</h2>

              <!-- Metabolic & Biometrics -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;">
                <div style="font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px;">Metabolic &amp; Biometrics</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="33%" style="padding-bottom: 10px;">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Calories In</div>
                      <div style="font-size: 15px; font-weight: 800; color: ${daily.caloriesIntake > daily.calorieLimit ? "#dc2626" : "#0f172a"};">${Math.round(daily.caloriesIntake).toLocaleString()} <span style="font-size: 11px; font-weight: 500; color: #64748b;">/ ${Math.round(daily.calorieLimit).toLocaleString()} kcal</span></div>
                    </td>
                    <td width="33%" style="padding-bottom: 10px;">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Burn (Fit)</div>
                      <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${Math.round(daily.caloriesExpended).toLocaleString()} <span style="font-size: 11px; font-weight: 500; color: #64748b;">/ ${Math.round(daily.targetCaloriesExpended).toLocaleString()} kcal</span></div>
                    </td>
                    <td width="34%" style="padding-bottom: 10px;">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Net Balance</div>
                      <div style="font-size: 15px; font-weight: 800; color: ${daily.netCalorieBalance <= 0 ? "#059669" : "#d97706"};">${daily.netCalorieBalance > 0 ? "+" : ""}${Math.round(daily.netCalorieBalance).toLocaleString()} kcal</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="33%">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Protein</div>
                      <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${Math.round(daily.proteinGrams)}g <span style="font-size: 11px; font-weight: 500; color: #64748b;">/ ${Math.round(daily.proteinGoal)}g</span></div>
                    </td>
                    <td width="33%">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Sugar Guardrail</div>
                      <div style="font-size: 14px; font-weight: 800; color: ${sugarColor};">${daily.sugarGrams.toFixed(1)}g <span style="font-size: 11px; font-weight: 500; color: #64748b;">/ &lt;${daily.sugarLimit}g</span></div>
                    </td>
                    <td width="34%">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Water &amp; Weight</div>
                      <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${daily.waterGlasses}/${daily.waterGoal} gl &middot; ${daily.todayWeightKg.toFixed(1)} kg</div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top: 10px; padding: 9px 12px; background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px;">
                  <div style="font-size: 10px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.4px;">Next Meal Macro Prescription</div>
                  <div style="font-size: 12px; font-weight: 700; color: #1e1b4b; margin-top: 3px;">
                    ${escapeHtml(daily.nextMealPrescription)}
                  </div>
                  <div style="font-size: 11px; color: #4338ca; margin-top: 2px;">
                    Remaining: <strong>${Math.round(daily.remainingCaloriesToday)} kcal</strong> &middot; Protein needed: <strong>${daily.remainingProteinGrams.toFixed(0)}g</strong> &middot; Sugar cap left: <strong>&le; ${daily.remainingSugarGrams.toFixed(1)}g</strong> &middot; Macros: ${Math.round(daily.carbsGrams)}g C / ${Math.round(daily.fatGrams)}g F
                  </div>
                </div>
              </div>

              <!-- Cashburn & Solar Yield -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="padding-right: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Cashburn Pacing</div>
                      <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatLKR(daily.dailySpendLkr)} <span style="font-size: 11px; font-weight: 500; color: #64748b;">/ day</span></div>
                      <div style="font-size: 12px; color: #475569; margin-top: 3px;">
                        Safe Burn: <strong>${formatLKR(daily.dailySafeBurnRateLkr)}/day</strong>
                      </div>
                      <div style="font-size: 11px; color: #475569; margin-top: 4px;">
                        Budget <strong>${monthly.budgetUtilizationPct.toFixed(1)}%</strong> vs Month Elapsed <strong>${daily.monthElapsedPct.toFixed(1)}%</strong>
                        (<strong style="color: ${paceVarianceColor};">${daily.calendarPaceVariancePct > 0 ? "+" : ""}${daily.calendarPaceVariancePct.toFixed(1)}% pace variance</strong>)
                      </div>
                      <div style="margin-top: 6px;">
                        <span style="display: inline-block; font-size: 10px; font-weight: 800; color: #ffffff; background-color: ${burnStatusColor}; padding: 2px 7px; border-radius: 4px;">${escapeHtml(daily.dailyBurnStatus)}</span>
                      </div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Today&rsquo;s Solar Yield</div>
                      <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 4px;">${daily.solarDailyKwh.toFixed(1)} <span style="font-size: 12px; font-weight: 600; color: #475569;">/ ${daily.solarDailyTargetKwh.toFixed(1)} kWh (${daily.solarDailyPct.toFixed(0)}%)</span></div>
                      <div style="font-size: 12px; color: #059669; font-weight: 700; margin-top: 3px;">
                        Est. Revenue: ${formatLKR(daily.solarDailyEstRevenueLkr)}
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                        Tasks: ${daily.activeTasksCount} active &middot; ${daily.completedTasksCount} done
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 4: Monthly Pacing Quick-Check -->
          <tr>
            <td style="padding: 8px 24px 24px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">Section 4 // Horizon 3: Monthly Quick-Check</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Monthly Pacing Quick-Check (${escapeHtml(monthly.currentMonth)})</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
                <tr>
                  <td width="33%" style="padding: 12px 14px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">MTD Budget Used</div>
                    <div style="font-size: 18px; font-weight: 800; color: ${monthly.budgetUtilizationPct > 100 ? "#dc2626" : monthly.budgetUtilizationPct >= 85 ? "#d97706" : "#059669"}; margin-top: 4px;">
                      ${monthly.budgetUtilizationPct.toFixed(1)}%
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      ${formatLKR(monthly.normalLivingSpendLkr, true)} / ${formatLKR(monthly.baselineBudgetLkr, true)}
                    </div>
                  </td>
                  <td width="33%" style="padding: 12px 14px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">MTD Net Cashflow</div>
                    <div style="font-size: 18px; font-weight: 800; color: ${monthly.netCashFlowLkr >= 0 ? "#059669" : "#dc2626"}; margin-top: 4px;">
                      ${formatLKR(monthly.netCashFlowLkr, true)}
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Savings Rate: ${monthly.savingsRatePct.toFixed(1)}%
                    </div>
                  </td>
                  <td width="34%" style="padding: 12px 14px; vertical-align: top;">
                    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Next Maturity</div>
                    <div style="font-size: 18px; font-weight: 800; color: ${monthly.nextMaturityDays !== null && monthly.nextMaturityDays <= 7 ? "#dc2626" : "#0f172a"}; margin-top: 4px;">
                      ${monthly.nextMaturityDays !== null ? `${monthly.nextMaturityDays}d` : "None"}
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      ${nextRadarItem ? escapeHtml(nextRadarItem.name) : `${monthly.urgentMaturitiesCount} urgent / ${monthly.warningMaturitiesCount} soon`}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
              <div style="font-size: 11px; color: #64748b;">
                Life-Ops Command Center &bull; Automated Daily Executive Digest &bull; ${escapeHtml(slt.full)}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
