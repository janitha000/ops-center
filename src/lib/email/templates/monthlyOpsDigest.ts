import { OpsDashboardPayload } from "@/lib/types";
import { TemporalDashboardModel } from "@/lib/decisions/types";
import { formatLKR, formatPercent, formatUSD } from "@/lib/utils";
import {
  escapeHtml,
  formatSltTimestamp,
  getOverallStatusBadge,
  renderDecisionSignalsHtml,
} from "./dailyOpsDigest";

export function buildMonthlyOpsDigestEmail(
  payload: OpsDashboardPayload,
  temporal: TemporalDashboardModel
): { subject: string; html: string } {
  const slt = formatSltTimestamp(temporal.generatedAt || payload.timestamp);
  const statusBadge = getOverallStatusBadge(temporal.decisions);
  const { monthly } = temporal;

  const monthLabel = monthly.currentMonth || "Current Month";
  const subject = `📊 Life-Ops Monthly Executive Report — ${monthLabel} | Net Worth ${formatLKR(monthly.totalNetWorthLkr, true)} · Savings ${monthly.savingsRatePct.toFixed(1)}%`;

  // Section 1: 30-Day Maturity Radar & Monthly Strategic Decisions
  const radarItems = [...(payload.investments?.maturityRadar ?? [])]
    .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const monthlyDecisions =
    temporal.decisions.byHorizon.monthly.length > 0
      ? temporal.decisions.byHorizon.monthly
      : temporal.decisions.all.filter((d) => d.severity !== "nominal").slice(0, 4);

  const maturityRowsHtml =
    radarItems.length === 0
      ? `<tr><td colspan="5" style="padding: 14px 12px; text-align: center; font-size: 12px; color: #64748b;">No Fixed Deposits or Treasury instruments maturing within the next 30 days.</td></tr>`
      : radarItems
          .map((item) => {
            const urgencyColor =
              item.daysRemaining <= 7
                ? "#dc2626"
                : item.daysRemaining <= 15
                  ? "#d97706"
                  : "#0891b2";
            const principalFmt =
              item.currency === "USD"
                ? formatUSD(item.amount)
                : formatLKR(item.amount);
            const payoutFmt =
              item.currency === "USD"
                ? formatUSD(item.expectedPayout)
                : formatLKR(item.expectedPayout);

            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 9px 10px; font-size: 12px; font-weight: 700; color: #0f172a;">
                ${escapeHtml(item.name)}
                <div style="font-size: 10px; font-weight: 500; color: #64748b;">${escapeHtml(item.institution)} &middot; ${escapeHtml(item.type.toUpperCase())}</div>
              </td>
              <td style="padding: 9px 10px; font-size: 12px; font-weight: 800; color: ${urgencyColor}; text-align: center;">
                ${item.daysRemaining}d
              </td>
              <td style="padding: 9px 10px; font-size: 12px; color: #1e293b; text-align: right;">${principalFmt}</td>
              <td style="padding: 9px 10px; font-size: 12px; font-weight: 700; color: #059669; text-align: right;">${item.rate.toFixed(2)}%</td>
              <td style="padding: 9px 10px; font-size: 12px; font-weight: 700; color: #0f172a; text-align: right;">${payoutFmt}</td>
            </tr>`;
          })
          .join("");

  // Section 2: Wealth, Passive Yield & FIRE
  const commitment = payload.investments?.commitment;
  const fire = payload.investments?.fire;
  const nwDeltaColor = monthly.netWorthDeltaPct >= 0 ? "#059669" : "#dc2626";

  // Section 3: Cashflow & Budget Variance
  const inflow = payload.spendIncome?.inflow;
  const outflow = payload.spendIncome?.outflow;
  const totalInflow = inflow?.totalInflow ?? monthly.totalInflowLkr;
  const totalOutflow = outflow?.totalOutflow ?? monthly.totalOutflowLkr;

  const topCategories = [...(payload.spendIncome?.categories ?? [])]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7);

  const categoryRowsHtml =
    topCategories.length === 0
      ? `<tr><td colspan="4" style="padding: 14px; text-align: center; font-size: 12px; color: #64748b;">No expense category breakdown available.</td></tr>`
      : topCategories
          .map((cat) => {
            const pct =
              cat.budgetAmount > 0 ? (cat.amount / cat.budgetAmount) * 100 : 0;
            const statusColor =
              cat.budgetAmount > 0 && cat.amount > cat.budgetAmount
                ? "#dc2626"
                : pct >= 85
                  ? "#d97706"
                  : "#059669";
            const variance = cat.budgetAmount - cat.amount;
            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: #0f172a;">
                ${escapeHtml(cat.name)}
                <span style="font-size: 10px; font-weight: 600; color: #64748b; margin-left: 4px;">(${cat.parentType === "one_time" ? "1-time" : "Base"})</span>
              </td>
              <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: #0f172a; text-align: right;">${formatLKR(cat.amount)}</td>
              <td style="padding: 8px 10px; font-size: 12px; color: #64748b; text-align: right;">${cat.budgetAmount > 0 ? formatLKR(cat.budgetAmount) : "—"}</td>
              <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: ${statusColor}; text-align: right;">
                ${cat.budgetAmount > 0 ? `${pct.toFixed(0)}% (${variance >= 0 ? "+" : "-"}${formatLKR(Math.abs(variance), true)})` : "Unbudgeted"}
              </td>
            </tr>`;
          })
          .join("");

  // Section 4: Cross-Domain Strategic Intelligence & Arbitrage
  const odSpreadPositive = monthly.odVsFdArbitrageSpreadPct > 0;
  const breachedCategoriesHtml =
    monthly.topBreachedCategories.length === 0
      ? `<div style="font-size: 12px; color: #059669; margin-top: 4px;">No normal budget categories breached this month.</div>`
      : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-top: 6px;">
          ${monthly.topBreachedCategories
            .slice(0, 4)
            .map(
              (cat) => `
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 5px 0; font-size: 12px; font-weight: 700; color: #0f172a;">${escapeHtml(cat.name)}</td>
              <td style="padding: 5px 0; font-size: 11px; color: #64748b; text-align: right;">${formatLKR(cat.amountLkr, true)} / ${formatLKR(cat.budgetLkr, true)}</td>
              <td style="padding: 5px 0; font-size: 12px; font-weight: 800; color: #dc2626; text-align: right; padding-left: 8px;">+${formatLKR(cat.overrunLkr, true)}</td>
            </tr>`
            )
            .join("")}
        </table>`;

  // Section 5: Domain Rollups
  const weightDeltaColor = monthly.weightDeltaMtdKg <= 0 ? "#059669" : "#d97706";
  const expectedFatLossColor =
    monthly.expectedFatLossMtdKg <= 0 ? "#059669" : "#d97706";
  const targetWeightEtaLabel =
    monthly.estimatedDaysToTargetWeight !== null
      ? `${monthly.estimatedDaysToTargetWeight} days`
      : "On Target";
  const botPnlColor = monthly.botMtdRealizedPnlUsdt >= 0 ? "#059669" : "#dc2626";
  const mtdTrades =
    payload.bot?.monthTradesCount ?? payload.bot?.completedTradesCount ?? 0;

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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #090b0e 0%, #1e1b4b 65%, #312e81 100%); padding: 26px 24px 22px 24px; border-bottom: 2px solid #818cf8;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 11px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1.4px;">
                      LIFE-OPS STRATEGIC HORIZON // MONTHLY WRAP-UP
                    </div>
                    <h1 style="margin: 6px 0 4px 0; font-size: 20px; font-weight: 800; color: #ffffff;">
                      &#128202; LIFE-OPS MONTHLY EXECUTIVE REPORT &mdash; ${escapeHtml(monthLabel)}
                    </h1>
                    <div style="font-size: 12px; color: #c7d2fe;">
                      Generated ${escapeHtml(slt.full)}
                    </div>
                  </td>
                  <td style="vertical-align: top; text-align: right;">
                    <span style="display: inline-block; background-color: ${statusBadge.bg}; color: ${statusBadge.fg}; border: 1px solid ${statusBadge.border}; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 6px;">
                      ${escapeHtml(statusBadge.label)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 1: Strategic Decisions & 30-Day Maturity Radar -->
          <tr>
            <td style="padding: 22px 24px 14px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">Section 1 // Rollover &amp; Strategic Decisions</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Strategic Decisions &amp; 30-Day Maturity Radar</h2>

              ${renderDecisionSignalsHtml(monthlyDecisions, "No urgent monthly strategic alerts. Capital allocation and budget utilization remain on track.")}

              <div style="margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #f8fafc; padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.6px;">
                  Instruments Maturing Within 30 Days (${radarItems.length})
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: left; text-transform: uppercase;">Instrument</th>
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: center; text-transform: uppercase;">Days</th>
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Principal</th>
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Yield</th>
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Expected Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${maturityRowsHtml}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Section 2: Wealth, Passive Yield & FIRE -->
          <tr>
            <td style="padding: 8px 24px 18px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 1px;">Section 2 // Capital &amp; Independence</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Wealth, Passive Yield &amp; FIRE</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="padding-right: 6px; padding-bottom: 10px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Net Worth</div>
                      <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatLKR(monthly.totalNetWorthLkr)}</div>
                      <div style="font-size: 12px; font-weight: 700; color: ${nwDeltaColor}; margin-top: 3px;">
                        ${formatPercent(monthly.netWorthDeltaPct)} MoM
                      </div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 6px; padding-bottom: 10px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Net Monthly Passive (After IIT)</div>
                      <div style="font-size: 20px; font-weight: 800; color: #059669; margin-top: 4px;">${formatLKR(monthly.netMonthlyPassiveAfterIitLkr)}</div>
                      <div style="font-size: 12px; color: #475569; margin-top: 3px;">
                        Physical Cash Avail: <strong>${formatLKR(monthly.physicalCashAvailableMonthlyLkr)}</strong>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding-right: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">True FI Coverage</div>
                      <div style="font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 4px;">
                        ${monthly.trueFiCoverageBaselinePct.toFixed(1)}% <span style="font-size: 11px; font-weight: 600; color: #64748b;">of baseline</span>
                      </div>
                      <div style="font-size: 12px; color: #475569; margin-top: 3px;">
                        ${monthly.trueFiCoverageTotalPct.toFixed(1)}% of total spend${fire ? ` &middot; FIRE ${fire.currentProgressPct.toFixed(1)}%` : ""}
                      </div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Monthly Investment Commitment</div>
                      <div style="font-size: 18px; font-weight: 800; color: ${(commitment?.fulfilledPct ?? 0) >= 100 ? "#059669" : "#d97706"}; margin-top: 4px;">
                        ${(commitment?.fulfilledPct ?? 0).toFixed(0)}% Fulfilled
                      </div>
                      <div style="font-size: 12px; color: #475569; margin-top: 3px;">
                        ${formatLKR(commitment?.achievedAmount ?? 0)} / ${formatLKR(commitment?.plannedAmount ?? 0)}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 3: Monthly Cashflow & Budget Variance -->
          <tr>
            <td style="padding: 8px 24px 18px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 1px;">Section 3 // Income, Outflows &amp; Budget</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Monthly Cashflow &amp; Budget Variance</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                <tr>
                  <td width="33%" style="padding-right: 5px; vertical-align: top;">
                    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 11px 12px;">
                      <div style="font-size: 10px; font-weight: 800; color: #065f46; text-transform: uppercase;">Total Inflow</div>
                      <div style="font-size: 16px; font-weight: 800; color: #047857; margin-top: 3px;">${formatLKR(totalInflow)}</div>
                      <div style="font-size: 11px; color: #065f46; margin-top: 4px; line-height: 1.4;">
                        Janitha: ${formatLKR(inflow?.janithaSalary ?? 0, true)}<br/>
                        Vindya: ${formatLKR(inflow?.vindyaSalary ?? 0, true)}<br/>
                        Passive: ${formatLKR(inflow?.lastMonthPassive ?? 0, true)}
                      </div>
                    </div>
                  </td>
                  <td width="33%" style="padding: 0 3px; vertical-align: top;">
                    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 11px 12px;">
                      <div style="font-size: 10px; font-weight: 800; color: #9f1239; text-transform: uppercase;">Total Outflow</div>
                      <div style="font-size: 16px; font-weight: 800; color: #be123c; margin-top: 3px;">${formatLKR(totalOutflow)}</div>
                      <div style="font-size: 11px; color: #9f1239; margin-top: 4px; line-height: 1.4;">
                        Tax ${formatLKR(outflow?.taxes?.total ?? 0, true)} &middot; Loans ${formatLKR(outflow?.loans?.total ?? 0, true)} &middot; OD ${formatLKR(outflow?.od?.total ?? 0, true)}<br/>
                        Vindya: ${formatLKR(outflow?.vindyaExpense ?? 0, true)}<br/>
                        HH Normal ${formatLKR(outflow?.household?.normal ?? monthly.normalLivingSpendLkr, true)} / 1-Time ${formatLKR(outflow?.household?.oneTime ?? 0, true)}
                      </div>
                    </div>
                  </td>
                  <td width="34%" style="padding-left: 5px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 12px;">
                      <div style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase;">Net Savings</div>
                      <div style="font-size: 16px; font-weight: 800; color: ${monthly.netCashFlowLkr >= 0 ? "#059669" : "#dc2626"}; margin-top: 3px;">${formatLKR(monthly.netCashFlowLkr)}</div>
                      <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.4;">
                        Savings Rate: <strong>${monthly.savingsRatePct.toFixed(1)}%</strong><br/>
                        Base Budget Used: <strong>${monthly.budgetUtilizationPct.toFixed(1)}%</strong><br/>
                        Limit: ${formatLKR(monthly.baselineBudgetLkr, true)}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Top Expense Categories vs Budget -->
              <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #f8fafc; padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase;">
                  Top Expense Categories vs Budget
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: left; text-transform: uppercase;">Category</th>
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Spent</th>
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Budget</th>
                      <th style="padding: 8px 10px; font-size: 10px; font-weight: 700; color: #64748b; text-align: right; text-transform: uppercase;">Status / Var</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${categoryRowsHtml}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Section 4: Cross-Domain Strategic Intelligence & Arbitrage -->
          <tr>
            <td style="padding: 8px 24px 18px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px;">Section 4 // Cross-Domain Intelligence &amp; Arbitrage</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Cross-Domain Strategic Intelligence &amp; Arbitrage</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
                <tr>
                  <td width="50%" style="padding-right: 6px; padding-bottom: 10px; vertical-align: top;">
                    <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #5b21b6; text-transform: uppercase;">Monthly Freedom Velocity</div>
                      <div style="font-size: 19px; font-weight: 800; color: #4c1d95; margin-top: 4px;">+${formatLKR(monthly.monthlyFreedomVelocityLkr)}<span style="font-size: 11px; font-weight: 600; color: #6d28d9;">/mo</span></div>
                      <div style="font-size: 11px; color: #5b21b6; margin-top: 3px; line-height: 1.4;">
                        New perpetual passive cashflow locked in &middot; <strong>+${monthly.monthlyFiCoverageGainPct.toFixed(2)}%</strong> FI coverage gain
                      </div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 6px; padding-bottom: 10px; vertical-align: top;">
                    <div style="background-color: ${odSpreadPositive ? "#ecfeff" : "#f8fafc"}; border: 1px solid ${odSpreadPositive ? "#a5f3fc" : "#e2e8f0"}; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #0e7490; text-transform: uppercase;">OD Cost vs. FD Yield Arbitrage</div>
                      <div style="font-size: 19px; font-weight: 800; color: ${odSpreadPositive ? "#0e7490" : "#334155"}; margin-top: 4px;">
                        ${monthly.odVsFdArbitrageSpreadPct >= 0 ? "+" : ""}${monthly.odVsFdArbitrageSpreadPct.toFixed(2)}% <span style="font-size: 11px; font-weight: 600; color: #475569;">spread</span>
                      </div>
                      <div style="font-size: 11px; color: #334155; margin-top: 3px; line-height: 1.4;">
                        OD Rate: <strong>${monthly.odEffectiveAnnualRatePct.toFixed(2)}%</strong> vs Post-WHT FD: <strong>${monthly.lowestPostTaxFdRatePct.toFixed(2)}%</strong><br/>
                        Drawn ${formatLKR(monthly.odDrawnLkr, true)} / ${formatLKR(monthly.odLimitLkr, true)} (Int: ${formatLKR(monthly.odLatestInterestLkr)})
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding-right: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Tax Efficiency &amp; Hard Currency Hedge</div>
                      <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px;">
                        ${monthly.taxFreePassiveSharePct.toFixed(1)}% <span style="font-size: 11px; font-weight: 600; color: #475569;">tax-free passive</span>
                      </div>
                      <div style="font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.4;">
                        WHT-Taxed: ${monthly.whtTaxedPassiveSharePct.toFixed(1)}% &middot; USD Hedge: <strong>${monthly.hardCurrencyHedgePct.toFixed(1)}%</strong> ($${monthly.usdInvestedTotal.toLocaleString()})
                      </div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 6px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Solar + Bot Utility Offset Ratio</div>
                      <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">
                        ${monthly.solarBotUtilityOffsetPct.toFixed(1)}% <span style="font-size: 11px; font-weight: 600; color: #475569;">offset</span>
                      </div>
                      <div style="font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.4;">
                        Covered against <strong>${formatLKR(monthly.utilitiesAndSubsSpendLkr)}</strong> monthly Utilities &amp; Subscriptions
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Category Budget Breach Radar -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                      Category Budget Breach Radar (${monthly.breachedCategoriesCount} breached)
                    </td>
                    <td style="font-size: 11px; color: #475569; text-align: right;">
                      Undocumented Buffer: <strong>${formatLKR(monthly.undocumentedBufferLkr)}</strong>
                    </td>
                  </tr>
                </table>
                ${breachedCategoriesHtml}
              </div>
            </td>
          </tr>

          <!-- Section 5: Monthly Domain Rollups -->
          <tr>
            <td style="padding: 8px 24px 24px 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #0891b2; text-transform: uppercase; letter-spacing: 1px;">Section 5 // Domain Telemetry Rollups</div>
              <h2 style="margin: 2px 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Monthly Domain Rollups (Biometrics, Solar, Bot)</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="33%" style="padding-right: 5px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Biometrics &amp; Fat Loss</div>
                      <div style="font-size: 16px; font-weight: 800; color: ${weightDeltaColor}; margin-top: 4px;">
                        ${monthly.weightDeltaMtdKg > 0 ? "+" : ""}${monthly.weightDeltaMtdKg.toFixed(2)} kg <span style="font-size: 11px; font-weight: 500; color: #64748b;">Scale MTD</span>
                      </div>
                      <div style="font-size: 12px; color: #334155; margin-top: 4px;">
                        Expected Fat Loss: <strong style="color: ${expectedFatLossColor};">${monthly.expectedFatLossMtdKg > 0 ? "+" : ""}${monthly.expectedFatLossMtdKg.toFixed(2)} kg</strong>
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        Deficit: ${monthly.mtdCalorieDeficitKcal.toLocaleString()} kcal &middot; Target ETA: <strong>${escapeHtml(targetWeightEtaLabel)}</strong>
                      </div>
                    </div>
                  </td>
                  <td width="33%" style="padding: 0 3px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Solar Grid (CEB Net-Plus)</div>
                      <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 4px;">
                        ${monthly.solarMtdKwh.toFixed(1)} kWh
                      </div>
                      <div style="font-size: 12px; font-weight: 700; color: #059669; margin-top: 4px;">
                        Revenue: ${formatLKR(monthly.solarMtdRevenueLkr)}
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        Yearly: ${(payload.gridFleet?.solar?.yearlyMwh ?? 0).toFixed(2)} MWh
                      </div>
                    </div>
                  </td>
                  <td width="34%" style="padding-left: 5px; vertical-align: top;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Trading Bot MTD</div>
                      <div style="font-size: 17px; font-weight: 800; color: ${botPnlColor}; margin-top: 4px;">
                        ${monthly.botMtdRealizedPnlUsdt >= 0 ? "+" : ""}${formatUSD(monthly.botMtdRealizedPnlUsdt)}
                      </div>
                      <div style="font-size: 12px; color: #334155; margin-top: 4px;">
                        Win Rate: <strong>${monthly.botWinRatePct.toFixed(1)}%</strong>
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        Trades: ${mtdTrades} &middot; Mode: ${escapeHtml((payload.bot?.mode ?? "paper").toUpperCase())}
                      </div>
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
                Life-Ops Command Center &bull; Monthly Executive Report &bull; ${escapeHtml(slt.full)}
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
