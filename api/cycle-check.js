// api/cycle-check.js — Vercel Serverless Function
// Runs daily to enforce cycle rules
// Call via: https://onboarding.sportsbetarbitrage.com/api/cycle-check
// Set up Vercel Cron: vercel.json → crons

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://anjlmooskwvjystmrhxr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuamxtb29za3d2anlzdG1yaHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjYzNTUsImV4cCI6MjA4MTA0MjM1NX0.DVLjp9PzNIPNSp2HAGtKTaPVfKy3QLs4HTJsy96UsyM'
);

export default async function handler(req, res) {
  const now = new Date();
  const results = { past_due: [], suspended: [], phantoms_cleared: [], affiliates_cleared: [], tree_moves: [] };

  // Get all members
  const { data: members } = await sb.from('onboarding_members').select('*');
  if (!members) return res.status(500).json({ error: 'Failed to load members' });

  for (const m of members) {
    if (m.is_core_team) continue; // Never touch core team

    const cycleEnd = m.cycle_end ? new Date(m.cycle_end) : null;
    if (!cycleEnd) continue;

    const daysPastCycle = Math.floor((now - cycleEnd) / 86400000);

    // ════════════════════════════════════════════
    // PAID MEMBERS — Day 41: past_due, Day 47: suspended
    // ════════════════════════════════════════════
    if (m.member_type === 'active' || m.member_type === 'legacy') {
      
      // Day 1+ past cycle end and NOT renewed
      if (daysPastCycle >= 1 && m.status !== 'past_due' && m.status !== 'suspended' && m.payment !== 'renewed') {
        // DAY 41 (1 day past cycle): PAST DUE
        await sb.from('onboarding_members').update({
          status: 'past_due',
          genius_access: false,
          affiliate_rank: 'starter', // de-rank
          past_due_at: now.toISOString()
        }).eq('id', m.id);
        results.past_due.push(m.name);
      }

      // Day 7+ past cycle: SUSPENDED + REMOVE FROM TREE
      if (daysPastCycle >= 7 && m.status === 'past_due') {
        // Move their direct referrals up to their upline
        const { data: directs } = await sb.from('onboarding_members')
          .select('id, name')
          .eq('referred_by_code', m.referral_code);

        if (directs && directs.length > 0) {
          for (const d of directs) {
            await sb.from('onboarding_members').update({
              referred_by_code: m.referred_by_code // move up to suspended person's upline
            }).eq('id', d.id);
            results.tree_moves.push(`${d.name} moved from under ${m.name} to ${m.referred_by_code}`);
          }
        }

        await sb.from('onboarding_members').update({
          status: 'suspended',
          member_type: 'suspended',
          genius_access: false,
          suspended_at: now.toISOString(),
          referral_code: null, // remove from tree
          referred_by_code: null
        }).eq('id', m.id);
        results.suspended.push(m.name);
      }
    }

    // ════════════════════════════════════════════
    // FREE AFFILIATES — Day 40: clear out
    // ════════════════════════════════════════════
    if (m.member_type === 'affiliate_only' && daysPastCycle >= 0) {
      // Move their people up
      const { data: directs } = await sb.from('onboarding_members')
        .select('id, name')
        .eq('referred_by_code', m.referral_code);

      if (directs && directs.length > 0) {
        for (const d of directs) {
          await sb.from('onboarding_members').update({
            referred_by_code: m.referred_by_code
          }).eq('id', d.id);
          results.tree_moves.push(`${d.name} moved from under ${m.name} (free affiliate) to ${m.referred_by_code}`);
        }
      }

      // Clear held commissions and suspend
      await sb.from('onboarding_members').update({
        status: 'suspended',
        member_type: 'suspended',
        genius_access: false,
        held_commissions: 0,
        suspended_at: now.toISOString(),
        referral_code: null,
        referred_by_code: null
      }).eq('id', m.id);
      results.affiliates_cleared.push(m.name);
    }

    // ════════════════════════════════════════════
    // PHANTOM NODES — Day 40: clear out
    // ════════════════════════════════════════════
    if (m.member_type === 'phantom') {
      const created = new Date(m.created_at);
      const daysAlive = Math.floor((now - created) / 86400000);

      if (daysAlive >= 40) {
        // Move their people up
        const { data: directs } = await sb.from('onboarding_members')
          .select('id, name')
          .eq('referred_by_code', m.referral_code);

        if (directs && directs.length > 0) {
          for (const d of directs) {
            await sb.from('onboarding_members').update({
              referred_by_code: m.referred_by_code
            }).eq('id', d.id);
            results.tree_moves.push(`${d.name} moved from under ${m.name} (phantom expired) to ${m.referred_by_code}`);
          }
        }

        // Delete the phantom
        await sb.from('onboarding_members').delete().eq('id', m.id);
        results.phantoms_cleared.push(m.name);
      }
    }
  }

  // ════════════════════════════════════════════
  // SEND WARNINGS (Day 35, 38, 39, 40)
  // This logs warnings — auto-email can be added via Resend
  // ════════════════════════════════════════════
  const warnings = [];
  for (const m of members) {
    if (m.is_core_team || m.member_type === 'phantom') continue;
    const cycleEnd = m.cycle_end ? new Date(m.cycle_end) : null;
    if (!cycleEnd) continue;

    const daysUntilEnd = Math.floor((cycleEnd - now) / 86400000);

    if (daysUntilEnd === 5) warnings.push({ name: m.name, email: m.email, msg: '5 days until renewal' });
    if (daysUntilEnd === 2) warnings.push({ name: m.name, email: m.email, msg: '2 days until renewal' });
    if (daysUntilEnd === 1) warnings.push({ name: m.name, email: m.email, msg: 'TOMORROW — payment due' });
    if (daysUntilEnd === 0) warnings.push({ name: m.name, email: m.email, msg: 'TODAY — payment due NOW' });
  }

  return res.status(200).json({
    timestamp: now.toISOString(),
    results,
    warnings,
    summary: {
      past_due: results.past_due.length,
      suspended: results.suspended.length,
      phantoms_cleared: results.phantoms_cleared.length,
      affiliates_cleared: results.affiliates_cleared.length,
      tree_moves: results.tree_moves.length,
      warnings_sent: warnings.length
    }
  });
}
