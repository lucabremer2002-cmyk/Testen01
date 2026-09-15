import type { NPC } from '../npc/types';

/** Annual rates, applied monthly. */
const SAVINGS_RATE = 0.012;
const DEBT_RATE = 0.079;

/**
 * Handles accounts, transfers and debt. Money never appears from nowhere in
 * the simulation - every euro is booked through here or through a salary.
 */
export class Bank {
  /** Total interest the city's residents paid this year - a statistics hook. */
  interestPaid = 0;
  interestEarned = 0;

  /** Moves cash to the account. */
  deposit(npc: NPC, amount: number): number {
    const a = Math.min(amount, npc.money);
    if (a <= 0) return 0;
    npc.money -= a;
    npc.bank += a;
    return a;
  }

  withdraw(npc: NPC, amount: number): number {
    const a = Math.min(amount, npc.bank);
    if (a <= 0) return 0;
    npc.bank -= a;
    npc.money += a;
    return a;
  }

  /** Total liquid wealth minus debt. */
  netWorth(npc: NPC, propertyValue = 0): number {
    return npc.money + npc.bank + propertyValue - npc.debt;
  }

  /** Spends `amount`, pulling from cash first, then the account, then credit. */
  pay(npc: NPC, amount: number): boolean {
    if (amount <= 0) return true;
    npc.monthSpend += amount;
    if (npc.money >= amount) {
      npc.money -= amount;
      return true;
    }
    let rest = amount - npc.money;
    npc.money = 0;
    if (npc.bank >= rest) {
      npc.bank -= rest;
      return true;
    }
    rest -= npc.bank;
    npc.bank = 0;
    // Falls back to credit - the NPC now carries debt and the stress that follows.
    npc.debt += rest;
    return false;
  }

  earn(npc: NPC, amount: number): void {
    if (amount <= 0) return;
    npc.monthIncome += amount;
    // Wages land in the account; debt is served first.
    if (npc.debt > 0) {
      const repay = Math.min(npc.debt, amount * 0.35);
      npc.debt -= repay;
      npc.bank += amount - repay;
    } else {
      npc.bank += amount;
    }
  }

  /** Whether a loan of `amount` would be granted. */
  canBorrow(npc: NPC, amount: number, monthlyIncome: number): boolean {
    const capacity = monthlyIncome * 90 + npc.bank * 0.4;
    return npc.debt + amount <= capacity && monthlyIncome > 900;
  }

  borrow(npc: NPC, amount: number): void {
    npc.debt += amount;
    npc.bank += amount;
  }

  /** Monthly interest run. */
  monthlyInterest(npc: NPC): void {
    if (npc.bank > 0) {
      const gain = npc.bank * (SAVINGS_RATE / 12);
      npc.bank += gain;
      this.interestEarned += gain;
    }
    if (npc.debt > 0) {
      const cost = npc.debt * (DEBT_RATE / 12);
      npc.debt += cost;
      this.interestPaid += cost;
    }
  }

  /** Keeps roughly one month of expenses as cash, the rest in the account. */
  rebalance(npc: NPC, targetCash: number): void {
    if (npc.money < targetCash * 0.5) this.withdraw(npc, targetCash - npc.money);
    else if (npc.money > targetCash * 2.5) this.deposit(npc, npc.money - targetCash);
  }
}
