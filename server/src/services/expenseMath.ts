export interface MemberSplitInput {
  user_id: string;
  amount_cents?: number;
  percentage?: number;
  shares?: number;
}

export interface CalculatedSplit {
  user_id: string;
  amount_cents: number;
  percentage?: number;
  shares?: number;
}

/**
 * Calculates exact, penny-accurate split distributions ensuring sum(amount_cents) strictly equals total amount_cents.
 */
export function calculateSplits(
  splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES',
  totalAmountCents: number,
  participants: MemberSplitInput[]
): CalculatedSplit[] {
  if (totalAmountCents <= 0) {
    throw new Error('Expense amount must be greater than 0');
  }
  if (!participants || participants.length === 0) {
    throw new Error('At least one participant must be selected for the split');
  }

  const n = participants.length;

  if (splitType === 'EQUAL') {
    const baseShare = Math.floor(totalAmountCents / n);
    const remainder = totalAmountCents % n;

    return participants.map((p, index) => ({
      user_id: p.user_id,
      amount_cents: baseShare + (index < remainder ? 1 : 0),
    }));
  }

  if (splitType === 'EXACT') {
    let currentSum = 0;
    const result: CalculatedSplit[] = [];

    for (const p of participants) {
      const amount = Math.round(p.amount_cents || 0);
      if (amount < 0) {
        throw new Error(`Exact amount for participant ${p.user_id} cannot be negative`);
      }
      currentSum += amount;
      result.push({
        user_id: p.user_id,
        amount_cents: amount,
      });
    }

    if (currentSum !== totalAmountCents) {
      throw new Error(
        `Sum of exact amounts (${currentSum / 100}) does not equal total expense (${totalAmountCents / 100})`
      );
    }

    return result;
  }

  if (splitType === 'PERCENTAGE') {
    const totalPercentage = participants.reduce((acc, p) => acc + (p.percentage || 0), 0);
    // Allow slight float tolerance around 100.0%
    if (Math.abs(totalPercentage - 100) > 0.05) {
      throw new Error(`Sum of percentages must equal 100% (currently ${totalPercentage}%)`);
    }

    // Sort descending by percentage to distribute rounding remainder cents fairly
    const sorted = [...participants].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

    let allocatedSum = 0;
    const preliminary: { user_id: string; percentage: number; amount_cents: number }[] = [];

    for (const p of sorted) {
      const pct = p.percentage || 0;
      const share = Math.floor((totalAmountCents * pct) / 100);
      allocatedSum += share;
      preliminary.push({
        user_id: p.user_id,
        percentage: pct,
        amount_cents: share,
      });
    }

    let remainder = totalAmountCents - allocatedSum;
    let i = 0;
    while (remainder > 0) {
      preliminary[i % preliminary.length].amount_cents += 1;
      remainder--;
      i++;
    }

    return preliminary.map(p => ({
      user_id: p.user_id,
      amount_cents: p.amount_cents,
      percentage: p.percentage,
    }));
  }

  if (splitType === 'SHARES') {
    const totalShares = participants.reduce((acc, p) => {
      const s = p.shares || 0;
      if (s <= 0) {
        throw new Error(`Shares for participant ${p.user_id} must be greater than 0`);
      }
      return acc + s;
    }, 0);

    if (totalShares <= 0) {
      throw new Error('Total shares must be greater than 0');
    }

    const sorted = [...participants].sort((a, b) => (b.shares || 0) - (a.shares || 0));

    let allocatedSum = 0;
    const preliminary: { user_id: string; shares: number; amount_cents: number }[] = [];

    for (const p of sorted) {
      const s = p.shares || 0;
      const share = Math.floor((totalAmountCents * s) / totalShares);
      allocatedSum += share;
      preliminary.push({
        user_id: p.user_id,
        shares: s,
        amount_cents: share,
      });
    }

    let remainder = totalAmountCents - allocatedSum;
    let i = 0;
    while (remainder > 0) {
      preliminary[i % preliminary.length].amount_cents += 1;
      remainder--;
      i++;
    }

    return preliminary.map(p => ({
      user_id: p.user_id,
      amount_cents: p.amount_cents,
      shares: p.shares,
    }));
  }

  throw new Error(`Unsupported split type: ${splitType}`);
}
