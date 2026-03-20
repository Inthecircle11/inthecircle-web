#!/usr/bin/env node
/**
 * Behavior Intelligence Audit
 *
 * Runs activation, retention-driver, funnel, and feature-utilization analysis
 * against analytics_events (and related tables). Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Migrations applied (analytics_events, analytics_funnels, 20260303100001)
 *
 * Usage: node scripts/behavior-intelligence-audit.mjs [--days=30]
 *
 * Output: Structured report to stdout; summary at end.
 */

import { createClient } from '@supabase/supabase-js'

const DAYS = parseInt(process.env.AUDIT_DAYS || '30', 10)
const FROM = new Date()
FROM.setDate(FROM.getDate() - DAYS)
const FROM_STR = FROM.toISOString().slice(0, 10)
const TO_STR = new Date().toISOString().slice(0, 10)

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function main() {
  const supabase = getSupabase()

  const report = {
    section1_activation: null,
    section2_retention_drivers: null,
    section3_funnel: null,
    section4_feature_usage: null,
    summary: {},
  }

  // ---------------------------------------------------------------------------
  // SECTION 1 — ACTIVATION
  // ---------------------------------------------------------------------------
  console.log('\n========== SECTION 1 — ACTIVATION ==========\n')
  const { data: activationRows, error: actErr } = await supabase.rpc('analytics_behavior_audit_activation', {
    p_days: DAYS,
  })
  if (actErr) {
    console.error('Activation RPC error:', actErr.message)
    report.section1_activation = { error: actErr.message }
  } else {
    const rows = activationRows || []
    report.section1_activation = rows
    console.log('Candidate event          | % Reached | D1 Retained % | Rank (by retention)')
    console.log('-------------------------|-----------|---------------|---------------------')
    rows.forEach((r, i) => {
      console.log(
        `${(r.event_name || '').padEnd(24)} | ${String(r.pct_of_all_users ?? 0).padStart(9)}% | ${String(r.d1_retention_pct ?? 0).padStart(13)}% | #${i + 1}`
      )
    })
    const best = rows[0]
    const trueActivation = best ? best.event_name : 'first_core_action'
    const activationRate = best ? (best.pct_of_all_users || 0) : 0
    report.summary.true_activation_event = trueActivation
    report.summary.activation_rate_pct = activationRate
    console.log(`\n→ True activation event (highest D1 correlation): ${trueActivation}`)
    console.log(`→ Activation rate (% users reaching it): ${activationRate}%`)
  }

  // ---------------------------------------------------------------------------
  // SECTION 2 — RETENTION DRIVER ANALYSIS
  // ---------------------------------------------------------------------------
  console.log('\n========== SECTION 2 — RETENTION DRIVERS (D7 retained vs churned) ==========\n')
  const { data: driverRows, error: drvErr } = await supabase.rpc('analytics_behavior_audit_retention_drivers', {
    p_days: 14,
  })
  if (drvErr) {
    console.error('Retention drivers RPC error:', drvErr.message)
    report.section2_retention_drivers = { error: drvErr.message }
  } else {
    const rows = driverRows || []
    report.section2_retention_drivers = rows
    console.log('Event / Feature           | % Retained | % Churned | Lift (retention correlation)')
    console.log('--------------------------|------------|-----------|------------------------------')
    rows.slice(0, 15).forEach((r) => {
      const label = `${r.event_name || ''} / ${r.feature_name || ''}`.slice(0, 25)
      console.log(
        `${label.padEnd(25)} | ${String(r.pct_retained ?? 0).padStart(10)}% | ${String(r.pct_churned ?? 0).padStart(9)}% | ${r.retention_lift ?? 0}`
      )
    })
    const topDriver = rows[0]
    report.summary.highest_retention_driver =
      topDriver ? `${topDriver.event_name} / ${topDriver.feature_name}` : 'N/A'
    console.log(`\n→ Highest retention driver: ${report.summary.highest_retention_driver}`)
  }

  // ---------------------------------------------------------------------------
  // SECTION 3 — FUNNEL DROP-OFF
  // ---------------------------------------------------------------------------
  console.log('\n========== SECTION 3 — FUNNEL DROP-OFF (App Activation) ==========\n')
  const { data: funnelRows, error: funErr } = await supabase.rpc('analytics_get_funnel_steps', {
    p_funnel_name: 'App Activation',
    p_user_type: 'app',
    p_from: FROM_STR,
    p_to: TO_STR,
  })
  if (funErr) {
    console.error('Funnel RPC error:', funErr.message)
    report.section3_funnel = { error: funErr.message }
  } else {
    const steps = funnelRows || []
    report.section3_funnel = steps
    let prevUsers = null
    let biggestDrop = { step: null, pct: 0, lost: 0 }
    console.log('Step  | Event / Step Name     | Unique Users | Conversion from previous')
    console.log('------|------------------------|--------------|--------------------------')
    steps.forEach((s, i) => {
      const conv =
        s.conversion_rate_from_previous_step != null
          ? `${(s.conversion_rate_from_previous_step * 100).toFixed(1)}%`
          : '—'
      const lost = prevUsers != null && s.unique_users != null ? prevUsers - Number(s.unique_users) : 0
      const dropPct = prevUsers > 0 ? (lost / prevUsers) * 100 : 0
      if (dropPct > biggestDrop.pct) {
        biggestDrop = { step: s.step_event_name, pct: dropPct, lost }
      }
      prevUsers = Number(s.unique_users)
      console.log(
        `${String(s.step_index || i + 1).padStart(5)} | ${(s.step_event_name || '').padEnd(22)} | ${String(s.unique_users ?? 0).padStart(12)} | ${conv}`
      )
    })
    report.summary.funnel_conversion_per_step = steps.map((s) => ({
      step: s.step_event_name,
      users: s.unique_users,
      conversion_from_previous: s.conversion_rate_from_previous_step,
    }))
    report.summary.biggest_drop_off_step = biggestDrop.step || 'N/A'
    report.summary.biggest_drop_off_pct = biggestDrop.pct
    const firstStepUsers = steps.length > 0 ? Number(steps[0].unique_users) : 0
    const lift10 = firstStepUsers * 0.1 * (biggestDrop.pct / 100)
    report.summary.estimated_lift_if_improved_10pct = Math.round(lift10)
    console.log(`\n→ Biggest drop-off step: ${biggestDrop.step} (${biggestDrop.pct.toFixed(1)}% drop)`)
    console.log(`→ Estimated lift if that step improved 10%: ~${Math.round(lift10)} users`)
  }

  // ---------------------------------------------------------------------------
  // SECTION 4 — FEATURE UTILIZATION
  // ---------------------------------------------------------------------------
  console.log('\n========== SECTION 4 — FEATURE UTILIZATION ==========\n')
  const { data: featureRows, error: featErr } = await supabase.rpc('analytics_get_feature_usage', {
    p_days: DAYS,
    p_limit: 100,
  })
  if (featErr) {
    console.error('Feature usage RPC error:', featErr.message)
    report.section4_feature_usage = { error: featErr.message }
  } else {
    const rows = featureRows || []
    report.section4_feature_usage = rows
    const byUsage = [...rows].sort((a, b) => Number(b.total_events) - Number(a.total_events))
    const top10 = byUsage.slice(0, 10)
    const bottom10 = byUsage.slice(-10).reverse()
    console.log('Top 10 most used (by total_events):')
    top10.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.feature_name || 'unknown'} / ${r.event_name} — ${r.unique_users} users, ${r.total_events} events`)
    })
    console.log('\nBottom 10 least used:')
    bottom10.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.feature_name || 'unknown'} / ${r.event_name} — ${r.unique_users} users, ${r.total_events} events`)
    })
    const retainedOnly = (report.section2_retention_drivers || []).filter((r) => (r.retention_lift ?? 0) > 0.1)
    console.log('\nFeatures/events with strong retention lift (retained >> churned):')
    retainedOnly.slice(0, 10).forEach((r) => {
      console.log(`  - ${r.event_name} / ${r.feature_name} (lift ${r.retention_lift})`)
    })
    report.summary.top_10_features = top10.map((r) => `${r.feature_name}/${r.event_name}`)
    report.summary.bottom_10_features = bottom10.map((r) => `${r.feature_name}/${r.event_name}`)
    report.summary.retained_only_features = retainedOnly.map((r) => `${r.event_name}/${r.feature_name}`)
  }

  // ---------------------------------------------------------------------------
  // OUTPUT SUMMARY (requested format)
  // ---------------------------------------------------------------------------
  console.log('\n========== OUTPUT SUMMARY ==========\n')
  console.log('1. Activation definition:', report.summary.true_activation_event ?? 'N/A')
  console.log('   Activation rate:', report.summary.activation_rate_pct ?? 'N/A', '%')
  console.log('2. Biggest friction point:', report.summary.biggest_drop_off_step ?? 'N/A', `(${report.summary.biggest_drop_off_pct?.toFixed(1) ?? 0}% drop)`)
  console.log('3. Highest retention driver:', report.summary.highest_retention_driver ?? 'N/A')
  console.log('4. Estimated lift if biggest drop improved 10%:', report.summary.estimated_lift_if_improved_10pct ?? 0, 'users')
  console.log('5. Top 3 ROI product changes (from funnel + retention):')
  console.log('   - Improve conversion at step:', report.summary.biggest_drop_off_step ?? 'N/A')
  console.log('   - Double down on retention driver:', report.summary.highest_retention_driver ?? 'N/A')
  console.log('   - Improve activation event reach:', report.summary.true_activation_event ?? 'N/A')
  console.log('6. Features to consider removing or improving (low usage + low retention lift):')
  const featList = Array.isArray(report.section4_feature_usage) ? report.section4_feature_usage : []
  const lowUsage = [...featList].sort((a, b) => Number(a.total_events) - Number(b.total_events)).slice(0, 5).map((r) => `${r.feature_name}/${r.event_name}`)
  lowUsage.forEach((f) => console.log('   -', f))

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
